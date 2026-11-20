import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';
import { collect, events, assertFinal } from './client.ts';
import type { SessionDetail } from '../../packages/contracts/src/index.ts';

/** 模型只提供确定性工具决策；浏览器、文件系统、SDK、HTTP 与历史恢复均使用生产实现。 */
test('单栏 Agent 契约：写文件、浏览器、停止、重试及恢复', { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-basic-'));
  const project = join(directory, 'project'); await mkdir(project);
  const fixture = await createModelFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { 'p1-test': { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const options = { dataDir: directory, modelsPath, defaultModel: { provider: 'p1-test', model: 'fixture' }, apiKey: TEST_KEY, browser: { headless: true } };
  let app = await buildServer(options);
  let address = await app.listen({ host: '127.0.0.1', port: 0 });
  let submitted = '';
  const site = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    if (url.pathname === '/submit') submitted = url.searchParams.get('value') ?? '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<title>本地浏览器验收</title><h1>${submitted || '输入测试'}</h1><form action="/submit"><label>内容<input name="value"></label><button>提交</button></form>`);
  });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const siteAddress = site.address() as { port: number };
  const url = `http://127.0.0.1:${siteAddress.port}`;
  const request = (path: string, method = 'GET', body?: unknown) => fetch(address + path, { method,
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = async (path: string, method = 'GET', body?: unknown, status = 200): Promise<any> => {
    const response = await request(path, method, body); const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
  };
  const create = async (body = {}) => (await json('/api/sessions', 'POST', body, 201)).id as string;
  const send = async (id: string, text: string) => collect(await request(`/api/sessions/${id}/messages`, 'POST', { text }));
  const plan = (steps: unknown[]) => 'WRITE:' + JSON.stringify({ steps, finalText: '操作已完成。' });
  try {
    await t.test('首轮命名、置顶归档恢复和永久删除在重启前后保持一致', async () => {
      const id = await create();
      const path = '/api/sessions/' + id;
      const text = '第一条提示词包含超过十六个字，用来验证自动截断';
      await send(id, text);
      assert.equal((await json(path)).name, Array.from(text).slice(0, 16).join(''));
      await json(path + '/name', 'PUT', { name: '我的对话' });
      await send(id, '第二轮');
      assert.equal((await json(path)).name, '我的对话');
      await json(path, 'DELETE', undefined, 409);
      await json(path + '/organization', 'PUT', {}, 400);
      await json(path + '/organization', 'PUT', { pinned: true });
      await json(path + '/organization', 'PUT', { archived: true });
      await app.close(); app = await buildServer(options); address = await app.listen({ host: '127.0.0.1', port: 0 });
      const chat = (await json('/api/chats')).sessions.find((item: { id: string }) => item.id === id);
      assert(chat.archived && chat.pinned);
      const firstArchive = Date.parse(chat.archivedAt);
      assert(Number.isFinite(firstArchive));
      const listed = async () => (await json('/api/sessions')).sessions.find((item: { id: string }) => item.id === id);
      await json(path + '/organization', 'PUT', { archived: true, pinned: false });
      assert.equal((await listed()).archivedAt, chat.archivedAt);
      await json(path + '/organization', 'PUT', { pinned: true });
      assert.deepEqual(await json(path + '/organization', 'PUT', { archived: false }), { archived: false, pinned: true });
      assert.equal((await listed()).archivedAt, undefined);
      await json(path + '/organization', 'PUT', { pinned: false, archived: true });
      assert(Date.parse((await listed()).archivedAt) > firstArchive);
      await json(path, 'DELETE');
      await json(path, 'GET', undefined, 404);
    });
    await t.test('项目写文件与最新请求重试保留历史，旧目标拒绝，重启保持轮次', async () => {
      const id = await create({ projectPath: project });
      const text = plan([{ name: 'write', args: { path: 'hello.txt', content: '正式接入验收' } }]);
      assertFinal(await send(id, text), 'completed');
      assert.equal(await readFile(join(project, 'hello.txt'), 'utf8'), '正式接入验收');
      const before: SessionDetail = await json(`/api/sessions/${id}`);
      assert((before.messages.find(m => m.role === 'user')?.elapsedSeconds ?? -1) >= 0);
      assert(before.retryMessageId); assert(before.messages.every(m => m.turnId));
      assert(before.messages.some(m => m.phase === 'answer'));
      assert(before.messages.some(m => m.content.some(b => b.type === 'tool' && b.input?.includes('hello.txt'))));
      await writeFile(join(project, 'hello.txt'), '重试前改动');
      assertFinal(await collect(await request(`/api/sessions/${id}/retry`, 'POST', { messageId: before.retryMessageId })), 'completed');
      assert.equal(await readFile(join(project, 'hello.txt'), 'utf8'), '正式接入验收');
      const after: SessionDetail = await json(`/api/sessions/${id}`);
      assert.deepEqual(after.messages.slice(0, before.messages.length), before.messages);
      assert.equal(after.messages.filter(m => m.role === 'user').length, 2);
      await json(`/api/sessions/${id}/retry`, 'POST', { messageId: before.retryMessageId }, 409);
      await app.close(); app = await buildServer(options); address = await app.listen({ host: '127.0.0.1', port: 0 });
      assert.deepEqual(await json(`/api/sessions/${id}`), after);
    });
    await t.test('普通聊天浏览器真实导航、ref 填写点击、来源与会话隔离', async () => {
      const id = await create();
      assertFinal(await send(id, plan([{ name: 'browser', args: { action: 'navigate', url } }])), 'completed');
      let detail: SessionDetail = await json(`/api/sessions/${id}`);
      const block = detail.messages.findLast(m => m.role === 'tool')!.content[0];
      assert(block.type === 'tool' && block.text && block.source?.url === url + '/');
      const snapshot = JSON.parse(block.text).snapshot as string;
      const inputRef = /textbox[^\n]*\[ref=([^\]]+)\]/.exec(snapshot)?.[1];
      const buttonRef = /button[^\n]*\[ref=([^\]]+)\]/.exec(snapshot)?.[1];
      assert(inputRef && buttonRef, snapshot);
      assertFinal(await send(id, plan([{ name: 'browser', args: { action: 'fill', ref: inputRef, text: '真实操作成功' } },
        { name: 'browser', args: { action: 'click', ref: buttonRef } }])), 'completed');
      assert.equal(submitted, '真实操作成功');
      detail = await json(`/api/sessions/${id}`);
      assert.match(JSON.stringify(detail), /真实操作成功/);
      const other = await create();
      assertFinal(await send(other, plan([{ name: 'browser', args: { action: 'snapshot' } }])), 'completed');
      assert.match(JSON.stringify(await json(`/api/sessions/${other}`)), /about:blank/);
      assertFinal(await send(id, plan([{ name: 'browser', args: { action: 'navigate', url: 'file:///invalid' } }])), 'completed');
      assert((await json(`/api/sessions/${id}`)).messages.some((m: any) => m.role === 'tool' && m.content.some((b: any) => b.status === 'failed')));
    });
    await t.test('正文引用使用本轮来源、按正文去重排序，重启后可恢复', async () => {
      const id = await create({ projectPath: project });
      const fetchStep = (path: string) => ({ name: 'web_fetch', args: { url: url + path } });
      const cite = (source: string) => `[来源](#plotloom-source-${source})`;
      const finalText = `先引用第二页。${cite('{{source:1}}')} 再引用第一页。${cite('{{source:0}}')} 重复。${cite('{{source:1}}')} 未知。${cite('unknown')} 示例：\`${cite('{{source:2}}')}\``;
      assertFinal(await send(id, 'WRITE:' + JSON.stringify({ steps: [
        { name: 'browser', args: { action: 'navigate', url } }, fetchStep('/second'), fetchStep('/code-only'),
      ], finalText })), 'completed');
      const systemPrompt = fixture.requests.at(-1).messages.find((message: { role: string }) => message.role === 'system')?.content;
      assert.match(JSON.stringify(systemPrompt), /最终聊天回复中给出文档位置和带引用的关键结论/);
      assert.match(JSON.stringify(systemPrompt), /只有用户明确要求在文档中附来源时/);
      const first: SessionDetail = await json(`/api/sessions/${id}`);
      const results = first.messages.filter(message => message.role === 'tool').flatMap(message => message.content);
      const sources = results.flatMap(block => block.type === 'tool' && block.source ? [block.source] : []);
      assert.equal(sources.length, 3);
      for (const source of sources) assert(source.id);
      assert.deepEqual(first.messages.at(-1)?.citations, [sources[1], sources[0]]);
      assertFinal(await send(id, 'WRITE:' + JSON.stringify({ steps: [fetchStep('/next')], finalText: `旧轮次。${cite(sources[0].id!)}` })), 'completed');
      const after: SessionDetail = await json(`/api/sessions/${id}`);
      assert.equal(after.messages.at(-1)?.citations, undefined);
      await app.close(); app = await buildServer(options); address = await app.listen({ host: '127.0.0.1', port: 0 });
      assert.deepEqual(await json(`/api/sessions/${id}`), after);
    });
    await t.test('生成中可见快照、忙时拒绝重试、停止与失败可恢复', async () => {
      const id = await create(); const received = [];
      for await (const event of events(await request(`/api/sessions/${id}/messages`, 'POST', { text: 'WAIT:basic' }))) {
        received.push(event);
        if (event.type === 'text_delta') {
          const detail: SessionDetail = await json(`/api/sessions/${id}`);
          await json('/api/sessions/' + id + '/organization', 'PUT', { archived: true }, 409);
          await json('/api/sessions/' + id, 'DELETE', undefined, 409);
          assert(detail.messages.some(m => m.streaming && m.phase === 'process'));
          await json(`/api/sessions/${id}/retry`, 'POST', { messageId: detail.retryMessageId }, 409);
          await json(`/api/sessions/${id}/stop`, 'POST');
        }
      }
      assertFinal(received, 'aborted');
      assert.equal((await json(`/api/sessions/${id}`)).messages[0].outcome, 'aborted');
      assertFinal(await send(id, 'FAIL'), 'failed');
      assert.equal((await json(`/api/sessions/${id}`)).messages.at(-1).outcome, 'failed');
    });
    await t.test('浏览器等待中的操作可中止，停止后不继续点击', async () => {
      const id = await create();
      const text = plan([{ name: 'browser', args: { action: 'navigate', url } }, { name: 'browser', args: { action: 'click', selector: '#never-exists' } }]);
      const received = []; let count = 0;
      for await (const event of events(await request(`/api/sessions/${id}/messages`, 'POST', { text }))) {
        received.push(event);
        if (event.type === 'tool_start' && ++count === 2) {
          const started = Date.now();
          await json(`/api/sessions/${id}/stop`, 'POST');
          assert(Date.now() - started < 5000, '停止应中断浏览器等待，不等默认超时');
        }
      }
      assertFinal(received, 'aborted');
      assert.equal((await json(`/api/sessions/${id}`)).status, 'idle');
    });
    await t.test('重试保留原附件，用户历史不出现模型资料拼接', async () => {
      const id = await create();
      const attachment = await json(`/api/sessions/${id}/attachments`, 'POST', { name: 'notes.txt', mimeType: 'text/plain', data: Buffer.from('附件验收').toString('base64') }, 201);
      assertFinal(await collect(await request(`/api/sessions/${id}/messages`, 'POST', { text: '读取资料', attachmentIds: [attachment.id] })), 'completed');
      const before = await json(`/api/sessions/${id}`);
      assertFinal(await collect(await request(`/api/sessions/${id}/retry`, 'POST', { messageId: before.retryMessageId })), 'completed');
      const users = (await json(`/api/sessions/${id}`)).messages.filter((m: any) => m.role === 'user');
      assert.equal(users.length, 2);
      for (const user of users) { assert.equal(user.attachments[0].id, attachment.id); assert.deepEqual(user.content, [{ type: 'text', text: '读取资料' }]); }
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await app.close(); await fixture.close(); site.closeAllConnections(); await new Promise<void>(resolve => site.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
