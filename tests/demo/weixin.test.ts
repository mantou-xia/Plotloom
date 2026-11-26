import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { WeixinHttpClient } from '../../apps/server/src/im/weixin-http.ts';
import { API_CATALOG, API_MODULES } from '../../packages/contracts/src/catalog.ts';
import { checkJson } from '../../apps/api-demo/src/client.ts';
import { weixinSendChecks } from '../../apps/api-demo/src/weixin.ts';
import { createModelFixture, TEST_KEY } from '../api/fixture.ts';
import { createWeixinFixture } from '../api/weixin-fixture.ts';

test('微信试验台登记示例实际触发全部接口，主动触达核对业务状态', { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-weixin-demo-')); const project = join(directory, 'project'); await mkdir(project);
  const model = await createModelFixture(); const wire = await createWeixinFixture(); const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { 'p1-test': { api: 'openai-completions', baseUrl: model.baseUrl,
    models: [{ id: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096 }] } } }));
  const app = await buildServer({ dataDir: join(directory, 'data'), modelsPath, defaultModel: { provider: 'p1-test', model: 'fixture' }, apiKey: TEST_KEY },
    { weixinGateway: new WeixinHttpClient({ origin: wire.origin }) });
  const seen = new Set<string>(); const parameters: Record<string, string> = {};
  const run = async (id: string, body?: unknown) => {
    const endpoint = API_CATALOG.find(item => item.id === id)!; assert(endpoint);
    const response = await app.inject({ method: endpoint.method, url: endpoint.path.replace(/:([a-zA-Z]+)/g, (_, name: string) => parameters[name]),
      payload: body ?? endpoint.examples[0]?.body });
    const value = response.json();
    const checks = checkJson(endpoint, response.statusCode, String(response.headers['content-type']), value);
    assert(checks.every(check => check.passed), JSON.stringify({ id, checks, value })); seen.add(id); return value;
  };
  try {
    const session = await app.inject({ method: 'POST', url: '/api/sessions', payload: { projectPath: project } }); assert.equal(session.statusCode, 201);
    const sessionId = session.json().id;
    assert(API_MODULES.some(module => module.id === 'im'));
    const login = await run('im.weixin.login', { sessionId }); parameters.loginId = login.id;
    const confirmed = await run('im.weixin.poll'); parameters.accountId = confirmed.accountId;
    await run('im.weixin.accounts');
    const sent = await run('im.weixin.send'); assert(weixinSendChecks(sent).every(check => check.passed));
    wire.sendMode('reject'); const rejected = await run('im.weixin.send', { requestId: 'demo-reject', text: '检查拒绝反馈' });
    assert.equal(rejected.status, 'rejected'); assert(weixinSendChecks(rejected).some(check => !check.passed));
    wire.sendMode('drop'); const unknown = await run('im.weixin.send', { requestId: 'demo-unknown', text: '检查结果不明' });
    assert.equal(unknown.status, 'unknown'); assert(weixinSendChecks(unknown).some(check => !check.passed));
    const messages = await run('im.weixin.messages'); assert.equal(messages.messages.length, 3);
    const settings = API_CATALOG.find(item => item.id === 'im.weixin.update')!;
    for (const hours of [6, null]) {
      const example = settings.examples.find(item => item.body.idleSessionHours === hours);
      assert(example);
      assert.equal((await run(settings.id, example.body)).idleSessionHours, hours);
    }
    assert.equal((await run('im.weixin.update')).status, 'disabled');
    const global = settings.examples.find(item => item.body.mode === 'global');
    assert(global);
    assert.equal((await run(settings.id, global.body)).sessionId, null);
    await run('im.weixin.remove');
    const globalLogin = await run('im.weixin.login');
    assert.equal(globalLogin.mode, 'global'); assert.equal(globalLogin.sessionId, null);
    parameters.loginId = globalLogin.id;
    const globalConfirmed = await run('im.weixin.poll');
    parameters.accountId = globalConfirmed.accountId;
    assert.equal(globalConfirmed.mode, 'global');
    await run('im.weixin.remove');
    assert.deepEqual([...seen].sort(), API_CATALOG.filter(item => item.module === 'im').map(item => item.id).sort());
    assert.deepEqual(wire.errors, []);
  } finally { await app.close(); await wire.close(); await model.close(); await rm(directory, { recursive: true, force: true }); }
});
