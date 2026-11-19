import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { startServer, events, collect, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 通过独立进程的 HTTP 验证配置落盘和 SDK 行为，避免只检查内存状态。 */
test('P1.1 配置、思考、上下文和工具公开接口', { timeout: 120000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-controls-'));
  const fixture = await createModelFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { 'p1-test': {
    api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: ['reasoner', 'plain'].map((id) => ({ id, name: id, reasoning: id === 'reasoner', input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 2048 })),
  } } }), 'utf8');
  const env = { PLOTLOOM_DATA_DIR: directory, PLOTLOOM_MODELS_PATH: modelsPath, PLOTLOOM_PROVIDER: 'p1-test', PLOTLOOM_MODEL: 'reasoner', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const logs: string[] = [];
  const restart = async (overrides = {}) => { await server.close(); logs.push(server.logs()); server = await startServer({ ...env, ...overrides }); };
  const create = (body = {}) => server.json('/api/sessions', 'POST', body, 201);
  const send = async (id: string, text: string) => collect(await server.request(`/api/sessions/${id}/messages`, 'POST', { text }));
  const path = (id: string, suffix = '') => `/api/sessions/${id}${suffix}`;
  const waitFor = async (condition: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 150; i++) { if (await condition()) return; await delay(20); }
    assert.fail('预期状态未出现');
  };
  let id = '';
  try {
    await t.test('能力、默认档位、空会话配置与名称跨进程保存、会话隔离', async () => {
      const { models } = await server.json('/api/models');
      assert.deepEqual(models.find((m: any) => m.id === 'plain').thinkingLevels, ['off']);
      assert(models.find((m: any) => m.id === 'reasoner').thinkingLevels.includes('high'));
      await server.json('/api/model-config', 'PUT', { provider: 'p1-test', model: 'reasoner', thinkingLevel: 'high' });
      const a = await create({ name: '初始会话' }); id = a.id;
      const b = await create();
      assert.equal(a.thinkingLevel, 'high');
      await server.json(path(id, '/config'), 'PUT', { provider: 'p1-test', model: 'plain' });
      assert.equal((await server.json(path(id, '/config'))).thinkingLevel, 'off');
      await server.json(path(id, '/name'), 'PUT', { name: '  灯塔创作  ' });
      await restart();
      const restored = await server.json(path(id));
      assert.equal(restored.model, 'plain'); assert.equal(restored.thinkingLevel, 'off'); assert.equal(restored.name, '灯塔创作');
      assert.deepEqual(restored.messages, []);
      assert.equal((await server.json(path(b.id, '/config'))).thinkingLevel, 'high');
      assert.equal((await server.json('/api/model-config')).thinkingLevel, 'high');
      assert((await server.json('/api/sessions')).sessions.some((s: any) => s.id === id && s.name === '灯塔创作'));
      await server.json(path(id, '/config'), 'PUT', { provider: 'p1-test', model: 'reasoner', thinkingLevel: 'low' });
      await restart();
      assert.equal((await server.json(path(id, '/config'))).thinkingLevel, 'low');
    });
    await t.test('不支持档位和无效输入拒绝且不改变原配置', async () => {
      await server.json(path(id, '/config'), 'PUT', {}, 400);
      await server.json(path(id, '/config'), 'PUT', { provider: 'p1-test' }, 400);
      await server.json(path(id, '/config'), 'PUT', { thinkingLevel: 'invalid' }, 400);
      for (const autoCompaction of ['false', 0, null, {}]) {
        const error = await server.json(path(id, '/config'), 'PUT', { autoCompaction }, 400);
        assert.equal(error.error.code, 'INVALID_REQUEST');
      }
      const before = await server.json(path(id, '/config'));
      const failure = await server.json(path(id, '/config'), 'PUT', { provider: 'p1-test', model: 'plain', thinkingLevel: 'high', autoCompaction: false }, 422);
      assert.equal(failure.error.code, 'THINKING_LEVEL_UNSUPPORTED');
      await server.json('/api/model-config', 'PUT', { provider: 'p1-test', model: 'plain', thinkingLevel: 'high' }, 422);
      await server.json('/api/sessions', 'POST', { provider: 'p1-test', model: 'plain', thinkingLevel: 'high' }, 422);
      await server.json(path(id, '/name'), 'PUT', { name: '  ' }, 400);
      await server.json(path(id, '/name'), 'PUT', { name: 'x'.repeat(121) }, 400);
      assert.deepEqual(await server.json(path(id, '/config')), before);
      for (const suffix of ['/config', '/context', '/stats', '/tools']) await server.json(path('unknown', suffix), 'GET', undefined, 404);
      assert.equal((await server.json(path('unknown', '/config'), 'PUT', { autoCompaction: false }, 404)).error.code, 'SESSION_NOT_FOUND');
    });
    await t.test('自动压缩开关跨进程保存、会话隔离及 SDK 实际行为', async () => {
      const a = await create();
      const config = () => server.json(path(a.id, '/config'));
      const context = () => server.json(path(a.id, '/context'));
      assert.equal((await config()).autoCompaction, true);
      const calls = fixture.requests.length;
      assert.equal((await server.json(path(a.id, '/config'), 'PUT', { autoCompaction: false })).autoCompaction, false);
      assert.equal((await context()).autoCompaction, false);
      assert.equal((await server.json(path(id, '/config'))).autoCompaction, true);
      assert.equal(fixture.requests.length, calls, '修改开关不调用模型');
      await restart();
      assert.equal((await config()).autoCompaction, false);
      assert.equal((await context()).autoCompaction, false);
      // 首次发送会重建资源与 SDK 实例；验证恢复的设置实际阻止高占用触发自动压缩。
      assertFinal(await send(a.id, 'SEED_COMPACTION'), 'completed');
      const disabled = await send(a.id, 'COMPACT');
      assertFinal(disabled, 'completed');
      assert.equal(disabled.filter(e => e.type === 'compacting').length, 0);
      assert.equal((await context()).autoCompaction, false);
      assert.equal((await server.json(path(a.id, '/compact'), 'POST', {})).outcome, 'completed', '关闭自动压缩不影响手动压缩');
      const before = (await server.json(path(a.id))).messages;
      // 与模型配置同次修改、重复写入以及再次开启，都不能改写历史。
      await server.json(path(a.id, '/config'), 'PUT', { thinkingLevel: 'low', autoCompaction: true });
      await server.json(path(a.id, '/config'), 'PUT', { autoCompaction: true });
      await restart();
      assert.equal((await config()).autoCompaction, true);
      assert.equal((await context()).autoCompaction, true);
      assert.deepEqual((await server.json(path(a.id))).messages, before);
      await send(a.id, 'SEED_COMPACTION');
      const enabled = await send(a.id, 'COMPACT');
      assertFinal(enabled, 'completed');
      assert.deepEqual(enabled.filter(e => e.type === 'compacting').map(e => e.phase), ['start', 'end']);
    });
    await t.test('思考增量与历史文本一致、模型实际接收档位、统计和工具无内部数据', async () => {
      const result = await send(id, 'THINK'); assertFinal(result, 'completed');
      const thought = result.filter((e) => e.type === 'thinking_delta').map((e) => e.delta).join('');
      assert.equal(thought, '这是模型返回的可见思考文本。');
      const detail = await server.json(path(id));
      assert.equal(detail.messages.at(-1).content.find((p: any) => p.type === 'thinking').text, thought);
      const request = fixture.requests.findLast((r) => r.tools?.length);
      assert.equal(request.model, 'reasoner'); assert.equal(request.reasoning_effort, 'low');
      const context = await server.json(path(id, '/context'));
      assert.equal(context.contextWindow, 128000); assert.equal(context.autoCompaction, true); assert.equal(typeof context.tokens, 'number');
      const stats = await server.json(path(id, '/stats'));
      assert.equal(stats.userMessages, 1); assert.equal(stats.assistantMessages, 1); assert.equal(stats.usage.totalTokens, 15);
      const tools = await server.json(path(id, '/tools'));
      assert.deepEqual(tools.tools.map((tool: any) => tool.name), ['read_fixture']);
      assert.equal(tools.tools[0].active, true); assert.equal(tools.tools[0].parameters.type, 'object');
      assert.doesNotMatch(JSON.stringify({ detail, context, stats, tools }), /thinkingSignature|signature|sessionFile|baseUrl|apiKey/);
      await restart(); assert.deepEqual((await server.json(path(id))).messages, detail.messages);
    });
    await t.test('生成与配置、命名和压缩互斥；压缩取消接口不停止普通生成', async () => {
      for await (const event of events(await server.request(path(id, '/messages'), 'POST', { text: 'WAIT:controls' }))) {
        if (event.type === 'text_delta') {
          assert.equal((await server.json(path(id))).activity, 'generating');
          await server.json(path(id, '/config'), 'PUT', { thinkingLevel: 'high' }, 409);
          assert.equal((await server.json(path(id, '/config'), 'PUT', { autoCompaction: false }, 409)).error.code, 'SESSION_BUSY');
          assert.equal((await server.json(path(id, '/context'))).autoCompaction, true);
          await server.json(path(id, '/name'), 'PUT', { name: 'busy' }, 409);
          await server.json(path(id, '/compact'), 'POST', {}, 409);
          assert.equal((await server.json(path(id, '/compact/stop'), 'POST')).status, 'running');
          await server.json(path(id, '/stop'), 'POST');
        }
      }
      assert.equal((await server.json(path(id))).activity, 'idle');
      await server.json(path(id, '/config'), 'PUT', { autoCompaction: false });
      await server.json(path(id, '/config'), 'PUT', { autoCompaction: true });
    });
    await t.test('空会话压缩错误、手动压缩保存、已压缩错误和继续生成', async () => {
      const empty = await create();
      assert.equal((await server.json(path(empty.id, '/compact'), 'POST', {}, 409)).error.code, 'COMPACTION_UNAVAILABLE');
      await send(id, 'SEED_COMPACTION'); await send(id, '摘要前继续');
      const before = (await server.json(path(id))).messages;
      const callsBefore = fixture.requests.length;
      const result = await server.json(path(id, '/compact'), 'POST', { instructions: '保留灯塔线索' });
      assert.equal(result.outcome, 'completed'); assert(result.summary); assert(result.tokensBefore > 0);
      // SDK 可将历史与截断轮次分开摘要；用实际模型请求数核对总用量。
      assert.equal(result.usage.totalTokens, (fixture.requests.length - callsBefore) * 15);
      assert.deepEqual((await server.json(path(id))).messages, before);
      await server.json(path(id, '/compact'), 'POST', {}, 409);
      await restart(); assert.deepEqual((await server.json(path(id))).messages, before);
      assertFinal(await send(id, '压缩后继续'), 'completed');
    });
    await t.test('压缩中拒绝写入、显式取消和通用停止、失败脱敏并保留历史', async () => {
      const a = await create();
      await send(a.id, 'SEED_COMPACTION'); await send(a.id, '摘要前继续');
      const before = (await server.json(path(a.id))).messages;
      for (const stop of ['/compact/stop', '/stop']) {
        fixture.setCompactionMode('wait');
        const pending = server.json(path(a.id, '/compact'), 'POST', {});
        await waitFor(() => fixture.isWaiting('COMPACTION'));
        assert.equal((await server.json(path(a.id, '/context'))).activity, 'compacting');
        await server.json(path(a.id, '/config'), 'PUT', { thinkingLevel: 'low' }, 409);
        await server.json(path(a.id, '/config'), 'PUT', { autoCompaction: false }, 409);
        assert.equal((await server.json(path(a.id, '/context'))).autoCompaction, true);
        await server.json(path(a.id, '/messages'), 'POST', { text: '冲突' }, 409);
        await server.json(path(a.id, '/compact'), 'POST', {}, 409);
        assert.equal((await server.json(path(a.id, stop), 'POST')).status, 'idle');
        assert.equal((await pending).outcome, 'aborted');
        assert.deepEqual((await server.json(path(a.id))).messages, before);
      }
      fixture.setCompactionMode('fail');
      const failed = await server.json(path(a.id, '/compact'), 'POST', {}, 502);
      assert.equal(failed.error.code, 'COMPACTION_FAILED'); assert.doesNotMatch(JSON.stringify(failed), new RegExp(TEST_KEY));
      assert.deepEqual((await server.json(path(a.id))).messages, before);
      fixture.setCompactionMode('complete');
      assertFinal(await send(a.id, '失败后继续'), 'completed');
      await server.json(path(a.id, '/compact/stop'), 'POST');
    });
    await t.test('缺少凭据仍可查询管理信息和命名，不能生成或压缩', async () => {
      await restart({ PLOTLOOM_API_KEY: '' });
      for (const suffix of ['/config', '/context', '/stats', '/tools']) await server.json(path(id, suffix));
      await server.json(path(id, '/name'), 'PUT', { name: '离线命名' });
      await server.json(path(id, '/compact'), 'POST', {}, 422);
      await server.json(path(id, '/config'), 'PUT', { thinkingLevel: 'high' }, 422);
      await server.json(path(id, '/config'), 'PUT', { autoCompaction: false });
      assert.equal((await server.json(path(id, '/context'))).autoCompaction, false);
      await server.json(path(id, '/config'), 'PUT', { autoCompaction: true, thinkingLevel: 'high' }, 422);
      assert.equal((await server.json(path(id, '/config'))).autoCompaction, false, '凭据校验失败不能先修改开关');
      await restart({ PLOTLOOM_API_KEY: '' });
      assert.equal((await server.json(path(id, '/config'))).autoCompaction, false);
      assert.equal((await server.json(path(id))).activity, 'idle');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); logs.push(server.logs()); await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
  assert.doesNotMatch(logs.join('\n'), new RegExp(TEST_KEY));
});
