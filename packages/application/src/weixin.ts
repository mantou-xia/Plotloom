import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkspaceError, invalid } from '@plotloom/domain';
import type { PublicError, SessionActivity, AgentQuestion, ToolApproval } from '@plotloom/contracts';
import type { ImMessage, ImSendRequest, WeixinAccount, WeixinAccountUpdate, WeixinLogin } from '@plotloom/contracts/im';

/** 私有通道状态只在后端流转；公开投影必须显式挑选字段。 */
export interface StoredWeixinAccount {
  id: string; botId: string; peerId: string; sessionId: string; enabled: boolean;
  token: string; baseUrl: string; cursor: string; contextToken?: string;
  createdAt: string; lastReceivedAt?: string; error?: PublicError; loginRequired?: boolean;
}
export interface StoredImMessage extends ImMessage { upstreamId?: string }
export interface WeixinState { accounts: StoredWeixinAccount[]; messages: StoredImMessage[] }
export interface WeixinStore {
  read(): Promise<WeixinState>;
  /** 事务回调内只改内存；提交成功之后才返回，禁止把网络请求放进事务。 */
  update<T>(change: (state: WeixinState) => T): Promise<T>;
}
export interface WeixinIncoming {
  id: string; peerId: string; recipientId?: string; text: string; supported: boolean; contextToken?: string;
}
export interface WeixinQrStatus {
  status: string; token?: string; botId?: string; peerId?: string; baseUrl?: string; redirectBaseUrl?: string;
}
export interface WeixinGateway {
  getQr(tokens: string[], signal: AbortSignal): Promise<{ code: string; content: string; baseUrl: string }>;
  pollQr(code: string, baseUrl: string, pin: string | undefined, signal: AbortSignal): Promise<WeixinQrStatus>;
  updates(account: StoredWeixinAccount, signal: AbortSignal): Promise<{ cursor: string; messages: WeixinIncoming[] }>;
  send(account: StoredWeixinAccount, message: ImMessage, signal: AbortSignal): Promise<void>;
}
export interface ImAgent {
  inspect(sessionId: string): Promise<{ activity: SessionActivity; question?: AgentQuestion; approvals?: ToolApproval[] }>;
  run(sessionId: string, text: string, notice: (text: string) => void, signal: AbortSignal): Promise<{ text: string; error?: PublicError }>;
  answer(sessionId: string, questionId: string, text: string): Promise<void>;
  approve(sessionId: string, approvalId: string, approve: boolean): Promise<void>;
  stop(sessionId: string): Promise<void>;
}
export class ImError extends WorkspaceError {
  readonly disposition: 'rejected' | 'unknown';
  constructor(code: string, message: string, statusCode = 502, disposition: 'rejected' | 'unknown' = 'rejected') {
    super(code, message, statusCode); this.disposition = disposition;
  }
}
const now = () => new Date().toISOString();
const errorInfo = (error: unknown): PublicError => error instanceof WorkspaceError
  ? { code: error.code, message: error.message }
  : { code: 'IM_OPERATION_FAILED', message: '微信通道操作失败，请在平台查看状态后重试。' };
const viewMessage = ({ upstreamId: _, ...message }: StoredImMessage): ImMessage => message;
interface LoginState { view: WeixinLogin; code: string; baseUrl: string; polling: boolean }
interface Connection { controller: AbortController; loop?: Promise<void>; tasks: Set<Promise<unknown>> }

/** 同一通道只接收扫码者本人；收发与 Agent 通过端口组合，不依赖页面或 Pi SDK。 */
export class WeixinService {
  private readonly store: WeixinStore;
  private readonly gateway: WeixinGateway;
  private readonly agent: ImAgent;
  private readonly logins = new Map<string, LoginState>();
  private readonly connections = new Map<string, Connection>();
  private readonly active = new Set<string>();
  private readonly lifetime = new AbortController();
  private mutation: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(store: WeixinStore, gateway: WeixinGateway, agent: ImAgent) {
    this.store = store; this.gateway = gateway; this.agent = agent;
  }

