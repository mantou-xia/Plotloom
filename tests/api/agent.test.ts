import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { startServer, events, collect, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

test('P1 公开 HTTP / SSE 验收', { timeout: 120000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-p1-'));
  const fixture = await createModelFixture();
  const models = join(directory, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { 'p1-test': {
    api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: ['fixture', 'alternate'].map((id) => ({ id, name: id, reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 2048 })),
  } } }), 'utf8');
  const env = { PLOTLOOM_DATA_DIR: directory, PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'p1-test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const allLogs: string[] = [];
  const restart = async (force = false) => {
    await server.close(force);
    allLogs.push(server.logs());
    server = await startServer(env);
  };
  const create = () => server.json('/api/sessions', 'POST', {}, 201);
  const message = async (id: string, text: string) => collect(await server.request(`/api/sessions/${id}/messages`, 'POST', { text }));
  const get = (id: string) => server.json(`/api/sessions/${id}`);
  const waitIdle = async (id: string) => {
    for (let i = 0; i < 100; i++) {
      const value = await get(id);
      if (value.status === 'idle') return value;
      await delay(30);
    }
    assert.fail('会话未回到 idle');
  };
  let firstId = '';
  try {
    await t.test('模型、空会话立即保存、默认选择重启保留', async () => {
      const config = await server.json('/api/model-config');
      assert.deepEqual(config, { provider: 'p1-test', model: 'fixture', configured: true, thinkingLevel: 'off' });
      const { models } = await server.json('/api/models');
      assert(models.some((model: any) => model.provider === 'p1-test' && model.id === 'fixture' && model.configured));
      const first = await create();
      firstId = first.id;
      assert.deepEqual((await get(firstId)).messages, []);
      await server.json('/api/model-config', 'PUT', { provider: 'p1-test', model: 'alternate' });
      await restart();
      assert.equal((await server.json('/api/model-config')).model, 'alternate');
      assert.equal((await get(firstId)).model, 'fixture');
      assert.deepEqual((await get(firstId)).messages, []);
      const listed = await server.json('/api/sessions');
      assert(listed.sessions.some((item: any) => item.id === firstId));
      assert.equal((await create()).model, 'alternate');
    });
    await t.test('工具循环、SSE 顺序、用量、稳定消息 ID、普通选择跨进程继续', async () => {
      const result = await message(firstId, 'TOOL');
      assertFinal(result, 'completed');
      assert(result.some((event) => event.type === 'tool_start'));
      assert(result.some((event) => event.type === 'tool_end' && event.outcome === 'completed'));
      assert(result.some((event) => event.type === 'text_delta'));
      const final = result.at(-1);
      assert(final?.type === 'completed');
      assert.equal(final.usage?.totalTokens, 30);
      const detail = await get(firstId);
      const accepted = result[0];
      assert(accepted?.type === 'accepted');
      assert.equal(detail.messages[0].id, accepted.messageId);
      assert.equal(detail.messages[0].outcome, 'completed');
      await restart();
      assert.deepEqual((await get(firstId)).messages, detail.messages);
      assertFinal(await message(firstId, '我选择 A'), 'completed');
      assert.match(JSON.stringify((await get(firstId)).messages), /第七级台阶/);
    });
    await t.test('参数、未知会话、未知模型、错误格式及跨站拒绝', async () => {
      await server.json('/api/sessions', 'POST', { provider: 'p1-test' }, 400);
      await server.json('/api/sessions', 'POST', { model: 'fixture' }, 400);
      await server.json('/api/sessions', 'POST', { provider: 'p1-test', model: 'unknown' }, 422);
      await server.json('/api/sessions', 'POST', { path: 'arbitrary.jsonl' }, 400);
      await server.json('/api/sessions/unknown', 'GET', undefined, 404);
      await server.json(`/api/sessions/${firstId}/messages`, 'POST', { text: '   ' }, 400);
      await server.json(`/api/sessions/${firstId}/messages`, 'POST', { text: 123 }, 400);
      const invalid = await fetch(`${server.address}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json() as any).error.code, 'INVALID_REQUEST');
      const external = await fetch(`${server.address}/api/sessions`, { headers: { Origin: 'https://example.org' } });
      assert.equal(external.status, 403);
    });
    await t.test('会话隔离、生成快照、忙时冲突、主动停止及重复停止', async () => {
      const a = await create();
      const b = await create();
      const result = [];
      for await (const event of events(await server.request(`/api/sessions/${a.id}/messages`, 'POST', { text: 'WAIT:stop' }))) {
        result.push(event);
        if (event.type === 'text_delta') {
          const snapshot = await get(a.id);
          assert.equal(snapshot.status, 'running');
          assert.match(JSON.stringify(snapshot.messages), /部分回复/);
          await server.json(`/api/sessions/${a.id}/messages`, 'POST', { text: '重入' }, 409);
          assertFinal(await message(b.id, 'ISOLATED'), 'completed');
          assert.doesNotMatch(JSON.stringify((await get(b.id)).messages), /WAIT:stop/);
          assert.deepEqual(await server.json(`/api/sessions/${a.id}/stop`, 'POST'), { id: a.id, status: 'idle' });
        }
      }
      assertFinal(result, 'aborted');
      assert.equal((await get(a.id)).messages.at(-1).outcome, 'aborted');
      await server.json(`/api/sessions/${a.id}/stop`, 'POST');
      await restart();
      assert.equal((await get(a.id)).messages.at(-1).outcome, 'aborted');
    });
    await t.test('客户端断流不停止，重新查询可见结果', async () => {
      const session = await create();
      for await (const event of events(await server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:disconnect' }))) {
        if (event.type === 'text_delta') break;
      }
      assert.equal((await get(session.id)).status, 'running');
      fixture.release('WAIT:disconnect');
      const final = await waitIdle(session.id);
      assert.equal(final.messages.at(-1).outcome, 'completed');
      assert.match(JSON.stringify(final.messages), /生成完成/);
    });
    await t.test('强制终止服务后未结束请求标为中断，并可继续', async () => {
      const session = await create();
      for await (const event of events(await server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:crash' }))) {
        if (event.type === 'text_delta') break;
      }
      await restart(true);
      const restored = await get(session.id);
      assert.equal(restored.status, 'idle');
      assert.equal(restored.messages[0].outcome, 'aborted');
      assertFinal(await message(session.id, '重新发起'), 'completed');
    });
    await t.test('工具参数由 SDK 校验，工具失败可查询', async () => {
      const session = await create();
      const result = await message(session.id, 'BAD_TOOL');
      assertFinal(result, 'completed');
      assert(result.some((event) => event.type === 'tool_end' && event.outcome === 'failed'));
      assert((await get(session.id)).messages.some((item: any) => item.role === 'tool' && item.content[0].status === 'failed'));
    });
    await t.test('模型错误脱敏、SDK 有限重试、只发一次最终事件', async () => {
      const session = await create();
      const failed = await message(session.id, 'FAIL');
      assertFinal(failed, 'failed');
      assert.doesNotMatch(JSON.stringify(failed), new RegExp(TEST_KEY));
      assert.doesNotMatch(JSON.stringify(await get(session.id)), /upstream secret|Authorization|credential\/path/);
      const retried = await message(session.id, 'RETRY');
      assertFinal(retried, 'completed');
      assert(retried.some((event) => event.type === 'retrying'));
      assert.equal(fixture.attempts.get('RETRY'), 2);
      const exhausted = await message(session.id, 'RETRY_FAIL');
      assertFinal(exhausted, 'failed');
      assert.equal(exhausted.filter((event) => event.type === 'retrying').length, 2);
      assert.equal(fixture.attempts.get('RETRY_FAIL'), 3);
    });
    await t.test('重试等待期间仍可停止', async () => {
      const session = await create();
      const result = [];
      for await (const event of events(await server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'RETRY_STOP' }))) {
        result.push(event);
        if (event.type === 'retrying') await server.json(`/api/sessions/${session.id}/stop`, 'POST');
      }
      assertFinal(result, 'aborted');
    });
    await t.test('刚接受消息即可停止，不必等待首个正文增量', async () => {
      const session = await create();
      const result = [];
      for await (const event of events(await server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:immediate' }))) {
        result.push(event);
        if (event.type === 'accepted') await server.json(`/api/sessions/${session.id}/stop`, 'POST');
      }
      assertFinal(result, 'aborted');
      assert.equal((await get(session.id)).messages[0].outcome, 'aborted');
    });
    await t.test('同一冷会话并发提交只接受一个请求', async () => {
      const session = await create();
      const responses = await Promise.all([
        server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:concurrent' }),
        server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:concurrent' }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const stream = responses.find((response) => response.status === 200)!;
      const result = [];
      for await (const event of events(stream)) {
        result.push(event);
        if (event.type === 'accepted') await server.json(`/api/sessions/${session.id}/stop`, 'POST');
      }
      assertFinal(result, 'aborted');
      assert.equal((await get(session.id)).messages.filter((item: any) => item.role === 'user').length, 1);
    });
    await t.test('SDK 自动压缩结束后才发送最终事件，完整历史仍可查询', async () => {
      const session = await create();
      assertFinal(await message(session.id, 'SEED_COMPACTION'), 'completed');
      const before = await get(session.id);
      const result = await message(session.id, 'COMPACT');
      assertFinal(result, 'completed');
      assert.deepEqual(result.filter((event) => event.type === 'compacting').map((event) => event.phase), ['start', 'end']);
      const final = result.at(-1);
      assert(final?.type === 'completed');
      assert.equal(final.usage?.totalTokens, 120020);
      assert.deepEqual((await get(session.id)).messages.slice(0, before.messages.length), before.messages);
      await restart();
      assertFinal(await message(session.id, '压缩后继续'), 'completed');
    });
    await t.test('正常关闭服务会停止进行中的生成并保存中断状态', async () => {
      const session = await create();
      for await (const event of events(await server.request(`/api/sessions/${session.id}/messages`, 'POST', { text: 'WAIT:shutdown' }))) {
        if (event.type === 'text_delta') break;
      }
      await restart();
      const detail = await get(session.id);
      assert.equal(detail.status, 'idle');
      assert.equal(detail.messages.at(-1).outcome, 'aborted');
    });
    await t.test('缺失凭据和未选择模型可判断，已有历史仍可读取', async () => {
      await server.close();
      allLogs.push(server.logs());
      server = await startServer({ ...env, PLOTLOOM_API_KEY: '' });
      assert.equal((await server.json('/api/model-config')).configured, false);
      await get(firstId);
      await server.json('/api/sessions', 'POST', {}, 422);
      await server.json(`/api/sessions/${firstId}/messages`, 'POST', { text: '不应发送' }, 422);
      const fresh = await startServer({ ...env, PLOTLOOM_DATA_DIR: join(directory, 'unconfigured'), PLOTLOOM_PROVIDER: '', PLOTLOOM_MODEL: '', PLOTLOOM_API_KEY: '' });
      try {
        assert.deepEqual(await fresh.json('/api/model-config'), { provider: null, model: null, configured: false, thinkingLevel: 'off' });
        await fresh.json('/api/sessions', 'POST', {}, 422);
      } finally { await fresh.close(); }
    });
    for (const request of fixture.requests) {
      if (!request.tools?.length) continue; // 压缩由 SDK 独立摘要提示处理。
      assert.deepEqual(request.tools.map((tool: any) => tool.function.name), ['read_fixture', 'browser', 'web_fetch']);
      const system = JSON.stringify(request.messages.filter((message: any) => ['system', 'developer'].includes(message.role)));
      assert.match(system, /Plotloom 的通用助手/);
      assert.doesNotMatch(system, /读取内置 scene 示例|项目开发规则|Self-Improvement|You are a coding/);
    }
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close();
    allLogs.push(server.logs());
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
  assert.doesNotMatch(allLogs.join('\n'), new RegExp(TEST_KEY));
});
