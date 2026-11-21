import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startServer, collect, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';
import { TURN_START } from '../../packages/agent-pi/src/messages.ts';

const review = { name: 'review_writing', args: { status: 'clear', issues: [] } };
const proposal = (path: string, content: string) => ({ name: 'propose_change', args: { path, content, reason: '按本轮要求创作。' } });
const plan = (steps: unknown[], extra = {}) => 'WRITE:' + JSON.stringify({ steps, ...extra });

/** 真实服务子进程、真实 SDK 循环与文件；模型替身控制工具决策以验证业务边界。 */
test('P3 大纲留档、内容创作和候选闭环', { timeout: 120000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'plotloom-writing-')); const fixture = await createModelFixture();
  const book = join(dir, 'book'); const other = join(dir, 'other'); await mkdir(book); await mkdir(other);
  const models = join(dir, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: ['fixture', 'alternate'].map(id => ({ id, name: id, reasoning: true, input: ['text'], contextWindow: 128000,
      maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })) } } }));
  const env = { PLOTLOOM_DATA_DIR: join(dir, 'data'), PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const json = (...args: Parameters<typeof server.json>) => server.json(...args);
  const ws = await json('/api/workspaces', 'POST', { title: '灯塔', root: book }, 201);
  const ws2 = await json('/api/workspaces', 'POST', { title: '另一部', root: other }, 201);
  const chat = await json(`/api/workspaces/${ws.id}/sessions`, 'POST', {}, 201);
  const chat2 = await json(`/api/workspaces/${ws2.id}/sessions`, 'POST', {}, 201);
  const normal = await json('/api/sessions', 'POST', { projectPath: dir }, 201);
  const prefix = `/api/workspaces/${ws.id}`; const writing = `/api/sessions/${chat.id}/writing`;
  const read = (path: string) => json(`${prefix}/document/read`, 'POST', { path });
  const save = (path: string, content: string, baseVersion: string | null = null) => json(`${prefix}/document`, 'PUT', { path, content, baseVersion });
  const results = async () => (await json(writing)).requests;
  const send = async (body: any) => { const ev = await collect(await server.request(`${writing}/messages`, 'POST', body)); assertFinal(ev, 'completed'); return { ev, result: (await results())[0] }; };
  const decide = (p: any, action = 'accept') => json(`${prefix}/proposals/${p.id}/changes/${p.changes[0].id}`, 'POST', { action });
  const restart = async (force = false) => { await server.close(force); server = await startServer(env); };
  let outline: any; let character: any;
  try {
    await t.test('用户大纲逐字直接留档，不调用模型，重启与旧版本保护', async () => {
      const content = '\uFEFF# 第一章\r\n林舟在码头告别，带着灯塔钥匙离开。😀\r\n';
      const count = fixture.requests.length;
      outline = await json(`${prefix}/outlines`, 'POST', { path: '大纲/第一章.md', content, baseVersion: null });
      assert.equal(await readFile(join(book, outline.path), 'utf8'), content); assert.equal(fixture.requests.length, count);
      assert.equal((await json(`${prefix}/proposals`)).proposals.length, 0);
      await json(`${prefix}/outlines`, 'POST', { path: outline.path, content: '不能覆盖', baseVersion: null }, 409);
      await restart(); assert.equal((await read(outline.path)).content, content);
      character = await save('角色/林舟.md', '# 林舟\n性格：克制。\n禁忌：不说谎。\n');
      await save('历史/第三章.md', '# 第三章\n码头告别时，她交出铜钥匙。\n');
    });
    await t.test('上下文来自正式大纲、指定资料与精确版本，错误在生成前返回', async () => {
      const body = { task: 'chapter', instructions: '写第一章', target: { path: '章节/第一章.md', baseVersion: null }, outline: { path: outline.path, version: outline.version }, references: [{ path: character.path, version: character.version, role: 'character' }] };
      const context = await json(`${writing}/context`, 'POST', body);
      assert.deepEqual(context.sources.map((s: any) => s.role), ['target', 'outline', 'character']); assert.equal(context.sources[1].content, outline.content);
      assert.equal((await results()).length, 0);
      await json(`/api/sessions/${normal.id}/writing/context`, 'POST', body, 422);
      await json(`${writing}/context`, 'POST', { ...body, outline: undefined }, 400);
      await json(`${writing}/context`, 'POST', { ...body, target: { path: '../越界.md', baseVersion: null } }, 400);
      await json(`${writing}/context`, 'POST', { ...body, outline: { path: outline.path, version: '0'.repeat(64) } }, 409);
      const big = await save('超长.md', '字'.repeat(61000));
      await json(`${writing}/context`, 'POST', { task: 'discuss', instructions: '检查', references: [{ path: big.path, version: big.version, role: 'other' }] }, 422);
    });
    await t.test('读取、搜索、审校和章节候选，来源跨重启，采纳后才落正式稿', async () => {
      const { ev, result } = await send({ task: 'chapter', instructions: plan([
        { name: 'list_documents', args: {} }, { name: 'read_document', args: { path: character.path } },
        { name: 'search_documents', args: { query: '铜钥匙', paths: ['历史/第三章.md'] } }, review,
        proposal('章节/第一章.md', '# 第一章\n林舟攥住铜钥匙，背过身去。\n'),
      ]), target: { path: '章节/第一章.md', baseVersion: null }, outline: { path: outline.path, version: outline.version } });
      assert.equal(ev.filter(e => e.type === 'tool_end' && e.outcome === 'completed').length, 5);
      assert.equal(result.proposals.length, 1); assert.equal(result.review.status, 'clear');
      assert.equal(result.context.sources.find((s: any) => s.path === character.path).content, character.content);
      assert.equal((await read('章节/第一章.md')).version, null);
      const p = result.proposals[0]; assert.equal(p.origin.sessionId, chat.id); assert.equal(p.origin.requestId, result.id); assert.equal(p.references.length, 3);
      await restart(); assert.equal((await results())[0].id, result.id);
      const accepted = await decide(p); assert.equal(accepted.status, 'accepted'); await decide(p);
      const actual = await read(p.path); assert.equal(actual.content, p.content);
      const exported = await json(`${prefix}/export`, 'POST', { files: [{ path: p.path }] }); assert.equal(exported.files[0].content, actual.content);
    });
    await t.test('AI 丰富大纲先形成候选，未采纳正文仍引用原大纲', async () => {
      const body = { task: 'enrich_outline', instructions: plan([review, proposal(outline.path, '# 第一章\n保留码头告别，补充归还铜钥匙的动作。\n')]), target: { path: outline.path, baseVersion: outline.version } };
      const first = (await send(body)).result.proposals[0];
      assert.equal((await read(outline.path)).content, outline.content);
      const context = await json(`${writing}/context`, 'POST', { task: 'chapter', instructions: '写正文', target: { path: '章节/第二章.md', baseVersion: null }, outline: { path: outline.path, version: outline.version } });
      assert.equal(context.sources[1].content, outline.content); await decide(first, 'reject');
      assert.equal((await read(outline.path)).content, outline.content);
      const second = (await send(body)).result.proposals[0]; await decide(second); outline = await read(outline.path);
      assert.match(outline.content, /补充归还/);
    });
    await t.test('选区改写重复句与 emoji、尾部续写、历史恢复', async () => {
      const original = '前文😀\n同一句。\n中段\n同一句。\n后文\n';
      let doc = await save('章节/选区.md', original);
      const history = (await json(`${prefix}/history`, 'POST', { path: doc.path })).revisions;
      const start = original.lastIndexOf('同一句。');
      const p = (await send({ task: 'rewrite', instructions: plan([review, proposal(doc.path, '换一句！')]), target: { path: doc.path, baseVersion: doc.version, selection: { start, end: start + 4, text: '同一句。' } } })).result.proposals[0];
      assert.equal(p.content, original.slice(0, start) + '换一句！' + original.slice(start + 4)); await decide(p);
      doc = await read(doc.path); const before = doc.content;
      const continued = (await send({ task: 'continue', instructions: plan([review, proposal(doc.path, '新增尾部。\n')]), target: { path: doc.path, baseVersion: doc.version } })).result.proposals[0];
      assert.equal(continued.content, before + '新增尾部。\n'); await decide(continued);
      doc = await read(doc.path);
      const first = history.find((r: any) => r.version !== null);
      await json(`${prefix}/restore`, 'POST', { path: doc.path, revisionId: first.id, baseVersion: doc.version });
      assert.equal((await read(doc.path)).content, original);
    });
    await t.test('审校证据、具体冲突等待、目标约束与预算不会被模型绕过', async () => {
      const target = { path: '章节/约束.md', baseVersion: null };
      const conflict = { name: 'review_writing', args: { status: 'needs_input', issues: [{ kind: 'setting', message: '大纲要求说谎，与人物禁忌冲突，请作者说明。', evidence: [{ path: character.path, quote: '不说谎' }] }] } };
      const conflictRun = await send({ task: 'chapter', instructions: plan([conflict, review, proposal(target.path, '绕过冲突')]), target, outline: { path: outline.path, version: outline.version }, references: [{ path: character.path, version: character.version, role: 'character' }] });
      assert.equal(conflictRun.result.review.status, 'needs_input'); assert.equal(conflictRun.result.proposals.length, 0);
      assert.equal(conflictRun.ev.filter(e => e.type === 'tool_end' && e.outcome === 'failed').length, 2);
      const bad = await send({ task: 'discuss', instructions: plan([
        { name: 'review_writing', args: { status: 'needs_input', issues: [{ kind: 'setting', message: '假引文', evidence: [{ path: character.path, quote: '从未出现的句子' }] }] } },
        proposal(target.path, '未审校'), review, proposal('其他.md', '错误目标'), proposal(target.path, '字'.repeat(201)),
      ]), target, references: [{ path: character.path, version: character.version, role: 'character' }], maxOutputChars: 200 });
      assert.equal(bad.result.proposals.length, 0); assert.equal(bad.ev.filter(e => e.type === 'tool_end' && e.outcome === 'failed').length, 4);
    });
    await t.test('生成期间外部改稿拒绝旧候选，生成后参考变化拒绝采纳', async () => {
      const doc = await save('章节/并发.md', '旧稿\n');
      const prompt = plan([review, proposal(doc.path, 'AI改稿\n')], { waitBefore: 1 });
      const ev = [];
      for await (const e of events(await server.request(`${writing}/messages`, 'POST', { task: 'rewrite', instructions: prompt, target: { path: doc.path, baseVersion: doc.version, selection: { start: 0, end: doc.content.length, text: doc.content } } }))) {
        ev.push(e); if (e.type === 'text_delta' && e.delta === '等待测试继续。') { await writeFile(join(book, doc.path), '外部新稿\n'); fixture.release(prompt); }
      }
      assert(ev.some(e => e.type === 'tool_end' && e.name === 'propose_change' && e.outcome === 'failed')); assert.equal((await results())[0].proposals.length, 0);
      assert.equal((await read(doc.path)).content, '外部新稿\n');
      const p = (await send({ task: 'chapter', instructions: plan([review, proposal('章节/引用.md', '参考人物写作\n')]), target: { path: '章节/引用.md', baseVersion: null }, outline: { path: outline.path, version: outline.version }, references: [{ path: character.path, version: character.version, role: 'character' }] })).result.proposals[0];
      character = await save(character.path, character.content + '新增要求。\n', character.version);
      const conflict = await json(`${prefix}/proposals/${p.id}/changes/${p.changes[0].id}`, 'POST', { action: 'accept' }, 409); assert.equal(conflict.error.code, 'REFERENCE_CONFLICT');
      assert.equal((await read(p.path)).version, null);
    });
    await t.test('小说普通消息可读资料，跨书/越界不可用，项目聊天不获得小说工具', async () => {
      const instructions = plan([{ name: 'read_document', args: { path: character.path } }, { name: 'read_document', args: { path: '../other/秘密.md' } }]);
      const ev = await collect(await server.request(`/api/sessions/${chat.id}/messages`, 'POST', { text: instructions }));
      assert(ev.some(e => e.type === 'tool_end' && e.outcome === 'failed')); assert.equal((await results())[0].context.sources[0].content, character.content);
      assert(!fixture.requests.at(-1).tools.some((v: any) => v.function.name === 'read_fixture'));
      assert.doesNotMatch(JSON.stringify(fixture.requests.at(-1).messages.filter((m: any) => m.role === 'system')), /给出 A、B 候选/);
      const otherEvents = await collect(await server.request(`/api/sessions/${chat2.id}/messages`, 'POST', { text: plan([{ name: 'read_document', args: { path: character.path } }]) }));
      assert(otherEvents.some(e => e.type === 'tool_end' && e.outcome === 'failed'));
      await collect(await server.request(`/api/sessions/${normal.id}/messages`, 'POST', { text: '普通消息' }));
      assert(!fixture.requests.at(-1).tools.some((v: any) => v.function.name === 'read_document'));
    });
    await t.test('停止、断流和真实强退后保留已完成候选，正式稿不变', async () => {
      const target = { path: '章节/停止.md', baseVersion: null };
      const prompt = plan([review, proposal(target.path, '已经完成的候选\n')], { waitBefore: 2 });
      const ev = [];
      for await (const e of events(await server.request(`${writing}/messages`, 'POST', { task: 'chapter', instructions: prompt, target, outline: { path: outline.path, version: outline.version } }))) {
        ev.push(e); if (e.type === 'text_delta') await json(`/api/sessions/${chat.id}/stop`, 'POST');
      }
      assertFinal(ev, 'aborted'); const saved = (await results())[0]; assert.equal(saved.proposals.length, 1); assert.equal(saved.outcome, 'aborted'); assert.equal((await read(target.path)).version, null);
      const waiting = 'WAIT:p3-restart';
      const stream = events(await server.request(`${writing}/messages`, 'POST', { task: 'discuss', instructions: waiting }));
      for await (const e of stream) if (e.type === 'text_delta') break; // 断流不停止服务。
      assert.equal((await json(`/api/sessions/${chat.id}`)).activity, 'generating');
      await json(`${writing}/messages`, 'POST', { task: 'discuss', instructions: '并发消息' }, 409);
      await restart(true); const recovered = await results(); assert.equal(recovered[0].outcome, 'aborted'); assert.equal(recovered[1].id, saved.id); assert.equal(recovered[1].proposals.length, 1);
    });
    await t.test('结构化重试跨重启保留选区、大纲、参考片段、预算和模型配置', async () => {
      const session = '/api/sessions/' + chat.id;
      await json(session + '/config', 'PUT', { thinkingLevel: 'low' });
      const doc = await save('章节/重试.md', '前文😀\r\n重复句。\r\n中段\r\n重复句。\r\n结尾\r\n');
      const start = doc.content.lastIndexOf('重复句。');
      const input = {
        task: 'rewrite', instructions: plan([review, proposal(doc.path, '改过的后句。')]),
        target: { path: doc.path, baseVersion: doc.version, selection: { start, end: start + 4, text: '重复句。' } },
        outline: { path: outline.path, version: outline.version },
        references: [{ path: character.path, version: character.version, role: 'character', selection: { start: 0, end: 5, text: '# 林舟\n' } }],
        maxOutputChars: 300, skillIds: ['builtin-novel-writing'],
      };
      const before = (await send(input)).result;
      const modelRequest = fixture.requests.at(-1);
      const oldId = (await json(session)).retryMessageId;
      await json(session + '/config', 'PUT', { provider: 'test', model: 'alternate', thinkingLevel: 'medium', autoCompaction: false });
      await restart();
      const replay = await collect(await server.request(session + '/retry', 'POST', { messageId: oldId }));
      assertFinal(replay, 'completed');
      const [after, previous] = await results();
      assert.deepEqual(after.context, before.context);
      assert.equal(previous.id, before.id);
      assert.notEqual(after.id, before.id);
      assert.notEqual(after.proposals[0].id, before.proposals[0].id);
      assert.equal(after.proposals[0].content, doc.content.slice(0, start) + '改过的后句。' + doc.content.slice(start + 4));
      assert.equal((await read(doc.path)).content, doc.content);
      const retriedRequest = fixture.requests.at(-1);
      assert.equal(retriedRequest.model, 'fixture');
      assert.equal(modelRequest.reasoning_effort, 'low');
      assert.equal(retriedRequest.reasoning_effort, modelRequest.reasoning_effort);
      assert.equal((await json(session + '/config')).model, 'alternate');
      assert.equal((await json(session + '/config')).thinkingLevel, 'medium');
      assert.equal((await json(session + '/config')).autoCompaction, false);
      assert.equal((await json(session + '/retry', 'POST', { messageId: oldId }, 409)).error.code, 'RETRY_UNAVAILABLE');

      const newId = (await json(session)).retryMessageId;
      const count = fixture.requests.length;
      await writeFile(join(book, character.path), character.content + ' 外部改动。');
      assert.equal((await json(session + '/retry', 'POST', { messageId: newId }, 409)).error.code, 'REVISION_CONFLICT');
      await writeFile(join(book, character.path), character.content);
      await writeFile(join(book, doc.path), doc.content + '外部改稿。');
      assert.equal((await json(session + '/retry', 'POST', { messageId: newId }, 409)).error.code, 'REVISION_CONFLICT');
      assert.equal(fixture.requests.length, count, '旧版本在调用模型前拒绝');
      await writeFile(join(book, doc.path), doc.content);
      await json('/api/skills/builtin-novel-writing/enabled', 'PUT', { enabled: false });
      assert.equal((await json(session + '/retry', 'POST', { messageId: newId }, 422)).error.code, 'SKILL_UNAVAILABLE');
      await json('/api/skills/builtin-novel-writing/enabled', 'PUT', { enabled: true });
      const normal = await collect(await server.request(session + '/messages', 'POST', { text: '检查当前配置' }));
      assertFinal(normal, 'completed');
      assert.equal(fixture.requests.at(-1).model, 'alternate');
    });
    await t.test('旧结构化轮次可恢复为原任务，重试期间仍可停止', async () => {
      const session = '/api/sessions/' + chat.id;
      const doc = await save('章节/旧续写.md', '原文\n');
      const body = { task: 'continue', instructions: plan([review, proposal(doc.path, '续文\n')], { waitBefore: 0 }),
        target: { path: doc.path, baseVersion: doc.version }, maxOutputChars: 450 };
      async function stopRun(path: string, body: unknown) {
        const received = [];
        for await (const event of events(await server.request(path, 'POST', body))) {
          received.push(event);
          if (event.type === 'text_delta') await json(session + '/stop', 'POST');
        }
        assertFinal(received, 'aborted');
        return (await results())[0];
      }
      const before = await stopRun(writing + '/messages', body);
      const { retryMessageId } = await json(session);
      await server.close();
      const sessions = join(env.PLOTLOOM_DATA_DIR, 'sessions');
      const file = (await readdir(sessions)).find(name => name.endsWith(chat.id + '.jsonl'));
      assert(file);
      const log = join(sessions, file);
      const entries = (await readFile(log, 'utf8')).trimEnd().split('\n').map(line => JSON.parse(line));
      const lastTurn = entries.findLast(entry => entry.customType === TURN_START);
      assert(lastTurn.data.businessInput);
      // 模拟旧版轮次，仅保留当时已写入的通用参数和独立创作上下文。
      delete lastTurn.data.businessInput;
      delete lastTurn.data.execution;
      await writeFile(log, entries.map(entry => JSON.stringify(entry)).join('\n') + '\n');
      server = await startServer(env);
      const after = await stopRun(session + '/retry', { messageId: retryMessageId });
      assert.deepEqual(after.context, before.context);
      assert.notEqual(after.id, before.id);
      assert.equal((await read(doc.path)).content, doc.content);

      await json(session + '/config', 'PUT', { model: 'fixture', provider: 'test', thinkingLevel: 'high' });
      const replayId = (await json(session)).retryMessageId;
      const interrupted = events(await server.request(session + '/retry', 'POST', { messageId: replayId }));
      for await (const event of interrupted) {
        if (event.type === 'text_delta') break;
      }
      assert.equal(fixture.requests.at(-1).model, 'alternate');
      assert.equal(fixture.requests.at(-1).reasoning_effort, 'medium');
      assert.equal((await json(session + '/config')).thinkingLevel, 'high');
      await restart(true);
      assert.equal((await json(session + '/config')).model, 'fixture');
      assert.equal((await json(session + '/config')).thinkingLevel, 'high');
      assert.equal((await results())[0].outcome, 'aborted');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); await fixture.close();
    // 只清理由本测试 mkdtemp 创建的临时作品和应用数据。
    await rm(dir, { recursive: true, force: true });
  }
});