  /** 重启不重放产生过业务副作用的消息；发送中的记录无法证明送达，明确标为 unknown。 */
  async start() {
    await this.store.update(state => {
      for (const message of state.messages) {
        if (message.status === 'sending') {
          message.status = 'unknown'; message.error = { code: 'IM_SEND_UNKNOWN', message: '进程在发送期间退出，无法确认微信是否接受，未自动重发。' }; message.updatedAt = now();
        } else if (message.status === 'processing' || message.status === 'received') {
          message.status = 'interrupted'; message.error = { code: 'IM_PROCESS_INTERRUPTED', message: '处理被服务重启中断，请检查会话记录后再决定是否重试。' }; message.updatedAt = now();
        }
      }
    });
    for (const account of (await this.store.read()).accounts) if (account.enabled && !account.loginRequired) this.connect(account.id);
  }

  async list(): Promise<WeixinAccount[]> {
    return (await this.store.read()).accounts.map(account => this.view(account));
  }

  private view(account: StoredWeixinAccount): WeixinAccount {
    return { id: account.id, channel: 'weixin', botId: account.botId, peerId: account.peerId,
      sessionId: account.sessionId, enabled: account.enabled, createdAt: account.createdAt,
      hasContext: !!account.contextToken, lastReceivedAt: account.lastReceivedAt, error: account.error,
      status: !account.enabled ? 'disabled' : account.loginRequired ? 'login_required' : account.error ? 'error'
        : this.connections.has(account.id) ? 'online' : 'connecting' };
  }

  private async account(id: string) {
    const account = (await this.store.read()).accounts.find(item => item.id === id);
    if (!account) throw new ImError('IM_ACCOUNT_NOT_FOUND', '微信连接不存在。', 404);
    return account;
  }

