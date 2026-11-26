import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createModelFixture, TEST_KEY } from './fixture.ts';
import { startServer } from './client.ts';
import { createWeixinFixture, eventually, WEIXIN_SECRET, WEIXIN_CONTEXT } from './weixin-fixture.ts';
import type { ImMessage, WeixinAccount, WeixinLogin } from '../../packages/contracts/src/im.ts';

test('微信 IM 独立 HTTP：扫码、Agent 收发、主动触达及重启恢复', { timeout: 120_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-weixin-'));
  const project = join(directory, 'project'); await mkdir(project);
  const model = await createModelFixture(); const wire = await createWeixinFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { 'p1-test': { api: 'openai-completions', baseUrl: model.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const env = { PLOTLOOM_DATA_DIR: join(directory, 'data'), PLOTLOOM_MODELS_PATH: modelsPath,
    PLOTLOOM_API_KEY: TEST_KEY, PLOTLOOM_TEST_WEIXIN_ORIGIN: wire.origin };
  const launch = () => startServer(env, 15_000, new URL('./weixin-server.ts', import.meta.url));
  let server = await launch();
  const api = '/api/im/weixin';
  let accountId = ''; let sessionId = ''; let token = ''; let loginId = '';
  const listMessages = async () => (await server.json<{ messages: ImMessage[] }>(`${api}/accounts/${accountId}/messages`)).messages;
  const accounts = async () => (await server.json<{ accounts: WeixinAccount[] }>(api + '/accounts')).accounts;
  const send = (requestId: string, text: string, status = 200) => server.json<ImMessage>(`${api}/accounts/${accountId}/messages`, 'POST', { requestId, text }, status);
  const inbound = (id: string, text: string) => wire.inbound(token, { id, text });
  try {
    await server.json('/api/agent-profile', 'PUT', { action: 'skip' });
    sessionId = (await server.json('/api/sessions', 'POST', { projectPath: project, name: '微信测试' }, 201)).id;
    await t.test('扫码 PIN、请求头、账号归属与私有凭据不外泄', async () => {
      assert.deepEqual(await accounts(), []);
      await server.json(api + '/logins', 'POST', {}, 400);
      await server.json(api + '/logins', 'POST', { sessionId: 'missing-session' }, 404);
      wire.nextLogin({ steps: ['need_verifycode', 'scaned', 'confirmed'] });
      const login = await server.json<WeixinLogin>(api + '/logins', 'POST', { sessionId }, 201); loginId = login.id;
      assert.equal(login.status, 'waiting'); assert.match(login.qrContent, /^https:/);
      const pin = await server.json<WeixinLogin>(`${api}/logins/${loginId}/poll`, 'POST', {}); assert.equal(pin.status, 'pin_required');
      await server.json(`${api}/logins/${loginId}/poll`, 'POST', { pin: 'bad' }, 400);
      const scanned = await server.json<WeixinLogin>(`${api}/logins/${loginId}/poll`, 'POST', { pin: '001234' }); assert.equal(scanned.status, 'scanned');
      const confirmed = await server.json<WeixinLogin>(`${api}/logins/${loginId}/poll`, 'POST', {}); assert.equal(confirmed.status, 'confirmed');
      accountId = confirmed.accountId!;
      const account = (await accounts())[0]; token = wire.loginFor(account.botId).token;
      assert.equal(account.sessionId, sessionId); assert.equal(account.hasContext, false);
      const serialized = JSON.stringify({ login, confirmed, account });
      assert(!serialized.includes(WEIXIN_SECRET)); assert(!serialized.includes(WEIXIN_CONTEXT));
      const response = await server.request(api + '/accounts'); assert.equal(response.headers.get('cache-control'), 'no-store');
      const blocked = await fetch(server.address + api + '/accounts', { headers: { Origin: 'https://foreign.example' } }); assert.equal(blocked.status, 403);
    });
    await t.test('主动发送无需入站消息，幂等请求、冲突与字节上限', async () => {
      const sent = await send('proactive-before-inbound', '主动通知，不需要等待新的微信消息。');
      assert.equal(sent.status, 'accepted'); assert.equal(sent.kind, 'notification');
      assert.equal(wire.sends.at(-1)!.body.msg.context_token, undefined);
      const count = wire.sends.length;
      const duplicate = await send('proactive-before-inbound', sent.text); assert.equal(duplicate.id, sent.id); assert.equal(wire.sends.length, count);
      await send('proactive-before-inbound', '不同文字', 409);
      await send('too-long', '中'.repeat(1334), 400);
      await server.json(`${api}/accounts/${accountId}/messages`, 'POST', { requestId: 'bad key', text: '通知' }, 400);
    });
    await t.test('微信 uint64 去重、仅本人收件、Agent 最终回复与上下文', async () => {
      inbound('9007199254740993123', '微信你好'); inbound('9007199254740993123', '微信你好');
      wire.inbound(token, { id: 'other-owner', text: '不得进入模型', peerId: 'stranger@im.wechat' });
      wire.inbound(token, { id: 'other-bot', text: '不得进入模型', recipientId: 'another-bot@im.bot' });
      wire.inbound(token, { id: 'group', text: '不得进入模型', groupId: 'group-1' });
      await eventually(listMessages, messages => messages.some(message => message.direction === 'outbound' && message.text === '收到：微信你好' && message.status === 'accepted'), 'Agent 回复');
      const received = (await listMessages()).filter(message => message.direction === 'inbound'); assert.equal(received.length, 1);
      assert.equal(received[0].status, 'completed');
      const detail = await server.json('/api/sessions/' + sessionId); assert.equal(detail.messages.filter((message: any) => message.role === 'user').length, 1);
      assert.equal(wire.sends.at(-1)!.body.msg.context_token, WEIXIN_CONTEXT);
      assert.equal((await accounts())[0].hasContext, true);
      const stored = JSON.parse(await readFile(join(env.PLOTLOOM_DATA_DIR, 'im', 'weixin.json'), 'utf8'));
      assert(stored.messages.some((message: any) => message.upstreamId === '9007199254740993123'));
      assert(!(JSON.stringify(await listMessages()).includes(WEIXIN_CONTEXT)));
    });
    await t.test('非文字明确反馈，失败不冒充记账或模型处理成功', async () => {
      wire.inbound(token, { id: 'image', items: [{ type: 2, image_item: {} }] });
      const messages = await eventually(listMessages, list => list.some(message => message.error?.code === 'IM_UNSUPPORTED_MESSAGE'), '非文字反馈');
      assert(messages.some(message => message.text === '[非文字消息]' && message.status === 'failed'));
    });
    await t.test('发送拒绝、断线、无效响应与服务器错误均保存实际结果且不泄漏正文', async () => {
      for (const [mode, expected] of [['reject', 'rejected'], ['drop', 'unknown'], ['invalid', 'unknown'], ['http-fail', 'unknown']] as const) {
        wire.sendMode(mode); const result = await send(`send-${mode}`, `测试 ${mode}`); assert.equal(result.status, expected);
        assert(!JSON.stringify(result).includes(WEIXIN_SECRET));
        const count = wire.sends.length; assert.equal((await send(`send-${mode}`, result.text)).id, result.id); assert.equal(wire.sends.length, count);
      }
    });
    await t.test('并发同键不会双发，重启保留未知发送和游标', async () => {
      wire.sendMode('hold'); const count = wire.sends.length;
      const first = send('concurrent', '同一业务事件');
      await eventually(() => wire.sends.length, length => length > count, '首次发送已到微信');
      const duplicate = await send('concurrent', '同一业务事件'); assert.equal(duplicate.status, 'sending'); assert.equal(wire.sends.length, count + 1);
      wire.releaseSends(); assert.equal((await first).status, 'accepted');
      const cursor = JSON.parse(await readFile(join(env.PLOTLOOM_DATA_DIR, 'im', 'weixin.json'), 'utf8')).accounts[0].cursor;
      await server.close(); server = await launch();
      assert.equal((await accounts())[0].id, accountId);
      assert.equal((await send('send-drop', '测试 drop')).status, 'unknown');
      inbound('9007199254740993123', '微信你好'); inbound('after-restart', '重启后的消息');
      await eventually(listMessages, messages => messages.some(message => message.text === '收到：重启后的消息' && message.status === 'accepted'), '重启后收件');
      assert.equal((await listMessages()).filter(message => message.direction === 'inbound' && message.text === '微信你好').length, 1);
      assert(wire.requests.some(request => request.path.endsWith('/getupdates') && request.body.get_updates_buf === cursor));
    });
    await t.test('微信提问回复和文件审批沿用真实 Agent', async () => {
      const questionText = 'WRITE:' + JSON.stringify({ steps: [{ name: 'ask_user', args: { question: '选择测试颜色', options: ['红色', '蓝色'] } }], finalText: '问题已回答。' });
      inbound('question', questionText);
      await eventually(listMessages, messages => messages.some(message => message.direction === 'outbound' && message.text.includes('选择测试颜色')), '微信提问');
      inbound('answer', '选项 2');
      await eventually(listMessages, messages => messages.some(message => message.text === '问题已回答。' && message.status === 'accepted'), '回答后继续');
      const writeText = 'WRITE:' + JSON.stringify({ steps: [{ name: 'write', args: { path: 'wechat.txt', content: '微信审批通过' } }], finalText: '文件已保存。' });
      inbound('write', writeText);
      const detail = await eventually(() => server.json('/api/sessions/' + sessionId), session => session.pendingApprovals?.length > 0, '文件审批');
      const approvalId = detail.pendingApprovals[0].id;
      await eventually(listMessages, messages => messages.some(message => message.text.includes(`批准 ${approvalId}`)), '审批通知');
      await assert.rejects(readFile(join(project, 'wechat.txt')), { code: 'ENOENT' });
      inbound('approve', `批准 ${approvalId}`);
      await eventually(listMessages, messages => messages.some(message => message.text === '文件已保存。' && message.status === 'accepted'), '审批后完成');
      assert.equal(await readFile(join(project, 'wechat.txt'), 'utf8'), '微信审批通过');
    });
    await t.test('进程强制退出后不重放生成或重复主动发送', async () => {
      inbound('crash-generation', 'WAIT:crash');
      await eventually(() => model.isWaiting('WAIT:crash'), value => value, '强退前模型等待');
      wire.sendMode('hold'); const count = wire.sends.length;
      const sending = send('crash-send', '强退时发送中').catch(() => undefined);
      await eventually(() => wire.sends.length, length => length > count, '强退前微信已收到请求');
      await server.close(true); await sending; server = await launch();
      assert.equal((await send('crash-send', '强退时发送中')).status, 'unknown'); assert.equal(wire.sends.length, count + 1);
      assert.equal((await listMessages()).find(message => message.text === 'WAIT:crash')?.status, 'interrupted');
      assert.equal(model.attempts.get('WAIT:crash'), 1);
      inbound('after-crash', '强退后继续');
      await eventually(listMessages, messages => messages.some(message => message.text === '收到：强退后继续' && message.status === 'accepted'), '强退恢复后继续');
    });
    await t.test('会话忙、微信停止、停用时取消本通道生成', async () => {
      inbound('wait', 'WAIT:stop'); await eventually(() => model.isWaiting('WAIT:stop'), value => value, '模型等待');
      inbound('busy', '不能并发执行');
      await eventually(listMessages, messages => messages.some(message => message.text === '不能并发执行' && message.error?.code === 'SESSION_BUSY'), '忙提示');
      inbound('stop', '停止'); await eventually(() => server.json('/api/sessions/' + sessionId), session => session.status === 'idle', '微信停止');
      await eventually(listMessages, messages => messages.some(message => message.direction === 'inbound' && message.text === '停止' && message.status === 'completed'), '停止指令完成');
      inbound('wait-disable', 'WAIT:disable'); await eventually(() => model.isWaiting('WAIT:disable'), value => value, '再次等待');
      const disabled = await server.json<WeixinAccount>(`${api}/accounts/${accountId}`, 'PUT', { enabled: false }); assert.equal(disabled.status, 'disabled');
      assert.equal((await server.json('/api/sessions/' + sessionId)).status, 'idle');
      await send('disabled-send', '停用不能发送', 409);
      assert((await listMessages()).some(message => message.text === 'WAIT:disable' && message.status === 'interrupted'));
      await server.json(`${api}/accounts/${accountId}`, 'PUT', { enabled: true });
    });
    await t.test('两个微信账号使用独立会话，重复绑定拒绝且不破坏已有连接', async () => {
      const conflict = await server.json<WeixinLogin>(api + '/logins', 'POST', { sessionId }, 201);
      const refused = await server.json(`${api}/logins/${conflict.id}/poll`, 'POST', {}, 409); assert.equal(refused.error.code, 'IM_SESSION_BOUND');
      const secondSession = (await server.json('/api/sessions', 'POST', { projectPath: project }, 201)).id;
      const login = await server.json<WeixinLogin>(api + '/logins', 'POST', { sessionId: secondSession }, 201);
      const second = await server.json<WeixinLogin>(`${api}/logins/${login.id}/poll`, 'POST', {});
      const otherAccount = (await accounts()).find(item => item.id === second.accountId)!;
      const otherToken = wire.loginFor(otherAccount.botId).token;
      wire.inbound(otherToken, { id: 'other-account', text: '第二账号独立消息' });
      await eventually(() => wire.sends, sends => sends.some(sent => sent.token === otherToken && sent.body.msg.item_list[0].text_item.text === '收到：第二账号独立消息'), '另一账号独立回复');
      const mainSession = await server.json('/api/sessions/' + sessionId);
      assert(!JSON.stringify(mainSession.messages).includes('第二账号独立消息'));
      await server.json(`${api}/accounts/${accountId}`, 'PUT', { sessionId: secondSession }, 409);
      assert.equal((await accounts()).find(item => item.id === accountId)!.sessionId, sessionId);
      // 两个连接同时争用同一空闲会话，只有一个更新成功，另一条原绑定仍有效。
      const contested = (await server.json('/api/sessions', 'POST', { projectPath: project }, 201)).id;
      const updates = await Promise.all([accountId, second.accountId!].map(id => server.request(`${api}/accounts/${id}`, 'PUT', { sessionId: contested })));
      assert.deepEqual(updates.map(response => response.status).sort(), [200, 409]);
      assert.equal((await accounts()).filter(item => item.sessionId === contested).length, 1);
      await server.json(`${api}/accounts/${accountId}`, 'PUT', { sessionId });
      await server.json(`${api}/accounts/${second.accountId}`, 'DELETE');
    });
    await t.test('登录失效需要重扫，恶意服务地址拒绝，移除连接保留 Agent 会话', async () => {
      wire.updateError(token, -14);
      await eventually(accounts, list => list[0].status === 'login_required', '微信登录失效');
      await send('expired-send', '登录失效后不能发送', 409);
      const before = (await accounts())[0];
      wire.nextLogin({ botId: before.botId, peerId: before.peerId });
      const login = await server.json<WeixinLogin>(api + '/logins', 'POST', { sessionId }, 201);
      const renewed = await server.json<WeixinLogin>(`${api}/logins/${login.id}/poll`, 'POST', {}); assert.equal(renewed.accountId, accountId);
      const otherSession = (await server.json('/api/sessions', 'POST', { projectPath: project }, 201)).id;
      wire.nextLogin({ baseUrl: 'https://evil.example' });
      const malicious = await server.json<WeixinLogin>(api + '/logins', 'POST', { sessionId: otherSession }, 201);
      const refused = await server.json(`${api}/logins/${malicious.id}/poll`, 'POST', {}, 502); assert.equal(refused.error.code, 'IM_PROTOCOL_ERROR');
      await server.json(`${api}/accounts/${accountId}`, 'DELETE'); assert.deepEqual(await accounts(), []);
      await server.json('/api/sessions/' + sessionId); await server.json(`${api}/accounts/${accountId}/messages`, 'GET', undefined, 404);
    });
    assert.deepEqual(wire.errors, []); assert.deepEqual(model.errors, []);
    assert(!server.logs().includes(WEIXIN_SECRET)); assert(!server.logs().includes(TEST_KEY));
  } finally { await server.close(); await wire.close(); await model.close(); await rm(directory, { recursive: true, force: true }); }
});
