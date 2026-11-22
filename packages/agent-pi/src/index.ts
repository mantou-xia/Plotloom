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
  AgentQuestionAnswer, AgentPersona, AgentProfile, AgentProfileUpdate,
  CreateSessionRequest, CreateProjectSessionRequest, ProjectFileChange, TurnFileChanges, SessionContext, SessionStats, SessionTools, CompactionResult, SubmitMessageRequest, ToolApprovalDecision, ProjectApprovalMode,
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
import { createResources, createSettings } from './resources.ts';
import type { SessionSkillProfile } from '@plotloom/contracts/skills';
import type { MessageSources, MessageSourceSnapshot } from '@plotloom/contracts/sources';
import { createSkillTool, skillPrompt, type SkillSnapshot } from './skills.ts';
import { adaptBusinessTool, type RequestResources } from './request-resources.ts';
import { findProjectFiles, resolveDeliverable, validateProjectPath } from './project.ts';
import { createProjectTools, type Approval, type WrittenProjectFile } from './project-tools.ts';
import { compareProjectFile, PROJECT_FILE_WRITE, summarizeProjectWrites, type ProjectWriteSnapshot } from './project-diff.ts';
import { ToolApprovals } from './tool-approvals.ts';
import { AgentQuestions, createAskUserTool, type QuestionWaiter } from './agent-question.ts';
import { createAgentProfileTool } from './agent-profile-tool.ts';
export { SETUP_AGENT_PROFILE } from './agent-profile-tool.ts';
export { ASK_USER_TOOL } from './agent-question.ts';
export { PROJECT_TOOLS } from './project-tools.ts';
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
  resolveAgentProfile?: () => Promise<AgentProfile>;
  completeAgentBootstrap?: (input: AgentProfileUpdate, signal?: AbortSignal) => Promise<boolean>;
  resolveNovelRoot?: (workspaceId: string) => Promise<string>;
  resolveResources?: (sessionId: string, text: string, sources?: MessageSources, businessInput?: unknown) => Promise<RequestResources | undefined>;
  recoverBusinessInput?: (request: SubmitMessageRequest, entries: ReadonlyMap<string, unknown>) => unknown;
  resolveSources?: (sessionId: string, text: string, sources: MessageSources) => Promise<MessageSourceSnapshot & { prompt: string; images: Array<{ mimeType: string; data: string }> }>;
}
interface TurnRequest {
  request?: SubmitMessageRequest;
  businessInput?: unknown;
  execution?: { model: ModelSettings; autoCompaction: boolean; skills: Array<[string, string, boolean]> };
  restoreModel?: ModelSettings;
  persona?: AgentPersona | null;
  bootstrap?: boolean;
}

const skillVersions = (skills: SkillSnapshot[]): Array<[string, string, boolean]> =>
  skills.map(skill => [skill.id, skill.version, skill.autoLoad]);

/** Pi 会在执行时写入实际模型和思考档位。临时重试覆盖结束后，恢复会话原先的设置。 */
function restoreReplayModel(manager: SessionManager, model: ModelSettings) {
  const current = manager.buildSessionContext();
  if (current.model?.provider !== model.provider || current.model?.modelId !== model.model) {
    manager.appendModelChange(model.provider, model.model);
  }
  if (model.thinkingLevel && current.thinkingLevel !== model.thinkingLevel) {
    manager.appendThinkingLevelChange(model.thinkingLevel);
  }
}

