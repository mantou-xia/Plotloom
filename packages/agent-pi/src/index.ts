import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createAgentSession, ModelRuntime, SessionManager,
  type AgentSession, type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type {
  AgentEvent, ModelConfig, ModelInfo, ModelSelection, SessionDetail, SessionListItem, SessionSummary, Outcome,
} from '@plotloom/contracts';
import { AgentError, modelFailure } from './errors.ts';
import { readMessages, TURN_START, TURN_END, turnUsage } from './messages.ts';
import { createFixtureTool, createResources, createSettings, SYSTEM_PROMPT } from './resources.ts';
export { AgentError, publicError } from './errors.ts';

export interface AgentOptions {
  dataDir: string;
  modelsPath?: string | null;
  defaultModel?: ModelSelection;
  apiKey?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
}
interface RecordState {
  manager: SessionManager;
  selection: ModelSelection;
  session?: AgentSession;
  opening?: Promise<AgentSession>;
  activeTurn?: string;
  current?: AgentSession['messages'][number];
  job?: Promise<void>;
  stopRequested: boolean;
}

/** 管理单进程中的会话实例；持久化权威记录始终是 SDK JSONL。 */
export class AgentService {
  readonly options: AgentOptions;
  readonly runtime: ModelRuntime;
  readonly cwd: string;
  readonly sessionDir: string;
  private readonly records = new Map<string, RecordState>();
  private selection: ModelSelection | undefined;
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
      configured: available.has(`${model.provider}\0${model.id}`) }));
  }

  async modelConfig(): Promise<ModelConfig> {
    const selected = this.selection;
    return { provider: selected?.provider ?? null, model: selected?.model ?? null,
      configured: !!selected && !!this.runtime.getModel(selected.provider, selected.model) && !!(await this.runtime.getAuth(selected.provider)) };
  }

  private async requireModel(selection?: ModelSelection) {
    if (!selection) throw new AgentError(422, 'MODEL_NOT_SELECTED', '请先选择默认模型。');
    const model = this.runtime.getModel(selection.provider, selection.model);
    if (!model) throw new AgentError(422, 'MODEL_NOT_FOUND', '指定模型尚未注册。');
    if (!(await this.runtime.getAuth(selection.provider))) throw new AgentError(422, 'MODEL_NOT_CONFIGURED', '指定模型未配置凭据。');
    return model;
  }

  async setModelConfig(selection: ModelSelection): Promise<ModelConfig> {
    await this.requireModel(selection);
    // 先写入完整临时文件再替换，重启不会读取半截 JSON。
    const path = resolve(this.options.dataDir, 'model-config.json');
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(selection), 'utf8');
    await rename(temporary, path);
    this.selection = selection;
    return this.modelConfig();
  }

  /** SDK 1.5.2 延迟到首条消息才写盘；用其公开头和条目初始化同一 JSONL，再交还 SDK。 */
  async createSession(selection = this.selection): Promise<SessionSummary> {
    await this.requireModel(selection);
    const manager = SessionManager.create(this.cwd, this.sessionDir);
    manager.appendModelChange(selection!.provider, selection!.model);
    manager.appendSessionInfo('Plotloom');
    const path = manager.getSessionFile()!;
    await writeFile(path, [manager.getHeader(), ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
    const record: RecordState = { manager: SessionManager.open(path, this.sessionDir), selection: selection!, stopRequested: false };
    this.records.set(manager.getSessionId(), record);
    return this.summary(record);
  }

  private summary(record: RecordState): SessionSummary {
    return { id: record.manager.getSessionId(), ...record.selection, status: record.job ? 'running' : 'idle' };
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

  private async open(record: RecordState): Promise<AgentSession> {
    if (record.session) return record.session;
    if (!record.opening) record.opening = (async () => {
      const model = await this.requireModel(record.selection);
      const customTools = this.options.tools ?? [createFixtureTool()];
      const { session } = await createAgentSession({
        cwd: this.cwd, agentDir: resolve(this.options.dataDir, 'agent'), modelRuntime: this.runtime, model,
        thinkingLevel: 'off', sessionManager: record.manager,
        settingsManager: createSettings(), resourceLoader: createResources(this.options.systemPrompt ?? SYSTEM_PROMPT),
        customTools, tools: customTools.map((tool) => tool.name),
      });
      record.session = session;
      return session;
    })().finally(() => { record.opening = undefined; });
    return record.opening;
  }

  /** 先验证、再原子占用会话，忙时不排队；返回执行入口供 HTTP 在写 SSE 头后启动。 */
  async prepareMessage(id: string, text: string): Promise<(emit: (event: AgentEvent) => void) => Promise<void>> {
    if (this.closing) throw new AgentError(503, 'SERVER_CLOSING', '服务正在关闭。');
    const record = await this.getRecord(id);
    if (record.job) throw new AgentError(409, 'SESSION_BUSY', '会话正在生成，请等待或停止。');
    const session = await this.open(record);
    await this.requireModel(record.selection);
    if (record.job) throw new AgentError(409, 'SESSION_BUSY', '会话正在生成，请等待或停止。');
    const finished = Promise.withResolvers<void>();
    record.activeTurn = record.manager.appendCustomEntry(TURN_START);
    record.job = finished.promise;
    record.stopRequested = false;
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
          record.manager.appendCustomEntry(TURN_END, { turnId: record.activeTurn, outcome });
        } catch {
          outcome = 'failed';
        }
        record.current = undefined;
        record.activeTurn = undefined;
        record.job = undefined;
        finished.resolve();
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
