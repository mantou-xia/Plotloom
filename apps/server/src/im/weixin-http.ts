import { randomBytes } from 'node:crypto';
import { ImError, type StoredWeixinAccount, type WeixinGateway, type WeixinIncoming, type WeixinQrStatus } from '@plotloom/application/weixin';
import type { ImMessage } from '@plotloom/contracts/im';

const OFFICIAL_ORIGIN = 'https://ilinkai.weixin.qq.com';
const APP_HEADERS = { 'iLink-App-Id': 'bot', 'iLink-App-ClientVersion': String(3 << 16) };
const BASE_INFO = { channel_version: '3.0.0/plotloom-1.0.0', bot_agent: 'Plotloom/1.0.0' };
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;

/** 微信 uint64 消息 ID 不能先转成 JS number；利用 Node 24 的 JSON source 保留原始十进制文本。 */
function parseJson(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw, (key: string, value: unknown, context?: { source: string }) =>
    ['message_id', 'msg_id', 'svr_id'].includes(key) && typeof value === 'number' ? context?.source ?? String(value) : value);
  if (!object(value)) throw new ImError('IM_PROTOCOL_ERROR', '微信返回的数据格式无效。', 502, 'unknown');
  return value;
}

/** iLink HTTP 适配器；只有构造时显式注入的测试源或官方微信 HTTPS 源能接收凭据。 */
export class WeixinHttpClient implements WeixinGateway {
  private readonly origin: string;
  private readonly timeout: number;
  constructor(options: { origin?: string; timeoutMs?: number } = {}) {
    this.origin = options.origin ?? OFFICIAL_ORIGIN; this.timeout = options.timeoutMs ?? 15_000;
  }

