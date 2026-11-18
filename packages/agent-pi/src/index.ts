import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clampThinkingLevel, getSupportedThinkingLevels, type Model, type Api } from '@earendil-works/pi-ai/compat';
import {
  createAgentSession, ModelRuntime, SessionManager,
  type AgentSession, type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type {
  AgentEvent, ModelConfig, ModelInfo, ModelSelection, SessionDetail, SessionListItem, SessionSummary, Outcome,
  ThinkingLevel, ModelSettings, ModelCapabilities, SessionActivity, SessionConfig, SessionConfigRequest,
  CreateSessionRequest, SessionContext, SessionStats, SessionTools, CompactionResult,
} from '@plotloom/contracts';
import { AgentError, modelFailure } from './errors.ts';
import { readMessages, TURN_START, TURN_END, turnUsage } from './messages.ts';
import { createFixtureTool, createResources, createSettings, SYSTEM_PROMPT } from './resources.ts';
import type { SessionSkillProfile } from '@plotloom/contracts/skills';
import { createSkillTool, skillPrompt, type SkillSnapshot } from './skills.ts';
import { adaptBusinessTool, type RequestResources } from './request-resources.ts';
export type { RequestResources, BusinessTool } from './request-resources.ts';
export { AgentError, publicError } from './errors.ts';

export interface AgentOptions {
  dataDir: string;
  modelsPath?: string | null;
  defaultModel?: ModelSelection;
  apiKey?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  resolveSkills?: (sessionId: string, explicit: string[]) => Promise<SkillSnapshot[]>;
  resolveResources?: (sessionId: string, text: string) => Promise<RequestResources | undefined>;
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
  resources?: RequestResources;
}

/** 管理单进程中的会话实例；持久化权威记录始终是 SDK JSONL。 */
export class AgentService {
  readonly options: AgentOptions;
  readonly runtime: ModelRuntime;
  readonly cwd: string;
  readonly sessionDir: string;
  private readonly records = new Map<string, RecordState>();
  private selection: ModelSettings | undefined;
  private closing = false;

  private constructor(options: AgentOptions, runtime: ModelRuntime) {
    this.options = options;
    this.runtime = runtime;
    this.cwd = resolve(options.dataDir, 'workspace');
    this.sessionDir = resolve(options.dataDir, 'sessions');
  }

  /** 本机模型配置独立于个人 Pi 目录；默认选择落盘，不保存 API 密钥。 */
  static async create(options: AgentOptions): Promise<AgentService> {
    const agentDir = resolve(options.dataDir, 'agent');
    await mkdir(agentDir, { recursive: true });
    const runtime = await ModelRuntime.create({
      authPath: resolve(agentDir, 'auth.json'), modelsPath: options.modelsPath ?? null,
      modelsStorePath: resolve(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false,
    });
    if (runtime.getError()) throw new AgentError(422, 'MODEL_CONFIG_INVALID', '模型文件格式错误，请检查本机配置。');
    if (options.apiKey && options.defaultModel) await runtime.setRuntimeApiKey(options.defaultModel.provider, options.apiKey);
    const service = new AgentService(options, runtime);
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
    return this.runtime.getModels().map((model) => ({ provider: model.provider, id: model.id, name: model.name,
      configured: available.has(`${model.provider}\0${model.id}`), ...this.capabilities(model) }));
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
      configured: !!selected && !!this.runtime.getModel(selected.provider, selected.model) && !!(await this.runtime.getAuth(selected.provider)) };
  }

  private async requireModel(selection?: ModelSelection) {
    const model = this.registeredModel(selection);
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
    const manager = SessionManager.create(this.cwd, this.sessionDir);
    manager.appendModelChange(selection!.provider, selection!.model);
    manager.appendThinkingLevelChange(thinkingLevel);
    manager.appendSessionInfo(request.name?.trim() ?? 'Plotloom');
    if (profile) manager.appendCustomEntry('plotloom-session-skills', profile);
    const path = manager.getSessionFile()!;
    await writeFile(path, [manager.getHeader(), ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
    const record: RecordState = { manager: SessionManager.open(path, this.sessionDir), selection: selection!, stopRequested: false };
    this.records.set(manager.getSessionId(), record);
    return this.summary(record);
  }

  private summary(record: RecordState): SessionSummary {
    return { id: record.manager.getSessionId(), ...record.selection, status: record.job ? 'running' : 'idle',
      activity: record.activity ?? 'idle', name: record.manager.getSessionName() ?? 'Plotloom',
      thinkingLevel: (record.manager.buildSessionContext().thinkingLevel || 'off') as ThinkingLevel };
  }

  /** 在任何异步工作前占用会话，消息、配置和压缩共用同一互斥边界，结束时统一释放。 */
  private reserve(record: RecordState, activity: Exclude<SessionActivity, 'idle'>): () => void {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    if (record.job) throw new AgentError(409, 'SESSION_BUSY', '会话正在处理请求，请等待或停止。');
    const finished = Promise.withResolvers<void>();
    record.job = finished.promise;
    record.activity = activity;
    record.stopRequested = false;
    return () => { record.job = undefined; record.activity = undefined; finished.resolve(); };
  }

  /** ID 只能从服务管理的目录解析；客户端永远不能把路径交给 SessionManager.open。 */
  private async getRecord(id: string): Promise<RecordState> {
    const cached = this.records.get(id);
    if (cached) return cached;
    const listed = await SessionManager.list(this.cwd, this.sessionDir);
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

  async listSessions(): Promise<SessionListItem[]> {
    const files = await SessionManager.list(this.cwd, this.sessionDir);
    return Promise.all(files.map(async (file) => ({ ...this.summary(await this.getRecord(file.id)), updatedAt: file.modified.toISOString() })));
  }

  async getSession(id: string): Promise<SessionDetail> {
    const record = await this.getRecord(id);
    return { ...this.summary(record), messages: readMessages(record.manager, record.activeTurn, record.current) };
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
      capabilities: this.capabilities(this.registeredModel(record.selection)) };
  }

  /** 业务状态复用 SDK 元数据；仅供后端装配调用，不暴露任意元数据写入 HTTP 接口。 */
  async appendMetadata(id: string, kind: string, data: unknown): Promise<void> {
    (await this.getRecord(id)).manager.appendCustomEntry(kind, data);
  }
  async metadata(id: string, kind: string): Promise<unknown[]> {
    return (await this.getRecord(id)).manager.getEntries().flatMap(e => e.type === 'custom' && e.customType === kind ? [e.data] : []);
  }

  /** SDK 负责历史中的模型与思考条目；只影响当前会话，不改全局默认或复制消息。 */
  async setSessionConfig(id: string, request: SessionConfigRequest): Promise<SessionConfig> {
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'configuring');
    try {
      const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : record.selection;
      const model = await this.requireModel(selection);
      const thinking = this.thinking(model, request.thinkingLevel, this.summary(record).thinkingLevel);
      const session = await this.open(record);
      if (selection.provider !== record.selection.provider || selection.model !== record.selection.model) {
        await session.setModel(model);
        record.selection = selection;
      }
      session.setThinkingLevel(thinking);
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
      const model = this.registeredModel(record.selection);
      // 宿主业务资源接管默认演示提示与工具；普通会话仍保留 P1 的资料演示能力。
      const customTools = [...(this.options.tools ?? (record.resources ? [] : [createFixtureTool()])), ...(record.skills?.length ? [createSkillTool(record.skills)] : []), ...(record.resources?.tools.map(adaptBusinessTool) ?? [])];
      const prompt = record.resources ? (this.options.systemPrompt ?? '') + record.resources.systemPrompt : this.options.systemPrompt ?? SYSTEM_PROMPT;
      const { session } = await createAgentSession({
        cwd: this.cwd, agentDir: resolve(this.options.dataDir, 'agent'), modelRuntime: this.runtime, model,
        thinkingLevel: this.summary(record).thinkingLevel, sessionManager: record.manager,
        settingsManager: createSettings(), resourceLoader: createResources(prompt + skillPrompt(record.skills ?? [])),
        customTools, tools: customTools.map((tool) => tool.name),
      });
      record.session = session;
      return session;
    })().finally(() => { record.opening = undefined; });
    return record.opening;
  }

  /** 先验证、再原子占用会话，忙时不排队；返回执行入口供 HTTP 在写 SSE 头后启动。 */
  async prepareMessage(id: string, text: string, explicitSkills: string[] = [], resourcesFactory?: () => Promise<RequestResources>): Promise<(emit: (event: AgentEvent) => void) => Promise<void>> {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    const record = await this.getRecord(id);
    const release = this.reserve(record, 'generating');
    let session: AgentSession;
    let resources: RequestResources | undefined;
    try {
      await this.requireModel(record.selection);
      // 占用会话后才编译业务上下文，避免两个创作请求并发建立相互覆盖的资源。
      resources = resourcesFactory ? await resourcesFactory() : await this.options.resolveResources?.(id, text);
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
      record.activeTurn = record.manager.appendCustomEntry(TURN_START);
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
        if (event.type === 'auto_retry_start') emit({ type: 'retrying', sessionId: id, attempt: event.attempt, maxAttempts: event.maxAttempts });
        if (event.type === 'compaction_start' || event.type === 'compaction_end') emit({ type: 'compacting', sessionId: id, phase: event.type === 'compaction_start' ? 'start' : 'end' });
        if (event.type === 'agent_settled') aborted = event.aborted;
        if (record.stopRequested && event.type === 'message_start' && event.message.role === 'user') void session.abort();
      });
      try {
        await session.prompt(text);
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
    await this.runtime.settleCredentialWrites();
  }
}