interface RecordState {
  manager: SessionManager;
  fileChanges?: Map<string, TurnFileChanges>;
  selection: ModelSelection;
  session?: AgentSession;
  opening?: Promise<AgentSession>;
  activeTurn?: string;
  current?: AgentSession['messages'][number];
  job?: Promise<void>;
  activity?: Exclude<SessionActivity, 'idle'>;
  stopRequested: boolean;
  skills?: SkillSnapshot[];
  persona?: AgentPersona;
  bootstrap?: boolean;
  resourceKey?: string;
  runtime?: ModelRuntime;
  resources?: RequestResources;
  approvals?: ToolApprovals;
  questions?: AgentQuestions;
  emit?: (event: AgentEvent) => void;
  replayBaseModel?: ModelSettings;
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
    await service.removeUnboundSessions();
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
    const model = selected && this.runtime.getModel(selected.provider, selected.model);
    return { provider: selected?.provider ?? null, model: selected?.model ?? null,
      thinkingLevel: model ? this.thinking(model, undefined, selected?.thinkingLevel) : selected?.thinkingLevel ?? 'off',
      configured: !!selected && this.providers.enabled(selected.provider) && !!model && !!(await this.runtime.getAuth(selected.provider)) };
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
  async createSession(request: CreateProjectSessionRequest): Promise<SessionSummary>;
  async createSession(request: CreateSessionRequest, profile: SessionSkillProfile & { workspaceId: string }): Promise<SessionSummary>;
  async createSession(request: CreateSessionRequest | CreateProjectSessionRequest, profile?: SessionSkillProfile): Promise<SessionSummary> {
    const projectPath = 'projectPath' in request ? await validateProjectPath(request.projectPath) : undefined;
    if (Boolean(projectPath) === Boolean(profile?.workspaceId)) {
      throw new AgentError(400, 'INVALID_REQUEST', '会话必须绑定一个项目目录或小说工作区。');
    }
    const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : this.selection;
    const model = await this.requireModel(selection);
    const thinkingLevel = this.thinking(model, request.thinkingLevel, this.selection?.thinkingLevel);
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
    // 旧会话可能保存了已移除的档位；按当前模型能力恢复，确保显示与下一次生成一致。
    const saved = record.replayBaseModel?.thinkingLevel ?? (record.manager.buildSessionContext().thinkingLevel || 'off') as ThinkingLevel;
    const model = this.runtime.getModel(record.selection.provider, record.selection.model);
    return { id: record.manager.getSessionId(), ...record.selection, status: record.job ? 'running' : 'idle',
      activity: this.sessionActivity(record), name: record.manager.getSessionName() ?? '新聊天',
      thinkingLevel: model ? this.thinking(model, undefined, saved) : saved,
      ...(this.projectPath(record.manager) ? { projectPath: this.projectPath(record.manager) } : {}) };
  }

  /** 用户交互仍占用生成锁；根据当前待处理请求派生活动，回复后恢复生成。 */
  private sessionActivity(record: RecordState): SessionActivity {
    if (record.activity === 'generating' && record.questions?.current) return 'awaiting_answer';
    if (record.activity === 'generating' && record.approvals?.hasPending) return 'awaiting_approval';
    return record.activity ?? 'idle';
  }

  /** 只有明确创建为项目会话才启用原生工具；不凭旧会话头的默认 cwd 扩大权限。 */
  private projectPath(manager: SessionManager): string | undefined {
    const entry = manager.getEntries().find(e => e.type === 'custom' && e.customType === 'plotloom-project');
    return entry?.type === 'custom' ? (entry.data as { path: string }).path : undefined;
  }

  /** 老小说通过已保存的工作区 ID 解析根目录，绝不使用旧会话的默认 cwd。 */
  private async fileRoot(manager: SessionManager) {
    const workspaceId = this.skillProfile(manager).workspaceId;
    return workspaceId ? this.options.resolveNovelRoot?.(workspaceId) : this.projectPath(manager);
  }
  async projectFiles(id: string, query: string) {
    const root = await this.fileRoot((await this.getRecord(id)).manager);
    if (!root) throw new AgentError(409, 'PROJECT_NOT_SELECTED', '当前聊天未绑定项目目录，请新建项目聊天。');
    return findProjectFiles(root, query, this.options.dataDir);
  }

