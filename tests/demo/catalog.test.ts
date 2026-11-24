import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises';
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
  assert.equal(routes.length, 93);
  for (const id of ['documents.entries', 'documents.reveal', 'documents.recycle-chapter']) {
    const doc = API_CATALOG.find(item => item.id === id)!;
    assert(doc.request.some(field => field.name === 'workspaceId' && field.required));
    if (doc.method === 'POST') assert(doc.examples.some(example => typeof example.body.path === 'string'));
  }
  assert(registered.includes('PUT /api/sessions/:id/organization'));
  assert(registered.includes('DELETE /api/sessions/:id'));
  for (const id of ['sessions.list', 'chats.list', 'chats.workspace-list']) {
    assert(API_CATALOG.find(item => item.id === id)?.response.some(field => field.name === 'sessions[].archivedAt' && !field.required));
  }
  assert.equal(routes.filter(route => route.includes('/api/providers')).length, 7);
  assert.equal(routes.filter(route => route.endsWith('/api/providers')).length, 3);
  assert.equal(routes.filter(route => route.endsWith('/retry')).length, 1);
  assert.equal(routes.filter(route => route.endsWith('/tool-approvals/:approvalId')).length, 1);
  assert.equal(routes.filter(route => route.endsWith('/questions/:questionId/answer')).length, 1);
  assert.equal(routes.filter(route => route.includes('/api/projects')).length, 5);
  assert.equal(routes.filter(route => route.includes('/project-directories')).length, 0);
  assert.equal(routes.filter(route => route.includes('/project-files')).length, 1);
  assert.equal(routes.filter(route => route.includes('/project-writes')).length, 2);
  assert.equal(routes.filter(route => route.includes('/attachments')).length, 4);
  assert.equal(routes.filter((route) => route.includes('/api/workspaces')).length, 34);
  const batch = API_CATALOG.find(item => item.id === 'proposals.decide-all');
  assert.equal(batch?.path, '/api/workspaces/:workspaceId/proposals/:proposalId/decision');
  assert.equal(batch?.examples[0].body.action, 'accept');
  assert(API_CATALOG.find(item => item.id === 'character-cards.list')?.response.some(field => field.name === 'cards[].createdAt'));
  assert.equal(API_CATALOG.find(item => item.id === 'character-cards.list')?.examples.length, 0, '角色卡查询通过无请求体的 GET 发送');
  assert.deepEqual(API_CATALOG.filter(item => item.id.startsWith('character-cards.')).map(item => item.id), ['character-cards.list', 'character-cards.create', 'character-cards.read']);
  assert(API_CATALOG.find(item => item.id === 'character-cards.list')?.response.some(field => field.name === 'applicable[].version'));
  const txt = API_CATALOG.find(item => item.id === 'documents.export-txt')!;
  assert.deepEqual(txt.examples[0].body, { path: '正文章节/第四章.md' });
  assert.deepEqual(txt.response.map(field => field.name), ['filename', 'content', 'version']);
  assert(API_CATALOG.find(item => item.id === 'generation.send')!.examples.some(example => example.name === '聊天导出第四章 TXT'));
  const createBook = API_CATALOG.find(endpoint => endpoint.id === 'workspaces.create')!;
  assert.deepEqual(createBook.request.map(field => field.name), ['title', 'root']);
  assert.match(createBook.note, /WORKSPACE_NOT_EMPTY/);
  assert.match(createBook.request[1].description, /空文件夹/);
  const importExample = API_CATALOG.find(item => item.id === 'generation.send')?.examples.find(example => example.name === '小说聊天导入旧章节');
  assert(importExample?.body.attachmentIds && String(importExample.body.text).includes('import_chapters'));
  const generation = API_CATALOG.find(item => item.id === 'generation.send')!;
  assert.match(generation.note, /正文章节\/第4章\.md/);
  assert(generation.examples.some(example => example.name === '修改小说文稿并在右侧采纳' && String(example.body.text).includes('manuscript_workspace')));
  assert(generation.examples.some(example => example.name === '审校润色并打开候选' && String(example.body.text).includes('propose_change')));
  assert(generation.examples.some(example => example.name === '小说聊天写新章' && String(example.body.text).startsWith('写第四章：')));
  assert.match(generation.description, /tool_approval_required.*拒绝留档仍会起草正文.*REVISION_CONFLICT/);
  assert(generation.examples.some(example => example.name === '只讨论本章大纲'));
  const worldRuleExample = generation.examples.find(example => example.name === '新章交付后核对全书底层规则');
  assert.match(String(worldRuleExample?.body.text), /宵禁两天.*复活死者.*全书适用/);
  for (const id of ['writing.context', 'writing.send']) {
    const endpoint = API_CATALOG.find(item => item.id === id)!;
    assert(endpoint.request.some(field => field.name === 'chapterNumber'));
    assert(endpoint.examples.some(example => example.body.chapterNumber === 4));
  }
  assert.equal(routes.filter((route) => route.includes('/writing')).length, 3);
  assert.equal(routes.filter((route) => route.includes('/api/skills')).length, 9);
  assert.equal(routes.filter(route => route === 'GET /api/tools').length, 1);
  assert.deepEqual(routes.filter(route => route.endsWith('/api/agent-profile')), ['GET /api/agent-profile', 'PUT /api/agent-profile']);
  const profile = API_CATALOG.find(item => item.id === 'agent-profile.update');
  assert.deepEqual(profile?.examples.map(example => example.body.action), ['save', 'skip']);
  const send = API_CATALOG.find(item => item.id === 'generation.send');
  assert(send?.examples.some(example => example.name.includes('首次对话')));
  assert.match(send?.note ?? '', /user_answer_required/);
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