  async createLogin(sessionId: string): Promise<WeixinLogin> {
    this.assertOpen(); await this.agent.inspect(sessionId);
    for (const [id, login] of this.logins) if (Date.parse(login.view.expiresAt) < Date.now()) this.logins.delete(id);
    const accounts = (await this.store.read()).accounts;
    const qr = await this.gateway.getQr(accounts.slice(-10).map(item => item.token), this.lifetime.signal);
    const view: WeixinLogin = { id: randomUUID(), sessionId, status: 'waiting', qrContent: qr.content,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
    this.logins.set(view.id, { view, code: qr.code, baseUrl: qr.baseUrl, polling: false });
    return { ...view };
  }

  /** PIN 只用于这一次官方轮询，不保存、不写日志；二维码凭据也不进入公开消息记录。 */
  async pollLogin(id: string, pin?: string): Promise<WeixinLogin> {
    this.assertOpen();
    const login = this.logins.get(id);
    if (!login) throw new ImError('IM_LOGIN_NOT_FOUND', '扫码请求不存在或服务已重启，请重新获取二维码。', 404);
    if (['confirmed', 'expired', 'already_bound'].includes(login.view.status)) return { ...login.view };
    if (Date.parse(login.view.expiresAt) < Date.now()) { login.view.status = 'expired'; return { ...login.view }; }
    if (login.polling) throw new ImError('IM_LOGIN_BUSY', '已有扫码查询正在等待，请勿重复提交。', 409);
    login.polling = true;
    try {
      const result = await this.gateway.pollQr(login.code, login.baseUrl, pin, this.lifetime.signal);
      if (result.status === 'confirmed') {
        if (!result.botId || !result.peerId || !result.token || !result.baseUrl)
          throw new ImError('IM_PROTOCOL_ERROR', '微信登录返回缺少必要账号信息，请重新扫码。');
        await this.agent.inspect(login.view.sessionId);
        const accountId = await this.serial(async () => {
          this.assertOpen();
          const existing = (await this.store.read()).accounts.find(item => item.botId === result.botId);
          const accountId = existing?.id ?? randomUUID();
          // 先检查冲突再停止旧连接；失败的重绑不能中断仍有效的原绑定。
          this.checkSession(await this.store.read(), login.view.sessionId, accountId);
          await this.disconnect(accountId);
          await this.store.update(state => {
            this.checkSession(state, login.view.sessionId, accountId);
            const previous = state.accounts.find(item => item.id === accountId);
            const account: StoredWeixinAccount = { id: accountId, botId: result.botId!, peerId: result.peerId!,
              token: result.token!, baseUrl: result.baseUrl!, sessionId: login.view.sessionId, enabled: true,
              cursor: previous && previous.peerId === result.peerId ? previous.cursor : '',
              createdAt: previous?.createdAt ?? now() };
            state.accounts = state.accounts.filter(item => item.id !== accountId); state.accounts.push(account);
          });
          this.connect(accountId);
          return accountId;
        });
        login.view.status = 'confirmed'; login.view.accountId = accountId;
      } else if (result.status === 'scaned_but_redirect') {
        if (!result.redirectBaseUrl) throw new ImError('IM_PROTOCOL_ERROR', '微信未返回有效的登录重定向地址。');
        login.baseUrl = result.redirectBaseUrl; login.view.status = 'scanned';
      } else if (result.status.includes('need_verifycode')) login.view.status = 'pin_required';
      else if (result.status === 'scaned') login.view.status = 'scanned';
      else if (['expired', 'verify_code_blocked'].includes(result.status)) login.view.status = 'expired';
      else if (result.status === 'binded_redirect') login.view.status = 'already_bound';
      return { ...login.view };
    } finally { login.polling = false; }
  }

  /** 变更绑定先停轮询和本通道发起的生成，旧任务不能把结果发到新会话。 */
  updateAccount(id: string, input: WeixinAccountUpdate): Promise<WeixinAccount> {
    return this.serial(async () => {
      this.assertOpen(); const previous = await this.account(id);
      if (input.sessionId) {
        await this.agent.inspect(input.sessionId);
        this.checkSession(await this.store.read(), input.sessionId, id);
      }
      await this.disconnect(id);
      await this.store.update(state => {
        const account = state.accounts.find(item => item.id === id)!;
        account.sessionId = input.sessionId ?? account.sessionId;
        account.enabled = input.enabled ?? account.enabled;
        if (account.enabled && !account.loginRequired) account.error = undefined;
      });
      const account = await this.account(previous.id);
      if (account.enabled && !account.loginRequired) this.connect(id);
      return this.view(account);
    });
  }

  removeAccount(id: string): Promise<{ removed: true }> {
    return this.serial(async () => {
      this.assertOpen(); await this.account(id); await this.disconnect(id);
      await this.store.update(state => {
        state.accounts = state.accounts.filter(item => item.id !== id);
        state.messages = state.messages.filter(item => item.accountId !== id);
      });
      return { removed: true };
    });
  }

  async messages(id: string): Promise<ImMessage[]> {
    await this.account(id);
    return (await this.store.read()).messages.filter(item => item.accountId === id).slice(-100).map(viewMessage);
  }

  /** 调用方提供稳定幂等键；accepted、rejected、unknown 都是已有尝试，不自动再次发送。 */
  send(id: string, input: ImSendRequest, kind: ImMessage['kind'] = 'notification'): Promise<ImMessage> {
    this.assertOpen();
    const connection = this.connections.get(id);
    // 在首个异步读盘前登记任务，使停用、改绑和删除都会等待该次发送收尾。
    const operation = this.sendAttempt(id, input, kind, connection);
    if (connection) this.track(connection, operation);
    return operation;
  }

  private async sendAttempt(id: string, input: ImSendRequest, kind: ImMessage['kind'], connection?: Connection): Promise<ImMessage> {
    if (!input.text.trim() || !input.text.isWellFormed() || input.text.includes('\0') || Buffer.byteLength(input.text, 'utf8') > 4000)
      invalid('微信消息必须是有效非空文字，UTF-8 长度不能超过 4000 字节。');
    const attempt = await this.store.update(state => {
      const account = state.accounts.find(item => item.id === id);
      if (!account) throw new ImError('IM_ACCOUNT_NOT_FOUND', '微信连接不存在。', 404);
      const prior = state.messages.find(item => item.accountId === id && item.direction === 'outbound' && item.requestId === input.requestId);
      if (prior) {
        if (prior.text !== input.text || prior.kind !== kind) throw new ImError('IM_IDEMPOTENCY_CONFLICT', '同一 requestId 已用于不同消息。', 409);
        return { message: viewMessage(prior) };
      }
      if (!account.enabled) throw new ImError('IM_ACCOUNT_DISABLED', '微信连接已停用，请先启用。', 409);
      if (account.loginRequired) throw new ImError('IM_LOGIN_REQUIRED', '微信凭据已失效，请重新扫码。', 409);
      if (!connection || connection.controller.signal.aborted || connection !== this.connections.get(id))
        throw new ImError('IM_CONNECTION_STOPPED', '微信连接已停止，消息未发出。', 409);
      const message: StoredImMessage = { id: randomUUID(), accountId: id, sessionId: account.sessionId,
        direction: 'outbound', kind, text: input.text, requestId: input.requestId,
        status: 'sending', createdAt: now(), updatedAt: now() };
      state.messages.push(message); return { message: viewMessage(message), account };
    });
    const { message, account } = attempt;
    if (!account) return message;
    try {
      if (!connection || connection.controller.signal.aborted) throw new ImError('IM_CONNECTION_STOPPED', '微信连接已停止，消息未发出。', 409);
      await this.gateway.send(account, message, connection.controller.signal);
      return await this.mark(message.id, 'accepted');
    } catch (error) {
      if (error instanceof ImError && error.code === 'IM_LOGIN_REQUIRED') await this.setAccountError(id, error);
      return await this.mark(message.id, error instanceof ImError ? error.disposition : 'unknown', errorInfo(error));
    }
  }

  private checkSession(state: WeixinState, sessionId: string, accountId: string) {
    if (state.accounts.some(item => item.id !== accountId && item.sessionId === sessionId))
      throw new ImError('IM_SESSION_BOUND', '该会话已绑定另一个微信连接，请选择独立会话。', 409);
  }
  private assertOpen() { if (this.closed) throw new ImError('IM_CLOSING', '微信服务正在关闭。', 503); }
  /** 所有绑定修改共用一个串行边界，避免两个账号同时改绑到同一会话。消息收发不占用此锁。 */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const operation = this.mutation.then(task);
    this.mutation = operation.catch(() => {});
    return operation;
  }
  private track(connection: Connection, task: Promise<unknown>) {
    connection.tasks.add(task);
    void task.finally(() => connection.tasks.delete(task)).catch(() => {});
  }
  private async mark(id: string, status: ImMessage['status'], error?: PublicError): Promise<ImMessage> {
    return this.store.update(state => {
      const message = state.messages.find(item => item.id === id)!;
      message.status = status; message.updatedAt = now(); message.error = error;
      return viewMessage(message);
    });
  }
  private async setAccountError(id: string, error: unknown) {
    await this.store.update(state => {
      const account = state.accounts.find(item => item.id === id);
      if (!account) return;
      account.error = errorInfo(error);
      if (account.error.code === 'IM_LOGIN_REQUIRED') account.loginRequired = true;
    });
  }
  private connect(id: string) {
    if (this.closed || this.connections.has(id)) return;
    const connection: Connection = { controller: new AbortController(), tasks: new Set() };
    this.connections.set(id, connection);
    connection.loop = this.poll(id, connection).catch(async error => { await this.setAccountError(id, error); });
  }