  /** 预览与宿主打开共用会话固定的目录范围，客户端只提供相对路径。 */
  async resolveDeliverable(id: string, path: string) {
    const root = await this.fileRoot((await this.getRecord(id)).manager);
    if (!root) throw new AgentError(409, 'PROJECT_NOT_SELECTED', '当前聊天未绑定项目或小说目录。');
    return resolveDeliverable(root, this.options.dataDir, path);
  }

  /** 用会话和记录 ID 查询保存的快照，磁盘当前内容不影响以前的对比。 */
  private async projectWrites(id: string) {
    const { manager } = await this.getRecord(id);
    if (!this.projectPath(manager) && !this.skillProfile(manager).workspaceId) throw new AgentError(409, 'PROJECT_NOT_SELECTED', '当前聊天未绑定项目目录。');
    return manager.getEntries().flatMap(entry => {
      if (entry.type !== 'custom' || entry.customType !== PROJECT_FILE_WRITE) return [];
      const { id, path, operation, before, after } = entry.data as ProjectWriteSnapshot;
      const change: ProjectFileChange = { id, path, operation, createdAt: entry.timestamp };
      return [{ change, before, after }];
    });
  }

  async listProjectWrites(id: string): Promise<{ changes: ProjectFileChange[] }> {
    return { changes: (await this.projectWrites(id)).map(item => item.change) };
  }

