import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

export const WEIXIN_SECRET = 'test-weixin-token-must-not-leak';
export const WEIXIN_CONTEXT = 'test-weixin-context-must-not-leak';
type LoginSetup = { botId?: string; peerId?: string; steps?: string[]; baseUrl?: string; redirectHost?: string };

/** 只替换微信网络协议，扫码、持久化、Agent、工具与 HTTP 入口全部使用生产实现。 */
export async function createWeixinFixture() {
  const requests: Array<{ path: string; body: any; headers: Record<string, unknown> }> = [];
  const sends: Array<{ token: string; body: any }> = [];
  const errors: unknown[] = [];
  const logins = new Map<string, { botId: string; peerId: string; token: string; steps: string[]; setup: LoginSetup }>();
  const messages = new Map<string, any[]>();
  const cursors = new Map<string, number>();
  const updateFailures = new Map<string, number>();
  const held = new Set<ServerResponse>();
  let next: LoginSetup = {};
  let mode: 'ok' | 'reject' | 'drop' | 'hold' | 'invalid' | 'http-fail' = 'ok';
  let counter = 0;
  let origin = '';
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, origin);
      request.setEncoding('utf8'); let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ path: url.pathname, body, headers: { ...request.headers } });
      const send = (data: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
      assert.equal(request.headers['ilink-app-id'], 'bot');
      assert.equal(request.headers['ilink-app-clientversion'], String(3 << 16));
      if (url.pathname === '/ilink/bot/get_bot_qrcode') {
        assert.equal(request.method, 'POST'); assert.equal(url.searchParams.get('bot_type'), '3');
        assert.equal(request.headers.authorization, undefined); assert(Array.isArray(body.local_token_list));
        assert.equal(body.base_info, undefined);
        const code = `qr-${++counter}`; const setup = next; next = {};
        logins.set(code, { botId: setup.botId ?? `bot-${counter}@im.bot`, peerId: setup.peerId ?? `owner-${counter}@im.wechat`,
          token: `${WEIXIN_SECRET}-${counter}`, steps: [...setup.steps ?? ['confirmed']], setup });
        send({ qrcode: code, qrcode_img_content: `https://weixin.qq.com/${code}` }); return;
      }
      if (url.pathname === '/ilink/bot/get_qrcode_status') {
        assert.equal(request.method, 'GET'); assert.equal(request.headers.authorization, undefined);
        assert.equal(request.headers.authorizationtype, undefined);
        const login = logins.get(url.searchParams.get('qrcode')!); assert(login);
        const status = login.steps.shift() ?? 'confirmed';
        if (url.searchParams.has('verify_code')) assert.equal(url.searchParams.get('verify_code'), '001234');
        send({ status, ...(status === 'confirmed' ? { bot_token: login.token, ilink_bot_id: login.botId,
          ilink_user_id: login.peerId, baseurl: login.setup.baseUrl ?? origin } : {}),
          ...(login.setup.redirectHost ? { redirect_host: login.setup.redirectHost } : {}) }); return;
      }
      const token = String(request.headers.authorization ?? '').replace(/^Bearer /, '');
      assert(token.startsWith(WEIXIN_SECRET)); assert.equal(request.headers.authorizationtype, 'ilink_bot_token');
      assert.match(Buffer.from(String(request.headers['x-wechat-uin']), 'base64').toString(), /^\d+$/);
      assert.equal(body.base_info.bot_agent, 'Plotloom/1.0.0');
      assert.match(body.base_info.channel_version, /^3\.0\.0/);
      if (url.pathname === '/ilink/bot/getupdates') {
        const failure = updateFailures.get(token);
        if (failure) { updateFailures.delete(token); send({ ret: failure, errmsg: WEIXIN_SECRET }); return; }
        const batch = messages.get(token) ?? []; messages.set(token, []);
        if (batch.length) cursors.set(token, (cursors.get(token) ?? 0) + 1);
        else await delay(50);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        // 把标记改成真实 uint64 数字，检验 JSON.parse 之前没有精度丢失。
        response.end(JSON.stringify({ ret: 0, msgs: batch, get_updates_buf: String(cursors.get(token) ?? 0) })
          .replaceAll('"9007199254740993123"', '9007199254740993123'));
        return;
      }
      if (url.pathname === '/ilink/bot/sendmessage') {
        sends.push({ token, body });
        assert.equal(body.msg.message_type, 2); assert.equal(body.msg.message_state, 2);
        const current = mode; mode = 'ok';
        if (current === 'reject') { send({ ret: 110, errmsg: `${WEIXIN_SECRET} private upstream detail` }); return; }
        if (current === 'drop') { response.destroy(); return; }
        if (current === 'invalid') { response.end('not json ' + WEIXIN_SECRET); return; }
        if (current === 'http-fail') { send({ error: WEIXIN_SECRET }, 503); return; }
        if (current === 'hold') { held.add(response); response.on('close', () => held.delete(response)); return; }
        send({ ret: 0 }); return;
      }
      send({ error: 'unknown fixture route' }, 404);
    } catch (error) { errors.push(error); response.destroy(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  return {
    origin, requests, sends, errors,
    nextLogin(setup: LoginSetup) { next = setup; },
    loginFor(botId: string) { return [...logins.values()].findLast(login => login.botId === botId)!; },
    sendMode(value: typeof mode) { mode = value; },
    updateError(token: string, code: number) { updateFailures.set(token, code); },
    inbound(token: string, input: { id: string; text?: string; peerId?: string; recipientId?: string; items?: unknown[]; type?: number; groupId?: string }) {
      const login = [...logins.values()].find(login => login.token === token); assert(login);
      const message = { message_id: input.id, from_user_id: input.peerId ?? login.peerId, to_user_id: input.recipientId ?? login.botId,
        message_type: input.type ?? 1, message_state: 2, group_id: input.groupId, context_token: WEIXIN_CONTEXT,
        item_list: input.items ?? [{ type: 1, text_item: { text: input.text ?? '' } }] };
      messages.set(token, [...messages.get(token) ?? [], message]);
    },
    releaseSends() { for (const response of held) { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"ret":0}'); } held.clear(); },
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}

export async function eventually<T>(read: () => Promise<T> | T, condition: (value: T) => boolean, label: string, timeout = 10_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await read(); if (condition(value)) return value;
    await delay(30);
  }
  throw new Error(`等待超时：${label}`);
}
