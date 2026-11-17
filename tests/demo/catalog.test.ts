import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { API_CATALOG, SSE_EVENTS } from '../../packages/contracts/src/catalog.ts';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { checkFields, checkStream, consumeSse } from '../../apps/api-demo/src/client.ts';
import type { AgentEvent } from '../../packages/contracts/src/index.ts';

/** 登记清单与实际 HTTP 路由一一对应，后续新增接口漏登记会使检查失败。 */
test('测试台注册目录覆盖全部业务接口', async () => {
  const source = await readFile(new URL('../../apps/server/src/routes/agent.ts', import.meta.url), 'utf8');
  const routes = [...source.matchAll(/app\.(get|post|put)(?:<[^]*?>)?\(\s*'([^']+)'/g)].map((match) => `${match[1].toUpperCase()} ${match[2]}`).sort();
  const registered = API_CATALOG.map((item) => `${item.method} ${item.path}`).sort();
  assert.equal(routes.length, 8);
  assert.deepEqual(registered, routes);
  assert.equal(new Set(API_CATALOG.map((item) => item.id)).size, API_CATALOG.length);
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-catalog-'));
  const app = await buildServer({ dataDir: directory });
  try {
    await app.ready();
    for (const endpoint of API_CATALOG) {
      assert(app.hasRoute({ method: endpoint.method, url: endpoint.path }), endpoint.id);
      assert(endpoint.description && endpoint.note && endpoint.response.length);
      assert(endpoint.request.every((field) => field.description && field.example && field.type));
    }
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('SSE 中文字节跨块、CRLF、心跳、失败和断流结果可区分', async () => {
  const raw = ': heartbeat\r\n\r\nevent: accepted\r\ndata: {"sessionId":"test","messageId":"m1"}\r\n\r\n'
    + 'event: text_delta\r\ndata: {"sessionId":"test","delta":"灯塔-731"}\r\n\r\n'
    + 'event: failed\r\ndata: {"sessionId":"test","error":{"code":"MODEL_FAILED","message":"失败"}}\r\n\r\n';
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const events: AgentEvent[] = [];
  await consumeSse(new Response(stream), (event) => events.push(event));
  assert.equal(events.length, 3);
  assert.equal(events[1].type === 'text_delta' && events[1].delta, '灯塔-731');
  assert(checkStream(events, 'test').some((check) => !check.passed && check.name === '生成结果'));
  assert(checkStream(events.slice(0, 2), 'test').some((check) => !check.passed && check.name === '唯一结束事件'));
  assert(checkStream([events[0], { type: 'aborted', sessionId: 'test' }], 'test').every((check) => check.passed));
  assert(checkStream([events[0], { type: 'completed', sessionId: 'other' }], 'test').some((check) => !check.passed));
  assert.deepEqual(SSE_EVENTS.map((event) => event.name).sort(), ['accepted', 'text_delta', 'tool_start', 'tool_end', 'retrying', 'compacting', 'completed', 'aborted', 'failed'].sort());
});

test('响应检查逐项验证数组字段，允许空列表及可选用量', () => {
  const fields = API_CATALOG.find((item) => item.id === 'models.list')!.response;
  assert(checkFields({ models: [] }, fields).every((check) => check.passed));
  assert(checkFields({ models: [{ provider: 'test', id: 'a', name: 'A', configured: 'true' }] }, fields).some((check) => !check.passed));
  assert(checkFields({}, fields).some((check) => !check.passed));
  const usage = SSE_EVENTS.find((event) => event.name === 'completed')!.fields;
  assert(checkFields({ sessionId: 'test' }, usage).every((check) => check.passed));
});