  async projectFileDiff(id: string, writeId: string) {
    const entry = (await this.projectWrites(id)).find(item => item.change.id === writeId);
    if (!entry) throw new AgentError(404, 'PROJECT_WRITE_NOT_FOUND', '该文件写入记录不存在。');
    return compareProjectFile(entry.change, entry.before, entry.after);
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
    // 强制退出可能发生在 Pi 持久化临时档位后。结束标记之前先恢复配置，保证再次打开仍使用会话设置。
    const boundary = manager.getBranch().findLast(entry =>
      entry.type === 'custom' && (entry.customType === TURN_START || entry.customType === TURN_END));
    if (boundary?.type === 'custom' && boundary.customType === TURN_START) {
      const restoreModel = (boundary.data as TurnRequest | undefined)?.restoreModel;
      if (restoreModel) restoreReplayModel(manager, restoreModel);
    }
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
      await this.removeSessionFiles(record.manager);
      return { id };
    } finally { release(); }
  }

  /** 启动时按持久化归属清理旧普通会话，包括已归档记录。只要有明确的项目或小说归属就保留。 */
  private async removeUnboundSessions(): Promise<void> {
    for (const file of await SessionManager.listAll(this.sessionDir)) {
      const manager = SessionManager.open(file.path, this.sessionDir);
      if (!this.projectPath(manager) && !this.skillProfile(manager).workspaceId) await this.removeSessionFiles(manager);
    }
  }

  /** 先清理会话专属数据，最后删除历史；启动中断后下次仍能根据同一会话重试。 */
  private async removeSessionFiles(manager: SessionManager): Promise<void> {
    const id = manager.getSessionId();
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new AgentError(500, 'SESSION_INVALID', '会话标识无效。');
    await this.browsers.remove(id);
    await this.options.removeAttachments?.(id);
    const record = this.records.get(id);
    record?.session?.dispose();
    if (record) record.session = undefined;
    await unlink(manager.getSessionFile()!);
    this.records.delete(id);
  }

  async listSessions(): Promise<SessionListItem[]> {
    const files = await SessionManager.listAll(this.sessionDir);
    return Promise.all(files.map(async file => {
      const record = await this.getRecord(file.id);
      return { ...this.summary(record), ...this.organization(record), updatedAt: file.modified.toISOString() };
    }));
  }

  /** 写入快照位于轮次标记之间。终态摘要只算一次，既支持已有快照，也不在轮询时重复计算差异。 */
  private finishedFileChanges(record: RecordState, messages: SessionDetail['messages']): TurnFileChanges[] {
    const finishedTurns = new Set(messages.flatMap(message =>
      message.role === 'user' && message.turnId && message.outcome ? [message.turnId] : []));
    const summaries = record.fileChanges ??= new Map();
    const writesByTurn = new Map<string, ProjectWriteSnapshot[]>();
    let turnId: string | undefined;
    for (const entry of record.manager.getBranch()) {
      if (entry.type !== 'custom') continue;
      if (entry.customType === TURN_START) turnId = entry.id;
      else if (entry.customType === TURN_END) turnId = undefined;
      else if (entry.customType === PROJECT_FILE_WRITE) {
        const change = entry.data as ProjectWriteSnapshot & { turnId?: string | null };
        const owner = change.turnId === undefined ? turnId : change.turnId;
        if (!owner || !finishedTurns.has(owner) || summaries.has(owner)) continue;
        const writes = writesByTurn.get(owner) ?? [];
        writes.push(change);
        writesByTurn.set(owner, writes);
      }
    }
    for (const [turn, writes] of writesByTurn) summaries.set(turn, { turnId: turn, files: summarizeProjectWrites(writes) });
    return [...finishedTurns].flatMap(turn => {
      const summary = summaries.get(turn);
      return summary ? [summary] : [];
    });
  }

  async getSession(id: string): Promise<SessionDetail> {
    const record = await this.getRecord(id);
    const messages = readMessages(record.manager, record.activeTurn, record.current);
    const latest = record.manager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === TURN_START);
    const request = latest?.type === 'custom' ? (latest.data as { request?: SubmitMessageRequest } | undefined)?.request : undefined;
    const user = messages.findLast(message => message.role === 'user');
    const pendingApprovals = record.approvals?.list();
    const pendingQuestion = record.questions?.current;
    const manuscript = record.manager.getEntries().findLast(entry => entry.type === 'custom' && entry.customType === 'plotloom-manuscript-view');
    const manuscriptData = manuscript?.type === 'custom' ? manuscript.data as Omit<NonNullable<SessionDetail['manuscriptRequest']>, 'id'> : undefined;
    const manuscriptRequest = manuscript && manuscriptData ? { id: manuscript.id, ...manuscriptData } : undefined;
    const fileChanges = this.finishedFileChanges(record, messages);
    return { ...this.summary(record), messages, ...(fileChanges.length ? { fileChanges } : {}), ...(pendingApprovals?.length ? { pendingApprovals } : {}),
      ...(pendingQuestion ? { pendingQuestion } : {}), ...(manuscriptRequest ? { manuscriptRequest } : {}),
      ...(request && user && user.turnId === latest?.id ? { retryMessageId: user.id } : {}) };
  }

  /** 只接受当前会话仍待决定的调用；重启和重试没有可沿用的批准。 */
  async decideToolApproval(id: string, approvalId: string, decision: ToolApprovalDecision) {
    const record = await this.getRecord(id);
    if (!record.approvals || record.stopRequested) throw new AgentError(409, 'TOOL_APPROVAL_UNAVAILABLE', '审批请求已结束。');
    return record.approvals.decide(approvalId, decision);
  }

  /** 回复绑定当前运行中的会话和问题，防止晚到的答案落入下一轮。 */
  async answerQuestion(id: string, questionId: string, answer: AgentQuestionAnswer) {
    const record = await this.getRecord(id);
    if (!record.questions || record.stopRequested) throw new AgentError(409, 'QUESTION_UNAVAILABLE', '问题已结束。');
    return record.questions.answer(questionId, answer);
  }

  /** 只重放最新请求，保留全部旧记录；在 prepareMessage 的同一会话锁内核对目标和读取原始参数。 */
  async prepareRetry(id: string, messageId: string) {
    return this.prepareMessage(id, '', [], undefined, undefined, messageId);
  }

  /** 小说归属与技能设置复用 SDK 自定义元数据，不复制消息，也不随页面导航变化。 */
  async getSkillProfile(id: string): Promise<SessionSkillProfile> {
    return this.skillProfile((await this.getRecord(id)).manager);
  }

  private skillProfile(manager: SessionManager): SessionSkillProfile {
    const entry = manager.getEntries().findLast(e => e.type === 'custom' && e.customType === 'plotloom-session-skills');
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
      ...(this.projectPath(record.manager) || this.skillProfile(record.manager).workspaceId ? { projectApprovalMode: this.projectApprovalMode(record) } : {}),
      capabilities: this.capabilities(this.registeredModel(record.selection)) };
  }

  /** 旧会话缺少模式记录时沿用逐次审批；会话配置独立于模型历史。 */
  private projectApprovalMode(record: RecordState): ProjectApprovalMode {
    const entry = record.manager.getEntries().findLast(e => e.type === 'custom' && e.customType === 'plotloom-project-approval-mode');
    return entry?.type === 'custom' && entry.data === 'full_access' ? 'full_access' : 'required';
  }

  /** 会话元数据是开关的持久化来源；未设置的会话沿用默认开启，不写入模型上下文。 */
  private autoCompaction(record: RecordState): boolean {
    const entry = record.manager.getEntries().findLast(e => e.type === 'custom' && e.customType === 'plotloom-auto-compaction');
    return entry?.type === 'custom' ? (entry.data as { enabled: boolean }).enabled : true;
  }

  /** 专属工具正式写入记到当前轮；候选后来才采纳时，按创作请求 ID 找回原轮。 */
  async recordFileWrite(id: string, change: WrittenProjectFile, sourceRequestId?: string) {
    const record = await this.getRecord(id).catch(error => {
      if (sourceRequestId && error instanceof AgentError && error.code === 'SESSION_NOT_FOUND') return undefined;
      throw error;
    });
    if (!record) return;
    const source = sourceRequestId && record.manager.getBranch().find(entry => entry.type === 'custom' && entry.customType === TURN_START
      && (entry.data as { resourceKey?: string })?.resourceKey === sourceRequestId);
    // 旧候选没有轮次标识，只记入本会话清单，避免归到采纳时恰好运行的另一轮。
    const turnId = sourceRequestId ? (source ? source.id : null) : record.activeTurn;
    record.manager.appendCustomEntry(PROJECT_FILE_WRITE, { ...change, id: crypto.randomUUID(), turnId });
    if (turnId) record.fileChanges?.delete(turnId);
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
      if (request.projectApprovalMode !== undefined && !this.projectPath(record.manager) && !this.skillProfile(record.manager).workspaceId)
        throw new AgentError(409, 'PROJECT_NOT_SELECTED', '只有绑定目录的会话可以调整文件审批模式。');
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
      if (request.projectApprovalMode !== undefined)
        record.manager.appendCustomEntry('plotloom-project-approval-mode', request.projectApprovalMode);
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
    return { id, status: this.summary(record).status, activity: this.sessionActivity(record),
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

  private async open(record: RecordState, execution?: TurnRequest['execution']): Promise<AgentSession> {
    if (record.session) return record.session;
    if (!record.opening) record.opening = (async () => {
      // 查询上下文、统计和工具不发模型请求，因此不要求凭据；生成和压缩另行验证。
      const runtime = this.runtime;
      const model = this.registeredModel(execution?.model ?? record.selection);
      const projectPath = await this.fileRoot(record.manager);
      if (projectPath && await validateProjectPath(projectPath) !== projectPath)
        throw new AgentError(422, 'PROJECT_PATH_INVALID', '项目目录已变化，请重新选择项目。');
      const id = record.manager.getSessionId();
      // 项目文件工具使用受控定义。联网工具下方统一注册，继续沿用各自的会话隔离和访问规则。
      const approve: Approval = async (callId, request, signal, requireDecision = false) => {
        if (!record.activeTurn || !record.emit || record.stopRequested) return 'cancelled';
        const turnId = record.activeTurn;
        const emit = record.emit;
        // 模式受会话锁保护；文件工具仍负责复核目标及取消信号。
        if (this.projectApprovalMode(record) === 'full_access' && !requireDecision) {
          record.manager.appendCustomEntry('plotloom.tool-decision', { turnId, callId, operation: request.operation,
            path: request.path, decision: 'full_access' });
          return 'approve';
        }
        const approvals = record.approvals ??= new ToolApprovals();
        const decision = await approvals.wait({ ...request, turnId, callId }, signal, approval =>
          emit({ type: 'tool_approval_required', sessionId: id, approval }));
        record.manager.appendCustomEntry('plotloom.tool-decision', { turnId, callId, operation: request.operation, path: request.path, decision });
        return decision;
      };
      const novel = Boolean(this.skillProfile(record.manager).workspaceId);
      const tools = projectPath
        ? createProjectTools(projectPath, await validateProjectPath(this.options.dataDir), approve,
          change => record.manager.appendCustomEntry(PROJECT_FILE_WRITE, { id: crypto.randomUUID(), ...change }), record.resources?.fileScope)
        : this.options.tools ?? [];
      const ask: QuestionWaiter = async (question, signal) => {
        const emit = record.emit;
        if (!record.activeTurn || !emit || record.stopRequested) return { kind: 'cancelled' };
        const questions = record.questions ??= new AgentQuestions();
        return questions.wait(question, signal, pending => emit({ type: 'user_answer_required', sessionId: id, question: pending }));
      };
      // 小说原有的宿主扩展继续注册；同名文件工具始终使用受目录和审批约束的实现。
      const extraTools = novel && projectPath ? this.options.tools?.filter(tool => !tools.some(existing => existing.name === tool.name)) ?? [] : [];
      const customTools = [...tools, ...extraTools, this.browsers.tool(id), createWebFetchTool(), createAskUserTool(ask),
        ...(record.bootstrap && this.options.completeAgentBootstrap ? [createAgentProfileTool(ask, this.options.completeAgentBootstrap)] : []),
        ...(record.skills?.length ? [createSkillTool(record.skills)] : []), ...(record.resources?.tools.map(tool => adaptBusinessTool(tool, ask, approve)) ?? [])];
      const prompt = buildSystemPrompt({ externalPrompt: this.options.systemPrompt, mode: novel ? 'novel' : 'project', writingPrompt: record.resources?.systemPrompt,
        skillPrompt: skillPrompt(record.skills ?? []), persona: record.persona, bootstrap: record.bootstrap });
      const { session } = await createAgentSession({
        cwd: projectPath ?? this.cwd, agentDir: resolve(this.options.dataDir, 'agent'), modelRuntime: runtime, model,
        thinkingLevel: execution?.model.thinkingLevel ?? this.summary(record).thinkingLevel, sessionManager: record.manager,
        settingsManager: createSettings(execution?.autoCompaction ?? this.autoCompaction(record)), resourceLoader: createResources(prompt),
        customTools, tools: customTools.map((tool) => tool.name),
      });
      record.runtime = runtime;
      record.session = session;
      return session;
    })().finally(() => { record.opening = undefined; });
    return record.opening;
  }

  /** 先验证、再原子占用会话，忙时不排队；返回执行入口供 HTTP 在写 SSE 头后启动。 */
  async prepareMessage(id: string, text: string, explicitSkills: string[] = [], businessInput?: unknown, sources?: MessageSources, retryMessageId?: string): Promise<(emit: (event: AgentEvent) => void) => Promise<void>> {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'generating');
    let session: AgentSession;
    let resources: RequestResources | undefined;
    let input: Awaited<ReturnType<NonNullable<AgentOptions['resolveSources']>>> | undefined;
    let execution: TurnRequest['execution'];
    let persona: AgentPersona | null | undefined;
    let replayBootstrap = false;
    let temporarySession = false;
    const restoreSession = () => {
      if (!temporarySession) return;
      record.session?.dispose();
      record.session = undefined;
      record.resourceKey = undefined;
      record.replayBaseModel = undefined;
    };
    try {
      if (retryMessageId) {
        const branch = record.manager.getBranch();
        const index = branch.findLastIndex(entry => entry.type === 'custom' && entry.customType === TURN_START);
        const latest = branch[index];
        const saved = latest?.type === 'custom' ? latest.data as TurnRequest | undefined : undefined;
        const request = saved?.request;
        const user = readMessages(record.manager).findLast(message => message.role === 'user');
        if (!request || user?.id !== retryMessageId || user.turnId !== latest?.id) {
          throw new AgentError(409, 'RETRY_UNAVAILABLE', '只能重试具备请求记录的最新一轮，请刷新会话后重试。');
        }
        text = request.text ?? ''; explicitSkills = request.skillIds ?? [];
        sources = { attachmentIds: request.attachmentIds, references: request.references };
        businessInput = saved?.businessInput;
        execution = saved?.execution;
        // 即使原轮没有人设，之后设置的人设也不应改变本次重试的输入。
        persona = saved?.persona ?? null;
        replayBootstrap = saved?.bootstrap === true;
        if (businessInput === undefined && this.options.recoverBusinessInput) {
          // 旧轮次在开始标记前保存初始上下文。到上一轮边界即停止，避免误用陈旧资料。
          const entries = new Map<string, unknown>();
          for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
            const entry = branch[cursor];
            if (entry.type !== 'custom') continue;
            if (entry.customType === TURN_END || entry.customType === TURN_START) break;
            if (!entries.has(entry.customType)) entries.set(entry.customType, entry.data);
          }
          businessInput = this.options.recoverBusinessInput(request, entries);
        }
      }
      const model = await this.requireModel(execution?.model ?? record.selection);
      if (execution?.model.thinkingLevel && clampThinkingLevel(model, execution.model.thinkingLevel) !== execution.model.thinkingLevel) {
        throw new AgentError(409, 'RETRY_UNAVAILABLE', '原模型已不支持本轮的思考档位，请重新发起创作。');
      }
      if (sources?.attachmentIds?.length || sources?.references?.length) {
        if (!this.options.resolveSources) throw new AgentError(422, 'MESSAGE_SOURCES_UNAVAILABLE', '当前服务未配置附件与引用能力。');
        input = await this.options.resolveSources(id, text, sources);
        if (input.images.length && !model.input.includes('image')) throw new AgentError(422, 'MODEL_IMAGE_UNSUPPORTED', '当前模型不支持图片，请切换支持图片输入的模型。');
      }
      // 占用会话后才编译业务上下文，避免两个创作请求并发建立相互覆盖的资源。
      resources = await this.options.resolveResources?.(id, text.trim() || '请查看随消息提供的资料。', sources, businessInput);
      if (businessInput !== undefined && !resources) throw new AgentError(409, 'RETRY_UNAVAILABLE', '无法恢复本轮创作资源，请重新发起创作。');
      const skills = await this.options.resolveSkills?.(id, explicitSkills) ?? [];
      const profile = await this.options.resolveAgentProfile?.();
      if (persona === undefined && profile) {
        const { name, style, preferences } = profile;
        persona = { name, style, preferences };
      }
      persona ??= null;
      if (persona && !(persona.name || persona.style || persona.preferences)) persona = null;
      // 只有正式聊天有确认卡，结构化创作工作台继续执行其写作任务。
      const bootstrap = businessInput === undefined && !resources?.persistReplayInput && profile?.setup === 'pending' && !!this.options.completeAgentBootstrap &&
        (!retryMessageId || replayBootstrap);
      const versions = skillVersions(skills);
      if (execution && JSON.stringify(versions) !== JSON.stringify(execution.skills)) {
        throw new AgentError(409, 'RETRY_UNAVAILABLE', '本轮使用的技能版本或启用状态已变化，请重新发起创作。');
      }
      const currentModel = { ...record.selection, thinkingLevel: this.summary(record).thinkingLevel };
      const autoCompaction = this.autoCompaction(record);
      temporarySession = !!execution && (execution.model.provider !== currentModel.provider || execution.model.model !== currentModel.model ||
        execution.model.thinkingLevel !== currentModel.thinkingLevel || execution.autoCompaction !== autoCompaction);
      const key = JSON.stringify([resources?.key, versions, persona, bootstrap]);
      if (temporarySession || record.resourceKey !== key) {
        // 用同一权威 SessionManager 重建 SDK 资源，保留历史和压缩状态；不改 SDK 内部 prompt。
        await record.opening;
        record.session?.dispose(); record.session = undefined;
        record.skills = skills; record.resources = resources; record.persona = persona ?? undefined; record.bootstrap = bootstrap; record.resourceKey = key;
      }
      session = await this.open(record, execution);
      await resources?.start?.();
      // 元数据保存用户原文与来源；Pi 消息保存实际上下文，公开历史不泄漏内部拼接格式。
      // 附件可提前创建空会话，因此只在首轮通过校验后取原始提示词命名。
      if (!record.manager.getSessionName() && !record.manager.getEntries().some(e => e.type === 'custom' && e.customType === TURN_START)) {
        record.manager.appendSessionInfo(Array.from(text.trim().replace(/\s+/gu, ' ')).slice(0, 16).join('') || '新聊天');
      }
      record.activeTurn = record.manager.appendCustomEntry(TURN_START, {
        request: { text, skillIds: explicitSkills, ...sources },
        ...(resources ? { resourceKey: resources.key } : {}),
        persona,
        ...(bootstrap ? { bootstrap } : {}),
        ...(businessInput !== undefined || resources?.persistReplayInput ? { businessInput: resources?.replayInput ?? businessInput, execution: execution ?? { model: currentModel, autoCompaction, skills: versions } } : {}),
        ...(temporarySession ? { restoreModel: currentModel } : {}),
        ...(input ? { input: { text, attachments: input.attachments, references: input.references } } : {}),
      });
      if (temporarySession) record.replayBaseModel = currentModel;
    } catch (error) { restoreSession(); release(); throw error; }
    const startIndex = record.manager.getEntryCount();
    return async (emit) => {
      record.emit = emit;
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
        if (event.type === 'tool_execution_end') {
          // 只向客户端发送定位指令，工具文稿原文仍走公开文档读取接口。
          const manuscriptView = !event.isError && ['manuscript_workspace', 'import_chapters', 'deliver_chapter'].includes(event.toolName) ? event.result?.details?.view : undefined;
          if (manuscriptView) record.manager.appendCustomEntry('plotloom-manuscript-view', { view: manuscriptView, createdAt: new Date().toISOString() });
          emit({ type: 'tool_end', sessionId: id, callId: event.toolCallId, name: event.toolName,
            outcome: event.isError ? 'failed' : 'completed', ...(manuscriptView ? { manuscriptView } : {}) });
        }
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
        record.approvals?.cancel();
        record.questions?.cancel();
        record.emit = undefined;
        try {
          if (record.replayBaseModel) restoreReplayModel(record.manager, record.replayBaseModel);
          await resources?.finish?.(outcome);
          record.manager.appendCustomEntry(TURN_END, { turnId: record.activeTurn, outcome });
        } catch {
          outcome = 'failed';
        }
        record.current = undefined;
        record.activeTurn = undefined;
        // 临时重放的模型与压缩设置只用于这一轮，下一轮仍由会话当前设置装配。
        restoreSession();
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
      record.approvals?.cancel();
      record.questions?.cancel();
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