  private base(value: string): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new ImError('IM_PROTOCOL_ERROR', '微信返回的服务地址无效。'); }
    const injected = this.origin !== OFFICIAL_ORIGIN && url.origin === new URL(this.origin).origin;
    const official = url.protocol === 'https:' && !url.port && (url.hostname === 'weixin.qq.com' || url.hostname.endsWith('.weixin.qq.com'));
    if ((!injected && !official) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname))
      throw new ImError('IM_PROTOCOL_ERROR', '微信返回了不受信任的服务地址，连接已停止。');
    return url.origin;
  }

  /** HTTP 重定向不自动携带 Authorization；所有底层正文只用于解析，错误响应使用固定文案。 */
  private async request(base: string, path: string, body: unknown | undefined, signal: AbortSignal, token?: string, timeout = this.timeout) {
    const headers: Record<string, string> = { ...APP_HEADERS };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'; headers.AuthorizationType = 'ilink_bot_token';
      headers['X-WECHAT-UIN'] = Buffer.from(String(randomBytes(4).readUInt32BE())).toString('base64');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    try {
      const response = await fetch(new URL(path, this.base(base)), { method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) });
      if (!response.ok) {
        // 只有明确的认证拒绝能确定请求失败；5xx/代理失败不能证明发送没有被上游接受。
        if (response.status === 401 || response.status === 403) throw new ImError('IM_LOGIN_REQUIRED', '微信凭据已失效或被拒绝，请重新扫码。', 409);
        throw new ImError('IM_UPSTREAM_HTTP', '微信接口返回异常状态，请稍后检查连接。', 502,
          response.status >= 500 ? 'unknown' : 'rejected');
      }
      const raw = await response.text();
      if (raw.length > 2 * 1024 * 1024) throw new ImError('IM_PROTOCOL_ERROR', '微信响应超过允许大小。', 502, 'unknown');
      return parseJson(raw);
    } catch (error) {
      if (error instanceof ImError) throw error;
      if (signal.aborted) throw new ImError('IM_CANCELLED', '微信请求已取消，发送结果需要核查。', 503, 'unknown');
      if (error instanceof Error && error.name === 'TimeoutError')
        throw new ImError('IM_REQUEST_TIMEOUT', '微信请求超时，无法确认发送结果，未自动重发。', 504, 'unknown');
      throw new ImError('IM_NETWORK_ERROR', '无法确认微信请求结果，请检查网络；系统不会自动重发消息。', 502, 'unknown');
    }
  }

  private check(result: Record<string, unknown>) {
    if (result.ret === -14 || result.errcode === -14) throw new ImError('IM_LOGIN_REQUIRED', '微信登录已失效，请重新扫码。', 409);
    if ((typeof result.ret === 'number' && result.ret !== 0) || (typeof result.errcode === 'number' && result.errcode !== 0))
      throw new ImError('IM_WEIXIN_REJECTED', '微信服务拒绝了请求；请检查连接，并由本人在微信发送一条消息后再尝试。');
  }

  async getQr(tokens: string[], signal: AbortSignal) {
    const result = await this.request(this.origin, '/ilink/bot/get_bot_qrcode?bot_type=3', { local_token_list: tokens }, signal);
    this.check(result);
    const code = string(result.qrcode); const content = string(result.qrcode_img_content);
    if (!code || !content) throw new ImError('IM_PROTOCOL_ERROR', '微信未返回有效二维码。');
    return { code, content, baseUrl: this.base(this.origin) };
  }

  async pollQr(code: string, baseUrl: string, pin: string | undefined, signal: AbortSignal): Promise<WeixinQrStatus> {
    const query = new URLSearchParams({ qrcode: code }); if (pin) query.set('verify_code', pin);
    let result: Record<string, unknown>;
    try { result = await this.request(baseUrl, `/ilink/bot/get_qrcode_status?${query}`, undefined, signal, undefined, 35_000); }
    catch (error) {
      if (error instanceof ImError && ['IM_NETWORK_ERROR', 'IM_REQUEST_TIMEOUT'].includes(error.code) && !signal.aborted) return { status: 'wait' };
      throw error;
    }
    this.check(result);
    const status = string(result.status);
    if (!status) throw new ImError('IM_PROTOCOL_ERROR', '微信登录状态无效。');
    const redirect = string(result.redirect_host);
    return { status, token: string(result.bot_token), botId: string(result.ilink_bot_id), peerId: string(result.ilink_user_id),
      baseUrl: string(result.baseurl) ? this.base(result.baseurl as string) : undefined,
      redirectBaseUrl: redirect ? this.base(`https://${redirect}`) : undefined };
  }

  async updates(account: StoredWeixinAccount, signal: AbortSignal) {
    let result: Record<string, unknown>;
    try {
      result = await this.request(account.baseUrl, '/ilink/bot/getupdates',
        { get_updates_buf: account.cursor, base_info: BASE_INFO }, signal, account.token, 40_000);
    } catch (error) {
      // 长轮询的正常超时由下一轮继续；其他网络失败仍进入状态与退避流程。
      if (!signal.aborted && error instanceof ImError && error.code === 'IM_REQUEST_TIMEOUT') return { cursor: account.cursor, messages: [] };
      throw error;
    }
    this.check(result);
    if (result.msgs !== undefined && !Array.isArray(result.msgs)) throw new ImError('IM_PROTOCOL_ERROR', '微信消息列表无效。');
    const messages: WeixinIncoming[] = [];
    for (const raw of (result.msgs as unknown[] | undefined) ?? []) {
      if (!object(raw) || raw.message_type !== 1 || raw.group_id) continue;
      if (raw.message_state !== undefined && raw.message_state !== 2) continue;
      const id = string(raw.message_id) ?? string(raw.client_id);
      const peerId = string(raw.from_user_id);
      if (!id || !peerId) continue;
      const items = Array.isArray(raw.item_list) ? raw.item_list : [];
      const supported = items.length > 0 && items.every(item => object(item) && item.type === 1 && object(item.text_item) && typeof item.text_item.text === 'string');
      const text = supported ? items.map(item => (item as { text_item: { text: string } }).text_item.text).join('\n') : '[非文字消息]';
      messages.push({ id, peerId, recipientId: string(raw.to_user_id), text,
        supported: supported && !!text.trim(), contextToken: string(raw.context_token) });
    }
    return { cursor: typeof result.get_updates_buf === 'string' ? result.get_updates_buf : account.cursor, messages };
  }

  async send(account: StoredWeixinAccount, message: ImMessage, signal: AbortSignal) {
    const result = await this.request(account.baseUrl, '/ilink/bot/sendmessage', { msg: {
      from_user_id: '', to_user_id: account.peerId, client_id: message.id, message_type: 2, message_state: 2,
      ...(account.contextToken ? { context_token: account.contextToken } : {}),
      item_list: [{ type: 1, text_item: { text: message.text } }],
    }, base_info: BASE_INFO }, signal, account.token);
    this.check(result);
    // 当前官方客户端允许缺 ret 的 JSON 响应；accepted 只沿用该协议接受口径，不表示手机送达。
  }
}