  /** 游标和入站日志在一个事务提交后才执行 Agent；长生成不会阻断提问回答和停止消息的接收。 */
  private async poll(id: string, connection: Connection) {
    const signal = connection.controller.signal;
    while (!signal.aborted && !this.closed) {
      try {
        const account = await this.account(id);
        if (!account.enabled || account.loginRequired) break;
        const batch = await this.gateway.updates(account, signal);
        if (signal.aborted || this.closed) break;
        const received = await this.store.update(state => {
          const saved = state.accounts.find(item => item.id === id)!;
          saved.cursor = batch.cursor; saved.error = undefined;
          const result: Array<{ message: ImMessage; supported: boolean }> = [];
          for (const incoming of batch.messages) {
            if (incoming.peerId !== saved.peerId || (incoming.recipientId && incoming.recipientId !== saved.botId)) continue;
            if (incoming.contextToken) saved.contextToken = incoming.contextToken;
            if (state.messages.some(item => item.accountId === id && item.upstreamId === incoming.id)) continue;
            const message: StoredImMessage = { id: randomUUID(), upstreamId: incoming.id, accountId: id,
              sessionId: saved.sessionId, direction: 'inbound', kind: 'user', text: incoming.text,
              status: 'received', createdAt: now(), updatedAt: now() };
            saved.lastReceivedAt = message.createdAt; state.messages.push(message);
            result.push({ message: viewMessage(message), supported: incoming.supported });
          }
          return result;
        });
        for (const { message, supported } of received) {
          if (signal.aborted || this.closed) break;
          await this.dispatch(message, supported, connection);
        }
        // 官方是长轮询；空响应提前返回时留出间隔，避免错误代理造成紧循环。
        await delay(250, undefined, { signal });
      } catch (error) {
        if (signal.aborted || this.closed) break;
        await this.setAccountError(id, error);
        if (error instanceof ImError && error.code === 'IM_LOGIN_REQUIRED') break;
        await delay(2000, undefined, { signal }).catch(() => {});
      }
    }
  }

