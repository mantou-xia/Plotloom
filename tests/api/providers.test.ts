import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createServer } from 'node:http';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { createModelFixture } from './fixture.ts';
import { assertFinal, collect } from './client.ts';

test('桌面版旧供应商按模型 ID 和实际协议恢复思考档位', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plotloom-model-capabilities-'));
  const modelCapabilitiesPath = join(dataDir, 'model-capabilities.json');
  const supplier = {
    id: 'saved-provider', api: 'openai-completions', baseUrl: 'https://example.invalid/v1',
    endpoints: [{ api: 'openai-responses', baseUrl: 'https://example.invalid/responses/v1' }],
    models: ['reasoner', 'wrong-protocol', 'unknown'],
    modelApis: { reasoner: 'openai-responses' },
    apiKey: 'fixture-only-key',
  };
  const thinkingLevelMap = { off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: null };
  await mkdir(join(dataDir, 'agent'));
  await writeFile(join(dataDir, 'agent', 'providers.json'), JSON.stringify([supplier]));
  await writeFile(modelCapabilitiesPath, JSON.stringify({ providers: { catalog: {
    api: 'openai-responses', models: ['reasoner', 'wrong-protocol'].map(id => ({ id, reasoning: true, thinkingLevelMap })),
  } } }));
  const app = await buildServer({ dataDir, modelCapabilitiesPath });
  try {
    const providers = (await app.inject('/api/providers')).json().providers;
    assert.deepEqual(providers.map((provider: { id: string }) => provider.id), [supplier.id]);
    assert.equal(providers[0].baseUrl, supplier.baseUrl);
    assert.equal(providers[0].configured, true);
    const { models } = (await app.inject('/api/models')).json();
    const levels = (id: string) => models.find((model: { id: string; provider: string }) => model.id === id && model.provider === supplier.id).thinkingLevels;
    assert.deepEqual(levels('reasoner'), ['low', 'medium', 'high', 'xhigh']);
    assert.deepEqual(levels('wrong-protocol'), ['off']);
    assert.deepEqual(levels('unknown'), ['off']);
    const response = await app.inject({ method: 'PUT', url: '/api/model-config',
      payload: { provider: supplier.id, model: 'reasoner', thinkingLevel: 'xhigh' } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().thinkingLevel, 'xhigh');
  } finally {
    await app.close();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('单密钥多端点：检测、目录预览、停用与删除重启', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plotloom-probe-'));
  const headers: string[] = [];
  const upstream = createServer((req, res) => {
    if (req.url === '/fail/models') { res.writeHead(401).end(); return; }
    headers.push(String(req.headers['x-api-key'] ?? req.headers.authorization));
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'remote' }] }));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + (upstream.address() as { port: number }).port;
  const modelsPath = join(dir, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { sample: { api: 'openai-completions', baseUrl: origin + '/v1', models: [{ id: 'old' }] } } }));
  let app = await buildServer({ dataDir: dir, modelsPath });
  const body = { id: 'sample', api: 'openai-completions', baseUrl: origin + '/v1', models: ['remote'],
    endpoints: [{ api: 'anthropic-messages', baseUrl: origin + '/v1' }], modelApis: { remote: 'anthropic-messages' }, name: '示例', avatar: 'cpu' };
  const probe = (route: string, api?: string) => app.inject({ method: 'POST', url: '/api/providers/' + route, payload: { id: 'sample', api } });
  const save = (patch: object) => app.inject({ method: 'PUT', url: '/api/providers', payload: { ...body, ...patch } });
  try {
    assert.equal((await save({ apiKey: 'single-secret' })).statusCode, 200);
    assert.deepEqual((await probe('check')).json(), { connected: true });
    assert.deepEqual((await probe('discover', 'anthropic-messages')).json(), { models: ['remote'] });
    assert.deepEqual(headers, ['Bearer single-secret', 'single-secret']);
    assert.equal((await save({ enabled: false })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/api/sessions', payload: { projectPath: dir, provider: 'sample', model: 'remote' } })).statusCode, 422);
    assert.equal((await save({ enabled: true, baseUrl: origin + '/fail' })).statusCode, 200);
    assert.equal((await probe('check')).statusCode, 502);
    assert.equal((await save({ models: [], modelApis: {} })).statusCode, 200);
    assert.equal((await app.inject({ method: 'DELETE', url: '/api/providers/sample' })).statusCode, 200);
    await app.close(); app = await buildServer({ dataDir: dir, modelsPath });
    assert.deepEqual((await app.inject('/api/providers')).json(), { providers: [] });
    assert.equal((await probe('discover')).statusCode, 404);
  } finally { await app.close(); upstream.closeAllConnections(); await new Promise<void>(resolve => upstream.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
});

test('供应商可新增、更新和恢复，公开响应隐藏密钥，保留旧模型能力', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plotloom-provider-'));
  const modelsPath = join(dataDir, 'models.json');
  const upstream = await createModelFixture();
  const replacement = await createModelFixture();
  const baseUrl = upstream.baseUrl;
  const original = { baseUrl, api: 'openai-completions', models: [{ id: 'reasoner', name: '推理', reasoning: true, contextWindow: 80000 }] };
  await writeFile(modelsPath, JSON.stringify({ providers: { existing: original } }));
  let app = await buildServer({ dataDir, modelsPath });
  const body = { id: 'local-example', api: 'openai-completions', baseUrl, models: ['one'], apiKey: 'provider-test-only' };
  const save = (method: 'POST' | 'PUT', payload: object) => app.inject({ method, url: '/api/providers', payload });
  try {
    assert.equal((await save('POST', { ...body, apiKey: undefined })).statusCode, 422);
    const concurrent = await Promise.all([save('POST', body), save('POST', body)]);
    assert.deepEqual(concurrent.map(r => r.statusCode).sort(), [200, 409]);
    assert.equal((await save('PUT', { ...body, id: 'missing' })).statusCode, 404);
    assert.equal((await save('PUT', { ...body, models: ['one', 'one'] })).statusCode, 400);
    assert.equal((await save('PUT', { ...body, baseUrl: 'bad' })).statusCode, 400);
    assert.equal((await save('PUT', { ...body, apiKey: undefined, baseUrl: 'https://example.test/v1' })).statusCode, 422);
    assert.equal((await save('PUT', { ...body, id: 'existing', models: ['reasoner','two'] })).statusCode, 200);
    assert.equal((await save('PUT', { ...body, apiKey: undefined, models: ['two'] })).statusCode, 200);
    const listing = await app.inject('/api/providers');
    assert(!listing.body.includes(body.apiKey));
    const credentialUrl = '/api/providers/' + body.id + '/credential';
    const credential = await app.inject({ method: 'POST', url: credentialUrl, payload: {} });
    assert.equal(credential.statusCode, 200);
    assert.equal(credential.headers['cache-control'], 'no-store');
    assert.deepEqual(credential.json(), { apiKey: body.apiKey });
    assert.equal((await app.inject({ method: 'POST', url: credentialUrl })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: credentialUrl, payload: {}, headers: { origin: 'https://example.test' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/providers/missing/credential', payload: {} })).statusCode, 404);
    assert.deepEqual(listing.json().providers.find((p: { id: string }) => p.id === body.id).models, ['two']);
    assert.equal((await app.inject({ method: 'PUT', url: '/api/model-config', payload: { provider: body.id, model: 'two' } })).statusCode, 200);
    await app.close();
    app = await buildServer({ dataDir, modelsPath });
    const models = (await app.inject('/api/models')).json().models;
    assert(models.some((m: { provider: string; contextWindow: number }) => m.provider === 'existing' && m.contextWindow === 80000));
    assert.deepEqual((await app.inject('/api/model-config')).json(), { provider: body.id, model: 'two', thinkingLevel: 'off', configured: true });
    const chat = await app.inject({ method: 'POST', url: '/api/sessions', payload: { projectPath: dataDir } });
    assert.equal(chat.statusCode, 201, chat.body);
    assert.equal(chat.json().model, 'two');
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const send = async () => assertFinal(await collect(await fetch(address + '/api/sessions/' + chat.json().id + '/messages',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '检查供应商路由' }) })), 'completed');
    await send();
    assert(upstream.requests.length > 0);
    assert.equal((await save('PUT', { ...body, models: ['two'], baseUrl: replacement.baseUrl, apiKey: 'replacement-test-only' })).statusCode, 200);
    await send();
    assert(replacement.requests.length > 0);
  } finally {
    await app.close();
    await upstream.close();
    await replacement.close();
    // Windows 上 SDK 凭据文件可能在服务关闭后短暂占用，给临时目录清理有限的重试。
    await rm(dataDir, { recursive: true, force: true, maxRetries: 3 });
  }
});
