import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { API_CATALOG, SSE_EVENTS } from '../../packages/contracts/src/catalog.ts';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { checkFields, checkStream, consumeSse } from '../../apps/api-demo/src/client.ts';
import type { AgentEvent } from '../../packages/contracts/src/index.ts';

/** 登记清单与实际 HTTP 路由一一对应，后续新增接口漏登记会使检查失败。 */
test('测试台注册目录覆盖全部业务接口', async () => {
  const root = new URL('../../apps/server/src/routes/', import.meta.url);
  const files = await readdir(root, { recursive: true });
  const sources = await Promise.all(files.filter((file) => file.endsWith('.ts')).map((file) => readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8')));
  const routes = sources.flatMap((source) => [...source.matchAll(/app\.(get|post|put|patch|delete|head|options)(?:<[^]*?>)?\(\s*'([^']+)'/g)]
    .map((match) => `${match[1].toUpperCase()} ${match[2]}`)).sort();
  const registered = API_CATALOG.map((item) => `${item.method} ${item.path}`).sort();
  assert.equal(routes.length, 72);
  assert(registered.includes('PUT /api/sessions/:id/organization'));
  assert(registered.includes('DELETE /api/sessions/:id'));
  for (const id of ['sessions.list', 'chats.list', 'chats.workspace-list']) {
    assert(API_CATALOG.find(item => item.id === id)?.response.some(field => field.name === 'sessions[].archivedAt' && !field.required));
  }
  assert.equal(routes.filter(route => route.includes('/api/providers')).length, 7);
  assert.equal(routes.filter(route => route.endsWith('/api/providers')).length, 3);
  assert.equal(routes.filter(route => route.endsWith('/retry')).length, 1);
  assert.equal(routes.filter(route => route.includes('/api/projects')).length, 3);
  assert.equal(routes.filter(route => route.includes('/project-directories')).length, 0);
  assert.equal(routes.filter(route => route.includes('/project-files')).length, 1);
  assert.equal(routes.filter(route => route.includes('/attachments')).length, 4);
  assert.equal(routes.filter((route) => route.includes('/api/workspaces')).length, 22);
  assert.equal(routes.filter((route) => route.includes('/writing')).length, 3);
  assert.equal(routes.filter((route) => route.includes('/api/skills')).length, 9);
  assert.equal(routes.filter(route => route === 'GET /api/tools').length, 1);
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
      if (!endpoint.stream) assert(checkFields(endpoint.responseExample, endpoint.response).every((check) => check.passed), endpoint.id);
    }
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('SSE 中文字节跨块、CRLF、心跳、失败和断流结果可区分', async () => {
  const raw = ': heartbeat\r\n\r\nevent: accepted\r\ndata: {"sessionId":"test","messageId":"m1"}\r\n\r\n'
    + 'event: text_delta\r\ndata: {"sessionId":"test","delta":"灯塔-731"}\r\n\r\n'
    + 'event: thinking_delta\r\ndata: {"sessionId":"test","delta":"可见思考"}\r\n\r\n'
    + 'event: failed\r\ndata: {"sessionId":"test","error":{"code":"MODEL_FAILED","message":"失败"}}\r\n\r\n';
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const events: AgentEvent[] = [];
  await consumeSse(new Response(stream), (event) => events.push(event));
  assert.equal(events.length, 4);
  assert.equal(events[1].type === 'text_delta' && events[1].delta, '灯塔-731');
  assert.equal(events[2].type === 'thinking_delta' && events[2].delta, '可见思考');
  assert(checkStream(events, 'test').some((check) => !check.passed && check.name === '生成结果'));
  assert(checkStream(events.slice(0, 2), 'test').some((check) => !check.passed && check.name === '唯一结束事件'));
  assert(checkStream([events[0], { type: 'aborted', sessionId: 'test' }], 'test').every((check) => check.passed));
  assert(checkStream([events[0], { type: 'completed', sessionId: 'other' }], 'test').some((check) => !check.passed));
  assert.deepEqual(SSE_EVENTS.map((event) => event.name).sort(), ['accepted', 'text_delta', 'thinking_delta', 'tool_start', 'tool_end', 'retrying', 'compacting', 'completed', 'aborted', 'failed'].sort());
});

test('响应检查逐项验证数组字段，允许空列表及可选用量', () => {
  const fields = API_CATALOG.find((item) => item.id === 'models.list')!.response;
  assert(checkFields({ models: [] }, fields).every((check) => check.passed));
  assert(checkFields({ models: [{ provider: 'test', id: 'a', name: 'A', configured: 'true' }] }, fields).some((check) => !check.passed));
  assert(checkFields({}, fields).some((check) => !check.passed));
  const usage = SSE_EVENTS.find((event) => event.name === 'completed')!.fields;
  assert(checkFields({ sessionId: 'test' }, usage).every((check) => check.passed));
});

test('会话配置目录完整登记自动压缩的读写和可触发示例', () => {
  const update = API_CATALOG.find(item => item.id === 'sessions.set-config')!;
  const field = update.request.find(item => item.name === 'autoCompaction');
  assert.equal(field?.type, 'boolean');
  assert.equal(field.required, false);
  assert(update.examples.some(item => item.body.autoCompaction === false));
  assert(update.examples.some(item => item.body.autoCompaction === true));
  assert.match(update.note, /400 INVALID_REQUEST/);
  assert.match(update.note, /404 SESSION_NOT_FOUND/);
  assert.match(update.note, /409 SESSION_BUSY/);
  for (const id of ['sessions.get-config', 'sessions.set-config', 'context.get']) {
    const endpoint = API_CATALOG.find(item => item.id === id)!;
    assert(endpoint.response.some(item => item.name === 'autoCompaction' && item.required));
    assert(checkFields({ ...endpoint.responseExample as object, autoCompaction: false }, endpoint.response).every(check => check.passed));
    assert(checkFields({ ...endpoint.responseExample as object, autoCompaction: 'false' }, endpoint.response).some(check => !check.passed));
  }
});

test('附件路由、消息来源和历史回显都登记了可检查字段', () => {
  assert.deepEqual(API_CATALOG.filter(item => item.module === 'attachments').map(item => item.id).sort(),
    ['attachments.upload', 'attachments.list', 'attachments.get', 'attachments.delete'].sort());
  const send = API_CATALOG.find(item => item.id === 'generation.send')!;
  for (const name of ['attachmentIds', 'references', 'references[].workspaceId', 'references[].path', 'references[].version', 'references[].selection.text']) {
    assert(send.request.some(field => field.name === name), name);
  }
  assert.equal(send.request.find(field => field.name === 'text')!.required, false);
  const history = API_CATALOG.find(item => item.id === 'sessions.get')!;
  assert(history.response.some(field => field.name === 'messages[].attachments[].id'));
  assert(history.response.some(field => field.name === 'messages[].references[].content'));
  for (const path of ['messages[].content[].source.id', 'messages[].citations[].id', 'messages[].citations[].title', 'messages[].citations[].url']) {
    assert(history.response.some(field => field.name === path), path);
  }
});