  private async dispatch(message: ImMessage, supported: boolean, connection: Connection) {
    const id = message.accountId;
    const signal = connection.controller.signal;
    const reply = (text: string, suffix = 'reply', kind: ImMessage['kind'] = 'reply') =>
      this.sendText(id, text, `${message.id}:${suffix}`, kind);
    try {
      await this.mark(message.id, 'processing');
      if (!supported) {
        await reply('当前微信接入支持文字消息，请用文字发送内容。');
        await this.mark(message.id, 'failed', { code: 'IM_UNSUPPORTED_MESSAGE', message: '当前仅支持文字消息。' }); return;
      }
      const text = message.text.trim();
      const session = await this.agent.inspect(message.sessionId);
      if (text === '/stop' || text === '停止') {
        await this.agent.stop(message.sessionId); await reply('已停止当前会话生成。', 'stop', 'control');
      } else if (/^(批准|拒绝)\s+/.test(text)) {
        const [, command, approvalId] = /^(批准|拒绝)\s+(\S+)$/.exec(text) ?? [];
        if (!approvalId || !session.approvals?.some(item => item.id === approvalId))
          throw new ImError('IM_APPROVAL_UNAVAILABLE', '该审批已结束或编号不正确，请使用最新提示中的完整指令。', 409);
        await this.agent.approve(message.sessionId, approvalId, command === '批准');
      } else if (session.question) {
        await this.agent.answer(message.sessionId, session.question.id, text);
      } else if (session.activity !== 'idle' || this.active.has(id)) {
        await reply('当前会话仍在处理，请稍后再发；发送“停止”可以终止。', 'busy', 'control');
        await this.mark(message.id, 'failed', { code: 'SESSION_BUSY', message: '会话正在处理，该消息未提交给 Agent。' }); return;
      } else {
        this.active.add(id);
        let noticeIndex = 0;
        let notices = Promise.resolve();
        const run = (async () => {
          try {
            const result = await this.agent.run(message.sessionId, text, notice => {
              const index = ++noticeIndex;
              notices = notices.then(async () => { if (!signal.aborted) await reply(notice, `notice-${index}`, 'control'); });
              // 工具回调不能抛出未处理拒绝；本轮结束时仍等待并记录发送失败。
              void notices.catch(() => {});
            }, signal);
            await notices;
            if (!signal.aborted && !this.closed) await reply(result.text || result.error?.message || '本轮没有可发送的文字回复。');
            await this.mark(message.id, signal.aborted ? 'interrupted' : result.error ? 'failed' : 'completed', result.error);
          } catch (error) {
            await this.mark(message.id, signal.aborted ? 'interrupted' : 'failed', errorInfo(error));
            if (!signal.aborted && !this.closed) await reply(errorInfo(error).message, 'error');
          } finally { this.active.delete(id); }
        })();
        this.track(connection, run); return;
      }
      await this.mark(message.id, 'completed');
    } catch (error) {
      await this.mark(message.id, signal.aborted ? 'interrupted' : 'failed', errorInfo(error));
      if (!signal.aborted && !this.closed) await reply(errorInfo(error).message, 'error');
    }
  }

  /** 微信文字按 UTF-8 字节分块，不切开中文或 emoji；每块有独立且稳定的幂等键。 */
  private async sendText(id: string, text: string, requestId: string, kind: ImMessage['kind']) {
    const chunks: string[] = []; let current = ''; let bytes = 0;
    for (const character of text) {
      const length = Buffer.byteLength(character);
      if (bytes + length > 4000) { chunks.push(current); current = ''; bytes = 0; }
      current += character; bytes += length;
    }
    if (current.trim()) chunks.push(current);
    for (const [index, chunk] of chunks.entries()) {
      const sent = await this.send(id, { requestId: `${requestId}:${index}`, text: chunk }, kind);
      if (sent.status !== 'accepted') break;
    }
  }

  private async disconnect(id: string) {
    const connection = this.connections.get(id);
    if (!connection) return;
    connection.controller.abort();
    await connection.loop;
    await Promise.allSettled([...connection.tasks]);
    this.connections.delete(id);
  }

  /** 关闭先取消收发和由本通道发起的生成，再等待日志落盘，不留下悬挂轮询。 */
  async close() {
    this.closed = true; this.lifetime.abort();
    await this.mutation;
    await Promise.all([...this.connections.keys()].map(id => this.disconnect(id)));
    this.logins.clear();
  }
}
