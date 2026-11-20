import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clampThinkingLevel, getSupportedThinkingLevels, type Model, type Api } from '@earendil-works/pi-ai/compat';
import {
  createAgentSession, ModelRuntime, SessionManager,
  type AgentSession, type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type {
  AgentEvent, ModelConfig, ModelInfo, ModelSelection, SessionDetail, SessionOrganization, SessionListItem, SessionSummary, Outcome,
  ThinkingLevel, ModelSettings, ModelCapabilities, SessionActivity, SessionConfig, SessionConfigRequest,
  CreateSessionRequest, SessionContext, SessionStats, SessionTools, CompactionResult, SubmitMessageRequest,
} from '@plotloom/contracts';
import { AgentError, modelFailure } from './errors.ts';
import { ProviderStore } from './provider-settings.ts';
import { dateContext } from './date-context.ts';
import { readMessages, TURN_START, TURN_END, TURN_EVENT, turnUsage } from './messages.ts';
import { buildSystemPrompt } from './prompts/system-prompt.ts';
import { SessionBrowsers, BROWSER_TOOL, type BrowserOptions } from './browser.ts';
import { createWebFetchTool } from './web-fetch.ts';
export { WEB_FETCH_TOOL } from './web-fetch.ts';
export { BROWSER_TOOL } from './browser.ts';
import { createFixtureTool, createResources, createSettings } from './resources.ts';
import type { SessionSkillProfile } from '@plotloom/contracts/skills';
import type { MessageSources, MessageSourceSnapshot } from '@plotloom/contracts/sources';
import { createSkillTool, skillPrompt, type SkillSnapshot } from './skills.ts';
import { adaptBusinessTool, type RequestResources } from './request-resources.ts';
import { findProjectFiles, validateProjectPath, PROJECT_TOOLS } from './project.ts';
export { PROJECT_TOOLS } from './project.ts';
export type { RequestResources, BusinessTool } from './request-resources.ts';
export { AgentError, publicError } from './errors.ts';

export interface AgentOptions {
  dataDir: string;
  modelsPath?: string | null;
  defaultModel?: ModelSelection;
  apiKey?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  browser?: BrowserOptions;
  removeAttachments?: (id: string) => Promise<void>;
  resolveSkills?: (sessionId: string, explicit: string[]) => Promise<SkillSnapshot[]>;
  resolveResources?: (sessionId: string, text: string, sources?: MessageSources) => Promise<RequestResources | undefined>;
  resolveSources?: (sessionId: string, text: string, sources: MessageSources) => Promise<MessageSourceSnapshot & { prompt: string; images: Array<{ mimeType: string; data: string }> }>;
}
interface RecordState {
  manager: SessionManager;
  selection: ModelSelection;
  session?: AgentSession;
  opening?: Promise<AgentSession>;
  activeTurn?: string;
  current?: AgentSession['messages'][number];
  job?: Promise<void>;
  activity?: Exclude<SessionActivity, 'idle'>;
  stopRequested: boolean;
  skills?: SkillSnapshot[];
  resourceKey?: string;
  runtime?: ModelRuntime;
  resources?: RequestResources;
}

/** 管理单进程中的会话实例；持久化权威记录始终是 SDK JSONL。 */
export class AgentService {
  readonly options: AgentOptions;
  readonly providers: ProviderStore;
  get runtime(): ModelRuntime { return this.providers.runtime; }
  readonly cwd: string;
  readonly sessionDir: string;
  private readonly records = new Map<string, RecordState>();
  private selection: ModelSettings | undefined;
  private closing = false;
  private readonly browsers: SessionBrowsers;

  private constructor(options: AgentOptions, providers: ProviderStore) {
    this.options = options;
    this.providers = providers;
    this.cwd = resolve(options.dataDir, 'workspace');
    this.sessionDir = resolve(options.dataDir, 'sessions');
    this.browsers = new SessionBrowsers(options.dataDir, options.browser);
  }

  /** 本机模型配置独立于个人 Pi 目录；默认选择落盘，不保存 API 密钥。 */
  static async create(options: AgentOptions): Promise<AgentService> {
    const agentDir = resolve(options.dataDir, 'agent');
    await mkdir(agentDir, { recursive: true });
    const providers = new ProviderStore(options);
    await providers.load();
    const service = new AgentService(options, providers);
    await mkdir(service.cwd, { recursive: true });
    await mkdir(service.sessionDir, { recursive: true });
    try {
      service.selection = JSON.parse(await readFile(resolve(options.dataDir, 'model-config.json'), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      service.selection = options.defaultModel;
    }
    return service;
  }

  async models(): Promise<ModelInfo[]> {
    const available = new Set((await this.runtime.getAvailable()).map((model) => `${model.provider}\0${model.id}`));
    return this.runtime.getModels().filter(model => !this.providers.removed(model.provider)).map((model) => ({ provider: model.provider, id: model.id, name: model.name,
      configured: this.providers.enabled(model.provider) && available.has(`${model.provider}\0${model.id}`), ...this.capabilities(model) }));
  }

  /** 能力取自 SDK 模型定义，不硬编码供应商支持的思考档位。 */
  private capabilities(model: Model<Api>): ModelCapabilities {
    return { reasoning: model.reasoning, thinkingLevels: getSupportedThinkingLevels(model),
      contextWindow: model.contextWindow, maxTokens: model.maxTokens, input: [...model.input] };
  }

  private registeredModel(selection?: ModelSelection) {
    if (!selection) throw new AgentError(422, 'MODEL_NOT_SELECTED', '请先选择默认模型。');
    const model = this.runtime.getModel(selection.provider, selection.model);
    if (!model) throw new AgentError(422, 'MODEL_NOT_FOUND', '指定模型尚未注册。');
    return model;
  }

  /** 显式指定不支持的档位应报错；未指定时才沿用原值并按目标模型能力调整。 */
  private thinking(model: Model<Api>, requested: ThinkingLevel | undefined, fallback: ThinkingLevel = 'off'): ThinkingLevel {
    if (requested !== undefined && !getSupportedThinkingLevels(model).includes(requested)) {
      throw new AgentError(422, 'THINKING_LEVEL_UNSUPPORTED', '当前模型不支持该思考档位，请查询模型能力后选择。');
    }
    return clampThinkingLevel(model, requested ?? fallback);
  }

  async modelConfig(): Promise<ModelConfig> {
    const selected = this.selection;
    return { provider: selected?.provider ?? null, model: selected?.model ?? null,
      thinkingLevel: selected?.thinkingLevel ?? 'off',
      configured: !!selected && this.providers.enabled(selected.provider) && !!this.runtime.getModel(selected.provider, selected.model) && !!(await this.runtime.getAuth(selected.provider)) };
  }

  private async requireModel(selection?: ModelSelection) {
    const model = this.registeredModel(selection);
    if (!this.providers.enabled(model.provider)) throw new AgentError(422, 'PROVIDER_DISABLED', '此供应商已停用，请选择其他模型。');
    if (!(await this.runtime.getAuth(model.provider))) throw new AgentError(422, 'MODEL_NOT_CONFIGURED', '指定模型未配置凭据。');
    return model;
  }

  async setModelConfig(selection: ModelSettings): Promise<ModelConfig> {
    const model = await this.requireModel(selection);
    const saved = { ...selection, thinkingLevel: this.thinking(model, selection.thinkingLevel, this.selection?.thinkingLevel) };
    // 先写入完整临时文件再替换，重启不会读取半截 JSON。
    const path = resolve(this.options.dataDir, 'model-config.json');
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(saved), 'utf8');
    await rename(temporary, path);
    this.selection = saved;
    return this.modelConfig();
  }

  /** SDK 1.5.2 延迟到首条消息才写盘；用其公开头和条目初始化同一 JSONL，再交还 SDK。 */
  async createSession(request: CreateSessionRequest = {}, profile?: SessionSkillProfile): Promise<SessionSummary> {
    const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : this.selection;
    const model = await this.requireModel(selection);
    const thinkingLevel = this.thinking(model, request.thinkingLevel, this.selection?.thinkingLevel);
    const projectPath = request.projectPath === undefined ? undefined : await validateProjectPath(request.projectPath);
    const manager = SessionManager.create(projectPath ?? this.cwd, this.sessionDir);
    manager.appendModelChange(selection!.provider, selection!.model);
    manager.appendThinkingLevelChange(thinkingLevel);
    if (request.name?.trim()) manager.appendSessionInfo(request.name.trim());
    if (profile) manager.appendCustomEntry('plotloom-session-skills', profile);
    if (projectPath) manager.appendCustomEntry('plotloom-project', { path: projectPath });
    const path = manager.getSessionFile()!;
    await writeFile(path, [manager.getHeader(), ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
    const record: RecordState = { manager: SessionManager.open(path, this.sessionDir), selection: selection!, stopRequested: false };
    this.records.set(manager.getSessionId(), record);
    return this.summary(record);
  }

  private summary(record: RecordState): SessionSummary {
    return { id: record.manager.getSessionId(), ...record.selection, status: record.job ? 'running' : 'idle',
      activity: record.activity ?? 'idle', name: record.manager.getSessionName() ?? '新聊天',
      thinkingLevel: (record.manager.buildSessionContext().thinkingLevel || 'off') as ThinkingLevel,
      ...(this.projectPath(record) ? { projectPath: this.projectPath(record) } : {}) };
  }

  /** 只有明确创建为项目会话才启用原生工具；不凭旧会话头的默认 cwd 扩大权限。 */
  private projectPath(record: RecordState): string | undefined {
    const entry = record.manager.getEntries().find(e => e.type === 'custom' && e.customType === 'plotloom-project');
    return entry?.type === 'custom' ? (entry.data as { path: string }).path : undefined;
  }

  async projectFiles(id: string, query: string) {
    const root = this.projectPath(await this.getRecord(id));
    if (!root) throw new AgentError(409, 'PROJECT_NOT_SELECTED', '当前聊天未绑定项目目录，请新建项目聊天。');
    return findProjectFiles(root, query);
  }

  /** 在任何异步工作前占用会话，消息、配置和压缩共用同一互斥边界，结束时统一释放。 */
  private reserve(record: RecordState, activity: Exclude<SessionActivity, 'idle'>): () => void {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    if (record.job) throw new AgentError(409, 'SESSION_BUSY', '会话正在处理请求，请等待或停止。');
    // 锁空闲时释放绑定旧供应商快照的 SDK 会话；进行中的请求仍使用原实例。
    if (record.session && record.runtime !== this.runtime) {
      record.session.dispose(); record.session = undefined;
    }
    const finished = Promise.withResolvers<void>();
    record.job = finished.promise;
    record.activity = activity;
    record.stopRequested = false;
    return () => { record.job = undefined; record.activity = undefined; finished.resolve(); };
  }

  /** 宿主删除附件时复用同一会话锁，保证附件使用检查、删除与消息准备不会交错。 */
  async withIdleSession<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const release = this.reserve(await this.getRecord(id), 'configuring');
    try { return await operation(); } finally { release(); }
  }

  /** ID 只能从服务管理的目录解析；客户端永远不能把路径交给 SessionManager.open。 */
  private async getRecord(id: string): Promise<RecordState> {
    const cached = this.records.get(id);
    if (cached) return cached;
    const listed = await SessionManager.listAll(this.sessionDir);
    const file = listed.find((item) => item.id === id);
    if (!file) throw new AgentError(404, 'SESSION_NOT_FOUND', '会话不存在。');
    // 多个查询可能同时等待磁盘列表；只允许缓存一个权威实例。
    const existing = this.records.get(id);
    if (existing) return existing;
    const manager = SessionManager.open(file.path, this.sessionDir);
    const model = manager.buildSessionContext().model;
    if (!model) throw new AgentError(500, 'SESSION_INVALID', '会话模型记录缺失。');
    const record: RecordState = { manager, selection: { provider: model.provider, model: model.modelId }, stopRequested: false };
    this.records.set(id, record);
    return record;
  }

  /** 从已有状态记录还原本次归档的起点；重复归档、置顶或改名都不改变该时间。 */
  private organization(record: RecordState): SessionOrganization & { archivedAt?: string } {
    let state: SessionOrganization = { pinned: false, archived: false };
    let archivedAt: string | undefined;
    for (const entry of record.manager.getEntries()) {
      if (entry.type !== 'custom' || entry.customType !== 'plotloom-organization') continue;
      const next = entry.data as SessionOrganization;
      if (next.archived && !state.archived) archivedAt = entry.timestamp;
      state = next;
    }
    return state.archived ? { ...state, archivedAt } : state;
  }

  async organizeSession(id: string, changes: Partial<SessionOrganization>) {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'configuring');
    try {
      const { pinned, archived } = this.organization(record);
      const state = { pinned, archived, ...changes };
      record.manager.appendCustomEntry('plotloom-organization', state);
      return state;
    } finally { release(); }
  }

  /** 只允许清理已归档的空闲会话；最后删除历史，使附件或浏览器清理失败时仍能重试。 */
  async deleteArchivedSession(id: string) {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'configuring');
    try {
      if (!this.organization(record).archived) throw new AgentError(409, 'SESSION_NOT_ARCHIVED', '请先归档对话。');
      await this.browsers.remove(id);
      await this.options.removeAttachments?.(id);
      record.session?.dispose();
      record.session = undefined;
      await unlink(record.manager.getSessionFile()!);
      this.records.delete(id);
      return { id };
    } finally { release(); }
  }

  async listSessions(): Promise<SessionListItem[]> {
    const files = await SessionManager.listAll(this.sessionDir);
    return Promise.all(files.map(async file => {
      const record = await this.getRecord(file.id);
      return { ...this.summary(record), ...this.organization(record), updatedAt: file.modified.toISOString() };
    }));
  }

  async getSession(id: string): Promise<SessionDetail> {
    const record = await this.getRecord(id);
    const messages = readMessages(record.manager, record.activeTurn, record.current);
    const latest = record.manager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === TURN_START);
    const request = latest?.type === 'custom' ? (latest.data as { request?: SubmitMessageRequest } | undefined)?.request : undefined;
    const user = messages.findLast(message => message.role === 'user');
    return { ...this.summary(record), messages, ...(request && user && user.turnId === latest?.id ? { retryMessageId: user.id } : {}) };
  }

  /** 只重放最新请求，保留全部旧记录；在 prepareMessage 的同一会话锁内核对目标和读取原始参数。 */
  async prepareRetry(id: string, messageId: string) {
    return this.prepareMessage(id, '', [], undefined, undefined, messageId);
  }

  /** 小说归属与技能设置复用 SDK 自定义元数据，不复制消息，也不随页面导航变化。 */
  async getSkillProfile(id: string): Promise<SessionSkillProfile> {
    const record = await this.getRecord(id);
    const entry = record.manager.getEntries().findLast(e => e.type === 'custom' && e.customType === 'plotloom-session-skills');
    return entry?.type === 'custom' ? entry.data as SessionSkillProfile : { workspaceId: null, skillIds: null };
  }

  async setSkills(id: string, skillIds: string[] | null): Promise<void> {
    const record = await this.getRecord(id);
    const profile = await this.getSkillProfile(id);
    // 允许生成中更新下一轮设置，当前资源快照和工具实例不变。
    record.manager.appendCustomEntry('plotloom-session-skills', { ...profile, skillIds });
  }

  async getSessionConfig(id: string): Promise<SessionConfig> {
    const record = await this.getRecord(id);
    return { id, ...record.selection, thinkingLevel: this.summary(record).thinkingLevel,
      autoCompaction: this.autoCompaction(record),
      capabilities: this.capabilities(this.registeredModel(record.selection)) };
  }

  /** 会话元数据是开关的持久化来源；未设置的会话沿用默认开启，不写入模型上下文。 */
  private autoCompaction(record: RecordState): boolean {
    const entry = record.manager.getEntries().findLast(e => e.type === 'custom' && e.customType === 'plotloom-auto-compaction');
    return entry?.type === 'custom' ? (entry.data as { enabled: boolean }).enabled : true;
  }

  /** 业务状态复用 SDK 元数据；仅供后端装配调用，不暴露任意元数据写入 HTTP 接口。 */
  async appendMetadata(id: string, kind: string, data: unknown): Promise<void> {
    (await this.getRecord(id)).manager.appendCustomEntry(kind, data);
  }
  async metadata(id: string, kind: string): Promise<unknown[]> {
    return (await this.getRecord(id)).manager.getEntries().flatMap(e => e.type === 'custom' && e.customType === kind ? [e.data] : []);
  }

  /** 配置共用忙碌锁；只调自动压缩无需模型凭据，混合请求先校验模型以免部分生效。 */
  async setSessionConfig(id: string, request: SessionConfigRequest): Promise<SessionConfig> {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'configuring');
    try {
      if (request.provider !== undefined || request.model !== undefined || request.thinkingLevel !== undefined) {
        const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : record.selection;
        const model = await this.requireModel(selection);
        const thinking = this.thinking(model, request.thinkingLevel, this.summary(record).thinkingLevel);
        const session = await this.open(record);
        if (selection.provider !== record.selection.provider || selection.model !== record.selection.model) {
          await session.setModel(model);
          record.selection = selection;
        }
        session.setThinkingLevel(thinking);
      }
      if (request.autoCompaction !== undefined) {
        const session = await this.open(record);
        record.manager.appendCustomEntry('plotloom-auto-compaction', { enabled: request.autoCompaction });
        session.setAutoCompactionEnabled(request.autoCompaction);
      }
      return await this.getSessionConfig(id);
    } finally { release(); }
  }

  /** 名称直接保存到 SDK 元信息；空会话和缺少凭据的会话也可命名。 */
  async renameSession(id: string, name: string): Promise<SessionSummary> {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'configuring');
    try { record.manager.appendSessionInfo(name.trim()); } finally { release(); }
    return this.summary(record);
  }

  async getContext(id: string): Promise<SessionContext> {
    const record = await this.getRecord(id);
    const session = await this.open(record);
    const usage = session.getContextUsage();
    return { id, status: this.summary(record).status, activity: record.activity ?? 'idle',
      tokens: usage?.tokens ?? null, contextWindow: usage?.contextWindow ?? session.model?.contextWindow ?? 0,
      percent: usage?.percent ?? null, autoCompaction: session.autoCompactionEnabled };
  }

  /** 只投影 SDK 统计中的公开计数，排除本机路径和未配置真实价格的费用。 */
  async getStats(id: string): Promise<SessionStats> {
    const record = await this.getRecord(id);
    const stats = (await this.open(record)).getSessionStats();
    return { id, userMessages: stats.userMessages, assistantMessages: stats.assistantMessages,
      toolCalls: stats.toolCalls, toolResults: stats.toolResults, totalMessages: stats.totalMessages,
      usage: turnUsage(record.manager, 0) };
  }

  async getTools(id: string): Promise<SessionTools> {
    const session = await this.open(await this.getRecord(id));
    const active = new Set(session.getActiveToolNames());
    return { id, tools: session.getAllTools().map((tool) => ({ name: tool.name, description: tool.description,
      parameters: tool.parameters as Record<string, unknown>, active: active.has(tool.name) })) };
  }

  /** 手动压缩复用 SDK，独立于消息请求；断开 HTTP 不取消，只由取消/停止接口中止。 */
  async compact(id: string, instructions?: string): Promise<CompactionResult> {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'compacting');
    let unsubscribe = () => {};
    try {
      await this.requireModel(record.selection);
      const session = await this.open(record);
      // compact() 内部先 await abort 再创建取消控制器，监听 start 可覆盖刚开始时的取消。
      unsubscribe = session.subscribe((event) => {
        if (event.type === 'compaction_start' && record.stopRequested) session.abortCompaction();
      });
      if (record.stopRequested) return { id, status: 'idle', outcome: 'aborted' };
      const startIndex = record.manager.getEntryCount();
      const result = await session.compact(instructions);
      return { id, status: 'idle', outcome: 'completed', summary: result.summary,
        tokensBefore: result.tokensBefore, estimatedTokensAfter: result.estimatedTokensAfter,
        usage: turnUsage(record.manager, startIndex) };
    } catch (error) {
      if (record.stopRequested) return { id, status: 'idle', outcome: 'aborted' };
      if (error instanceof AgentError) throw error;
      if (error instanceof Error && ['Already compacted', 'Nothing to compact (session too small)'].includes(error.message)) {
        throw new AgentError(409, 'COMPACTION_UNAVAILABLE', '当前会话没有可压缩内容，请先完成更多对话。');
      }
      throw new AgentError(502, 'COMPACTION_FAILED', '上下文压缩失败，已保留原历史，请检查模型配置后重试。');
    } finally { unsubscribe(); release(); }
  }

  /** 仅取消手动压缩，普通生成不受影响；返回时取消操作已经收尾。 */
  async stopCompaction(id: string): Promise<{ id: string; status: SessionSummary['status'] }> {
    const record = await this.getRecord(id);
    if (record.activity === 'compacting') {
      const job = record.job;
      record.stopRequested = true;
      record.session?.abortCompaction();
      await job;
    }
    return { id, status: this.summary(record).status };
  }

  private async open(record: RecordState): Promise<AgentSession> {
    if (record.session) return record.session;
    if (!record.opening) record.opening = (async () => {
      // 查询上下文、统计和工具不发模型请求，因此不要求凭据；生成和压缩另行验证。
      const runtime = this.runtime;
      const model = this.registeredModel(record.selection);
      const projectPath = this.projectPath(record);
      if (projectPath) await validateProjectPath(projectPath);
      // 小说资源与普通演示保持各自入口；明确选择项目的会话使用原生工具和项目提示。
      const customTools = [...(this.options.tools ?? (record.resources || projectPath ? [] : [createFixtureTool()])), this.browsers.tool(record.manager.getSessionId()), createWebFetchTool(), ...(record.skills?.length ? [createSkillTool(record.skills)] : []), ...(record.resources?.tools.map(adaptBusinessTool) ?? [])];
      const prompt = buildSystemPrompt({ externalPrompt: this.options.systemPrompt, writingPrompt: record.resources?.systemPrompt,
        projectPath, skillPrompt: skillPrompt(record.skills ?? []) });
      const { session } = await createAgentSession({
        cwd: projectPath ?? this.cwd, agentDir: resolve(this.options.dataDir, 'agent'), modelRuntime: runtime, model,
        thinkingLevel: this.summary(record).thinkingLevel, sessionManager: record.manager,
        settingsManager: createSettings(this.autoCompaction(record)), resourceLoader: createResources(prompt),
        customTools, tools: [...(projectPath ? PROJECT_TOOLS : []), ...customTools.map((tool) => tool.name)],
      });
      record.runtime = runtime;
      record.session = session;
      return session;
    })().finally(() => { record.opening = undefined; });
    return record.opening;
  }

  /** 先验证、再原子占用会话，忙时不排队；返回执行入口供 HTTP 在写 SSE 头后启动。 */
  async prepareMessage(id: string, text: string, explicitSkills: string[] = [], resourcesFactory?: () => Promise<RequestResources>, sources?: MessageSources, retryMessageId?: string): Promise<(emit: (event: AgentEvent) => void) => Promise<void>> {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'generating');
    let session: AgentSession;
    let resources: RequestResources | undefined;
    let input: Awaited<ReturnType<NonNullable<AgentOptions['resolveSources']>>> | undefined;
    try {
      if (retryMessageId) {
        const latest = record.manager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === TURN_START);
        const request = latest?.type === 'custom' ? (latest.data as { request?: SubmitMessageRequest } | undefined)?.request : undefined;
        const user = readMessages(record.manager).findLast(message => message.role === 'user');
        if (!request || user?.id !== retryMessageId || user.turnId !== latest?.id) {
          throw new AgentError(409, 'RETRY_UNAVAILABLE', '只能重试具备请求记录的最新一轮，请刷新会话后重试。');
        }
        text = request.text ?? ''; explicitSkills = request.skillIds ?? [];
        sources = { attachmentIds: request.attachmentIds, references: request.references };
      }
      const model = await this.requireModel(record.selection);
      if (sources?.attachmentIds?.length || sources?.references?.length) {
        if (!this.options.resolveSources) throw new AgentError(422, 'MESSAGE_SOURCES_UNAVAILABLE', '当前服务未配置附件与引用能力。');
        input = await this.options.resolveSources(id, text, sources);
        if (input.images.length && !model.input.includes('image')) throw new AgentError(422, 'MODEL_IMAGE_UNSUPPORTED', '当前模型不支持图片，请切换支持图片输入的模型。');
      }
      // 占用会话后才编译业务上下文，避免两个创作请求并发建立相互覆盖的资源。
      resources = resourcesFactory ? await resourcesFactory() : await this.options.resolveResources?.(id, text.trim() || '请查看随消息提供的资料。', sources);
      const skills = await this.options.resolveSkills?.(id, explicitSkills) ?? [];
      const key = JSON.stringify([resources?.key, skills.map(s => [s.id, s.version, s.autoLoad])]);
      if (record.resourceKey !== key) {
        // 用同一权威 SessionManager 重建 SDK 资源，保留历史和压缩状态；不改 SDK 内部 prompt。
        await record.opening;
        record.session?.dispose(); record.session = undefined;
        record.skills = skills; record.resources = resources; record.resourceKey = key;
      }
      session = await this.open(record);
      await resources?.start?.();
      // 元数据保存用户原文与来源；Pi 消息保存实际上下文，公开历史不泄漏内部拼接格式。
      // 附件可提前创建空会话，因此只在首轮通过校验后取原始提示词命名。
      if (!record.manager.getSessionName() && !record.manager.getEntries().some(e => e.type === 'custom' && e.customType === TURN_START)) {
        record.manager.appendSessionInfo(Array.from(text.trim().replace(/\s+/gu, ' ')).slice(0, 16).join('') || '新聊天');
      }
      record.activeTurn = record.manager.appendCustomEntry(TURN_START, {
        request: { text, skillIds: explicitSkills, ...sources },
        ...(input ? { input: { text, attachments: input.attachments, references: input.references } } : {}),
      });
    } catch (error) { release(); throw error; }
    const startIndex = record.manager.getEntryCount();
    return async (emit) => {
      let accepted = false;
      let aborted = false;
      let outcome: Outcome = 'failed';
      const unsubscribe = session.subscribe((event) => {
        if (event.type === 'message_end') {
          // SDK 在同步通知之后才保存条目；微任务读取可取得真实且重启稳定的消息 ID。
          queueMicrotask(() => {
            if (event.message.role === 'user' && !accepted) {
              const entry = record.manager.getEntries().slice(startIndex).find((item) => item.type === 'message' && item.message.role === 'user');
              if (entry) { accepted = true; emit({ type: 'accepted', sessionId: id, messageId: entry.id }); }
            }
            if (event.message.role === 'assistant') record.current = undefined;
          });
        }
        if (event.type === 'message_update') {
          record.current = event.message;
          if (event.assistantMessageEvent.type === 'text_delta') emit({ type: 'text_delta', sessionId: id, delta: event.assistantMessageEvent.delta });
          if (event.assistantMessageEvent.type === 'thinking_delta') emit({ type: 'thinking_delta', sessionId: id, delta: event.assistantMessageEvent.delta });
        }
        if (event.type === 'tool_execution_start') emit({ type: 'tool_start', sessionId: id, callId: event.toolCallId, name: event.toolName });
        if (event.type === 'tool_execution_end') emit({ type: 'tool_end', sessionId: id, callId: event.toolCallId, name: event.toolName, outcome: event.isError ? 'failed' : 'completed' });
        if (event.type === 'auto_retry_start') {
          record.manager.appendCustomEntry(TURN_EVENT, { type: 'event', name: 'retrying', text: `模型请求重试（${event.attempt}/${event.maxAttempts}）`, status: 'running' });
          emit({ type: 'retrying', sessionId: id, attempt: event.attempt, maxAttempts: event.maxAttempts });
        }
        if (event.type === 'compaction_start' || event.type === 'compaction_end') {
          record.manager.appendCustomEntry(TURN_EVENT, { type: 'event', name: 'compacting', text: event.type === 'compaction_start' ? '正在整理上下文' : '上下文整理结束', status: event.type === 'compaction_start' ? 'running' : 'completed' });
          emit({ type: 'compacting', sessionId: id, phase: event.type === 'compaction_start' ? 'start' : 'end' });
        }
        if (event.type === 'agent_settled') aborted = event.aborted;
        if (record.stopRequested && event.type === 'message_start' && event.message.role === 'user') void session.abort();
      });
      try {
        // 日期只追加到本轮输入末尾，系统提示和旧消息保持不变，以保留缓存前缀。
        // 与用户消息合为同一条，避免 SDK 将独立日期消息视作新轮次、增加压缩摘要请求。
        const prompt = `${input?.prompt ?? text}\n\n${dateContext()}`;
        await session.prompt(prompt, input ? { images: input.images.map(image => ({ type: 'image', ...image })) } : undefined);
        const last = record.manager.getEntries().slice(startIndex).findLast((entry) => entry.type === 'message' && entry.message.role === 'assistant');
        outcome = aborted || (last?.type === 'message' && last.message.role === 'assistant' && last.message.stopReason === 'aborted') ? 'aborted'
          : last?.type === 'message' && last.message.role === 'assistant' && ['stop', 'length'].includes(last.message.stopReason) ? 'completed' : 'failed';
      } catch {
        outcome = record.stopRequested ? 'aborted' : 'failed';
      } finally {
        unsubscribe();
        try {
          await resources?.finish?.(outcome);
          record.manager.appendCustomEntry(TURN_END, { turnId: record.activeTurn, outcome });
        } catch {
          outcome = 'failed';
        }
        record.current = undefined;
        record.activeTurn = undefined;
        release();
      }
      if (outcome === 'completed') emit({ type: 'completed', sessionId: id, usage: turnUsage(record.manager, startIndex) });
      else if (outcome === 'aborted') emit({ type: 'aborted', sessionId: id });
      else emit({ type: 'failed', sessionId: id, error: modelFailure });
    };
  }

  /** 等待整个请求收尾，不只等待网络 abort；返回 idle 时结果已经可以查询。 */
  async stop(id: string): Promise<SessionSummary> {
    const record = await this.getRecord(id);
    if (record.job) {
      const job = record.job;
      record.stopRequested = true;
      record.session?.abortCompaction();
      await record.session?.abort();
      await job;
    }
    return this.summary(record);
  }

  async close(): Promise<void> {
    this.closing = true;
    await Promise.all([...this.records.keys()].map((id) => this.stop(id)));
    for (const record of this.records.values()) record.session?.dispose();
    await this.browsers.close();
    await this.runtime.settleCredentialWrites();
  }
}
