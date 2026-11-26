import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkspaceError, invalid } from '@plotloom/domain';
import type { PublicError, SessionActivity, AgentQuestion } from '@plotloom/contracts';
import type { ImMessage, ImSendRequest, WeixinAccount, WeixinAccountUpdate, WeixinLogin, WeixinLoginRequest, WeixinTarget } from '@plotloom/contracts/im';
import { maySelectWeixinTarget, selectWeixinTarget } from './weixin-target.ts';

interface TargetConversation { sessionId: string; lastConversationAt?: string }
interface GlobalConnection { target?: WeixinTarget; conversations: Record<string, TargetConversation> }
const targetKey = (target?: WeixinTarget) => target ? target.kind + ':' + target.id : 'general';

/** 私有通道状态只在后端流转；公开投影必须显式挑选字段。 */
export interface StoredWeixinAccount {
  id: string; botId: string; peerId: string; sessionId: string | null; enabled: boolean;
  token: string; baseUrl: string; cursor: string; contextToken?: string;
  createdAt: string; lastReceivedAt?: string; error?: PublicError; loginRequired?: boolean;
  idleSessionHours?: number | null; lastConversationAt?: string;
  global?: GlobalConnection;
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
  inspect(sessionId: string): Promise<{ activity: SessionActivity; question?: AgentQuestion }>;
  createFreshSession(sessionId: string): Promise<string>;
  listTargets(): Promise<WeixinTarget[]>;
  createTargetSession(target: WeixinTarget): Promise<string>;
  createGeneralSession(): Promise<string>;
  personaName(): Promise<string>;
  run(sessionId: string, text: string, notice: (text: string) => void, signal: AbortSignal): Promise<{ text: string; error?: PublicError; write?: ImWriteApproval }>;
  answer(sessionId: string, questionId: string, text: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
}
interface ImWriteApproval { preview: string; decide: (approve: boolean) => Promise<string> }
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
interface Connection {
  controller: AbortController; loop?: Promise<void>; tasks: Set<Promise<unknown>>;
  pendingWrite?: ImWriteApproval & { sessionId: string; ready: Promise<boolean> };
  writeRevision?: number;
}

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
      sessionId: account.sessionId, mode: account.global ? 'global' : 'fixed', target: account.global?.target,
      enabled: account.enabled, createdAt: account.createdAt, idleSessionHours: account.idleSessionHours ?? null,
      hasContext: !!account.contextToken, lastReceivedAt: account.lastReceivedAt, error: account.error,
      status: !account.enabled ? 'disabled' : account.loginRequired ? 'login_required' : account.error ? 'error'
        : this.connections.has(account.id) ? 'online' : 'connecting' };
  }

  private async account(id: string) {
    const account = (await this.store.read()).accounts.find(item => item.id === id);
    if (!account) throw new ImError('IM_ACCOUNT_NOT_FOUND', '微信连接不存在。', 404);
    return account;
  }

  async createLogin(input: WeixinLoginRequest): Promise<WeixinLogin> {
    this.assertOpen();
    const sessionId = input.sessionId ?? null;
    if (sessionId) await this.agent.inspect(sessionId);
    for (const [id, login] of this.logins) if (Date.parse(login.view.expiresAt) < Date.now()) this.logins.delete(id);
    const accounts = (await this.store.read()).accounts;
    const qr = await this.gateway.getQr(accounts.slice(-10).map(item => item.token), this.lifetime.signal);
    const view: WeixinLogin = { id: randomUUID(), sessionId, mode: input.mode ?? 'fixed', status: 'waiting', qrContent: qr.content,
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
        const requestedSession = login.view.sessionId;
        if (requestedSession) await this.agent.inspect(requestedSession);
        const accountId = await this.serial(async () => {
          this.assertOpen();
          const existing = (await this.store.read()).accounts.find(item => item.botId === result.botId);
          const accountId = existing?.id ?? randomUUID();
          // 先检查冲突再停止旧连接；失败的重绑不能中断仍有效的原绑定。
          if (requestedSession) this.checkSession(await this.store.read(), requestedSession, accountId);
          await this.disconnect(accountId);
          await this.store.update(state => {
            if (requestedSession) this.checkSession(state, requestedSession, accountId);
            const previous = state.accounts.find(item => item.id === accountId);
            const sameOwner = previous && previous.peerId === result.peerId ? previous : undefined;
            const global = login.view.mode === 'global' ? sameOwner?.global ?? { conversations: {} } : undefined;
            const sessionId = global ? global.conversations[targetKey(global.target)]?.sessionId ?? null : requestedSession;
            const account: StoredWeixinAccount = { id: accountId, botId: result.botId!, peerId: result.peerId!,
              token: result.token!, baseUrl: result.baseUrl!, sessionId, enabled: true, global,
              cursor: sameOwner?.cursor ?? '',
              idleSessionHours: sameOwner?.idleSessionHours,
              lastConversationAt: sameOwner?.sessionId === sessionId ? sameOwner?.lastConversationAt : undefined,
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
      // 单独保存会话策略时保留正在进行的对话和轮询。
      const bindingChanged = input.enabled !== undefined || input.sessionId !== undefined || (input.mode === 'global' && !previous.global);
      if (bindingChanged) await this.disconnect(id);
      await this.store.update(state => {
        const account = state.accounts.find(item => item.id === id)!;
        if (input.mode === 'global' && !account.global) {
          account.global = { conversations: {} }; account.sessionId = null; account.lastConversationAt = undefined;
        } else if (input.sessionId) {
          if (input.sessionId !== account.sessionId) account.lastConversationAt = undefined;
          account.sessionId = input.sessionId; account.global = undefined;
        }
        if (input.idleSessionHours !== undefined) account.idleSessionHours = input.idleSessionHours;
        account.enabled = input.enabled ?? account.enabled;
        if (bindingChanged && account.enabled && !account.loginRequired) account.error = undefined;
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
    if (state.accounts.some(item => item.id !== accountId && (item.sessionId === sessionId ||
      Object.values(item.global?.conversations ?? {}).some(conversation => conversation.sessionId === sessionId))))
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
    const persona = this.agent.personaName().catch(() => '');
    // 固定提示保留准确的状态和错误原因，只用平台人设名称标识说话者。
    const signature = async (text: string) => {
      const name = await persona;
      return name ? `${name}：${text}` : text;
    };
    const reply = async (text: string, suffix = 'reply', kind: ImMessage['kind'] = 'reply') =>
      this.sendText(id, kind === 'control' || suffix === 'error' ? await signature(text) : text, `${message.id}:${suffix}`, kind);
    try {
      await this.mark(message.id, 'processing');
      if (!supported) {
        await reply('当前微信接入支持文字消息，请用文字发送内容。', 'unsupported', 'control');
        await this.mark(message.id, 'failed', { code: 'IM_UNSUPPORTED_MESSAGE', message: '当前仅支持文字消息。' }); return;
      }
      // 同一批消息可跨过自动新建点，分发时读取最新绑定。
      const account = await this.account(id);
      if (message.sessionId !== account.sessionId) {
        message.sessionId = account.sessionId;
        await this.store.update(state => { state.messages.find(item => item.id === message.id)!.sessionId = account.sessionId; });
      }
      let text = message.text.trim();
      let sessionId = message.sessionId;
      let session = sessionId ? await this.agent.inspect(sessionId).catch(error => {
        if (account.global && error instanceof ImError && error.code === 'SESSION_NOT_FOUND') return undefined;
        throw error;
      }) : undefined;
      if (text === '/stop' || text === '停止') {
        connection.writeRevision = (connection.writeRevision ?? 0) + 1;
        if (sessionId && session) await this.agent.stop(sessionId);
        const pending = connection.pendingWrite;
        connection.pendingWrite = undefined;
        await reply(pending ? '已取消待确认文件变更。' : session ? '已停止当前会话生成。' : '当前没有运行中的会话。', 'stop', 'control');
      } else if (/^(批准|拒绝)[。！!]?$/u.test(text)) {
        // 决定属于当前连接和会话，不提交给模型，也不可能批准网页发起的实时请求。
        const pending = connection.pendingWrite;
        if (!pending || !session || pending.sessionId !== sessionId || !await pending.ready || connection.pendingWrite !== pending)
          throw new ImError('IM_APPROVAL_UNAVAILABLE', '当前没有可确认的微信文件变更。请等预览送出，或重新提出修改。', 409);
        signal.throwIfAborted();
        try {
          const result = await pending.decide(text.startsWith('批准'));
          connection.pendingWrite = undefined;
          await reply(result, 'decision', 'control');
        } catch (error) {
          if (!(error instanceof ImError && error.code === 'SESSION_BUSY')) connection.pendingWrite = undefined;
          throw error;
        }
      } else {
        if (connection.pendingWrite)
          throw new ImError('IM_APPROVAL_PENDING', '还有一项文件变更待确认，请回复「批准」或「拒绝」。', 409);
        const selection = account.global && !session?.question && maySelectWeixinTarget(text)
          ? selectWeixinTarget(text, await this.agent.listTargets()) : undefined;
        if (selection && 'reply' in selection) {
          await reply(selection.reply, 'targets', 'control');
          await this.mark(message.id, 'completed'); return;
        }
        if (!selection && sessionId && session?.question) {
          await this.agent.answer(sessionId, session.question.id, text);
          await this.mark(message.id, 'completed'); return;
        }
        if ((session && session.activity !== 'idle') || this.active.has(id))
          throw new ImError('SESSION_BUSY', '当前会话仍在处理，请稍后再发；发送“停止”可以终止。', 409);
        const target = selection ? selection.target : account.global?.target;
        const changed = !!selection && targetKey(target) !== targetKey(account.global?.target);
        if (selection) {
          text = selection.text;
          sessionId = account.global!.conversations[targetKey(selection.target)]?.sessionId ?? null;
          session = sessionId ? await this.agent.inspect(sessionId).catch(error => {
            if (error instanceof ImError && error.code === 'SESSION_NOT_FOUND') return undefined;
            throw error;
          }) : undefined;
          if (session && session.activity !== 'idle') throw new ImError('SESSION_BUSY', '目标会话仍在处理，请稍后再试。', 409);
        }
        if (!session) {
          if (!account.global) throw new ImError('IM_TARGET_REQUIRED', '请检查绑定会话。', 409);
          sessionId = target ? await this.agent.createTargetSession(target) : await this.agent.createGeneralSession();
        }
        if (!sessionId) throw new ImError('IM_TARGET_REQUIRED', '请先指定要聊的小说或项目。', 409);
        const current = await this.prepareConversation(account, message, signal, sessionId, target, !!text);
        const label = target ? `《${target.name}》` : '普通聊天';
        const prefix = changed ? `已切换到${label}。` : '';
        if (!text) {
          await reply(prefix || `当前会话：${label}。`, 'target', 'control');
          await this.mark(message.id, 'completed'); return;
        }
        this.active.add(id);
        const writeRevision = connection.writeRevision;
        let noticeIndex = 0;
        let notices = Promise.resolve();
        const run = (async () => {
          try {
            const result = await this.agent.run(current, text, notice => {
              const index = ++noticeIndex;
              notices = notices.then(async () => { if (!signal.aborted) await reply(notice, `notice-${index}`, 'control'); });
              // 工具回调不能抛出未处理拒绝；本轮结束时仍等待并记录发送失败。
              void notices.catch(() => {});
            }, signal);
            await notices;
            if (!signal.aborted && !this.closed && result.write && writeRevision === connection.writeRevision) {
              const write = result.write;
              const preview = (prefix ? prefix + '\n' : '') + write.preview + '\n\n文件尚未写入。回复「批准」执行，或回复「拒绝」取消。';
              const pending = { ...write, sessionId: current, ready: reply(preview, 'approval', 'control').catch(() => false) };
              connection.pendingWrite = pending;
              if (!await pending.ready && connection.pendingWrite === pending) connection.pendingWrite = undefined;
            } else if (!signal.aborted && !this.closed && !result.write) {
              const answer = result.error || !result.text
                ? await signature(result.error?.message || '本轮没有可发送的文字回复。') : result.text;
              await reply(prefix ? await signature(prefix) + '\n' + answer : answer);
            }
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

  /** 只在空闲后收到普通文字时开新会话。旧会话和微信凭据都保留。 */
  private async prepareConversation(account: StoredWeixinAccount, message: ImMessage, signal: AbortSignal,
    current: string, target: WeixinTarget | undefined, dialogue: boolean) {
    const hours = account.idleSessionHours;
    const key = targetKey(target);
    const previous = account.global?.conversations[key];
    const last = account.global ? (previous?.sessionId === current ? previous.lastConversationAt : undefined) : account.lastConversationAt;
    const elapsed = last ? Date.parse(message.createdAt) - Date.parse(last) : 0;
    const sessionId = dialogue && hours && elapsed >= hours * 3_600_000
      ? await this.agent.createFreshSession(current) : current;
    signal.throwIfAborted();
    await this.store.update(state => {
      const saved = state.accounts.find(item => item.id === account.id)!;
      this.checkSession(state, sessionId, account.id);
      saved.sessionId = sessionId;
      if (saved.global) {
        saved.global.target = target;
        saved.global.conversations[key] = { sessionId, lastConversationAt: dialogue ? message.createdAt : last };
      } else if (dialogue) saved.lastConversationAt = message.createdAt;
      state.messages.find(item => item.id === message.id)!.sessionId = sessionId;
    });
    message.sessionId = sessionId;
    return sessionId;
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
      if (sent.status !== 'accepted') return false;
    }
    return true;
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