test('试验台工具目录展示小说分段暂存及交稿参数', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-chapter-catalog-'));
  const app = await buildServer({ dataDir: directory });
  try {
    const endpoint = API_CATALOG.find(item => item.id === 'tools.list')!;
    const response = await app.inject({ method: endpoint.method, url: endpoint.path });
    assert.equal(response.statusCode, endpoint.success);
    const tools = response.json().tools;
    assert.deepEqual(tools.find((t: any) => t.name === 'write_chapter_part').availableIn, ['novel']);
    assert.equal(tools.find((t: any) => t.name === 'deliver_chapter').parameters, 'partCount、reason');
    assert.equal(tools.find((t: any) => t.name === 'propose_character_change').parameters, 'character、chapter、note、content、evidence');
    assert.deepEqual(tools.find((t: any) => t.name === 'propose_character_change').availableIn, ['novel']);
    const reminder = tools.find((t: any) => t.name === 'suggest_character_card');
    assert.deepEqual(reminder.availableIn, ['novel']);
    assert.match(reminder.parameters, /character、chapter、reason、evidence/);
    assert.match(reminder.description, /首次调用会忽略 content/);
    assert(API_CATALOG.find(item => item.id === 'generation.send')?.examples.some(example => example.name === '提醒为关键人物建卡'));
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('试验台按登记示例核对角色变化证据并查询历史', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-change-demo-'));
  const book = join(directory, 'book');
  await mkdir(book);
  const app = await buildServer({ dataDir: join(directory, 'data') });
  try {
    const workspace = await app.inject({ method: 'POST', url: '/api/workspaces', payload: { title: '试验书', root: book } });
    const id = workspace.json().id;
    const endpoint = API_CATALOG.find(item => item.id === 'character-cards.create')!;
    const url = endpoint.path.replace(':workspaceId', id);
    const payload = endpoint.examples[0].body;
    const { path, quote } = payload.evidence as { path: string; quote: string };
    const send = () => app.inject({ method: endpoint.method, url, payload });
    assert.equal((await send()).statusCode, 400);
    const source = await app.inject({ method: 'PUT', url: '/api/workspaces/' + id + '/document', payload: { path, content: quote, baseVersion: null } });
    assert.equal(source.statusCode, 200);
    const card = await send();
    assert.equal(card.statusCode, endpoint.success);
    assert(checkFields(card.json(), endpoint.response).every(check => check.passed));
    assert.deepEqual(card.json().evidence, payload.evidence);
    const list = await app.inject({ method: 'GET', url: url + '?chapter=4' });
    assert.deepEqual(list.json().applicable[0].evidence, payload.evidence);
    assert(API_CATALOG.find(item => item.id === 'generation.send')!.examples.some(example => example.name === '交稿后复核角色变化'));
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('试验台书架示例和正文统计可提交并检查响应字段', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-shelf-catalog-'));
  const book = join(directory, 'book');
  await mkdir(book);
  const app = await buildServer({ dataDir: join(directory, 'data') });
  try {
    const created = await app.inject({ method: 'POST', url: '/api/workspaces', payload: { title: '试验书', root: book } });
    assert.equal(created.statusCode, 201, created.body);
    const endpoint = API_CATALOG.find(item => item.id === 'workspaces.shelf')!;
    const url = endpoint.path.replace(':workspaceId', created.json().id);
    const response = await app.inject({ method: endpoint.method, url, payload: endpoint.examples[0].body });
    assert.equal(response.statusCode, endpoint.success, response.body);
    assert(checkFields(response.json(), endpoint.response).every(check => check.passed));
    assert.equal(response.json().pinned, true);
    assert.equal(response.json().coverId, 'ocean');
    const rejected = await app.inject({ method: endpoint.method, url, payload: { coverId: 'custom' } });
    assert.equal(rejected.statusCode, 400);
    assert.equal(rejected.json().error.code, 'INVALID_REQUEST');
    const stats = API_CATALOG.find(item => item.id === 'documents.manuscript-stats')!;
    const statsResult = await app.inject({ method: stats.method, url: stats.path.replace(':workspaceId', created.json().id) });
    assert.equal(statsResult.statusCode, stats.success, statsResult.body);
    assert(checkFields(statsResult.json(), stats.response).every(check => check.passed));
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('试验台可提交正文段落候选并按同一处采纳多段改写', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-paragraph-demo-'));
  const book = join(directory, 'book');
  await mkdir(book);
  const app = await buildServer({ dataDir: join(directory, 'data') });
  try {
    const workspace = await app.inject({ method: 'POST', url: '/api/workspaces', payload: { title: '段落比较', root: book } });
    const workspaceId = workspace.json().id;
    const path = '正文章节/第一章.md';
    const document = await app.inject({ method: 'PUT', url: `/api/workspaces/${workspaceId}/document`, payload: {
      path, baseVersion: null, content: '第一段原文。\n\n下一段不改。',
    } });
    assert.equal(document.statusCode, 200, document.body);
    const create = API_CATALOG.find(endpoint => endpoint.id === 'proposals.create')!;
    const replacement = '第一段改写。\n\n补充一段。\n\n';
    const response = await app.inject({ method: create.method, url: create.path.replace(':workspaceId', workspaceId), payload: {
      path, baseVersion: document.json().version, content: replacement + '下一段不改。',
    } });
    assert.equal(response.statusCode, create.success, response.body);
    const candidate = response.json();
    assert(checkFields(candidate, create.response).every(check => check.passed));
    assert.equal(candidate.changes.length, 1);
    assert.equal(candidate.changes[0].after, replacement);
    const decide = API_CATALOG.find(endpoint => endpoint.id === 'proposals.decide')!;
    const accepted = await app.inject({ method: decide.method, url: decide.path.replace(':workspaceId', workspaceId)
      .replace(':proposalId', candidate.id).replace(':changeId', candidate.changes[0].id), payload: decide.examples[0].body });
    assert.equal(accepted.statusCode, decide.success, accepted.body);
    assert.equal(accepted.json().status, 'accepted');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('SSE 中文字节跨块、CRLF、心跳、失败和断流结果可区分', async () => {
  const example = SSE_EVENTS.find(event => event.name === 'failed')?.fields.find(field => field.name === 'error.message');
  const raw = ': heartbeat\r\n\r\nevent: accepted\r\ndata: {"sessionId":"test","messageId":"m1"}\r\n\r\n'
    + 'event: text_delta\r\ndata: {"sessionId":"test","delta":"灯塔-731"}\r\n\r\n'
    + 'event: thinking_delta\r\ndata: {"sessionId":"test","delta":"可见思考"}\r\n\r\n'
    + 'event: failed\r\ndata: ' + JSON.stringify({ sessionId: 'test', error: { code: 'MODEL_FAILED', message: example?.example } }) + '\r\n\r\n';
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const events: AgentEvent[] = [];
  await consumeSse(new Response(stream), (event) => events.push(event));
  assert.equal(events.length, 4);
  assert.equal(events[1].type === 'text_delta' && events[1].delta, '灯塔-731');
  assert.equal(events[2].type === 'thinking_delta' && events[2].delta, '可见思考');
  assert.equal(events[3].type === 'failed' && events[3].error.message, '模型服务商当前没有可用的上游账号，请稍后重试或切换模型。');
  assert(checkStream(events, 'test').some((check) => !check.passed && check.name === '生成结果'));
  assert(checkStream(events.slice(0, 2), 'test').some((check) => !check.passed && check.name === '唯一结束事件'));
  assert(checkStream([events[0], { type: 'aborted', sessionId: 'test' }], 'test').every((check) => check.passed));
  assert(checkStream([events[0], { type: 'completed', sessionId: 'other' }], 'test').some((check) => !check.passed));
  assert.deepEqual(SSE_EVENTS.map((event) => event.name).sort(), ['accepted', 'text_delta', 'thinking_delta', 'tool_start', 'tool_approval_required', 'user_answer_required', 'tool_end', 'retrying', 'compacting', 'completed', 'aborted', 'failed'].sort());
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
