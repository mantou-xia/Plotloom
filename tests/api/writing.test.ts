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
      const beforeAccept = await json('/api/sessions/' + chat.id);
      const sourceTurn = beforeAccept.messages.findLast((m: { role: string }) => m.role === 'user').turnId;
      assert(!beforeAccept.fileChanges?.some((item: { turnId: string }) => item.turnId === sourceTurn));
      const accepted = await decide(p); assert.equal(accepted.status, 'accepted'); await decide(p);
      const summary = (await json('/api/sessions/' + chat.id)).fileChanges.find((item: { turnId: string }) => item.turnId === sourceTurn);
      assert.equal(summary.files[0].path, p.path);
      assert.equal(summary.files[0].writeIds.length, 1, '重复采纳不产生第二条写入');
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
      const first = await json(`${prefix}/finalize`, 'POST', { path: doc.path, baseVersion: doc.version });
      const start = original.lastIndexOf('同一句。');
      const p = (await send({ task: 'rewrite', instructions: plan([review, proposal(doc.path, '换一句！')]), target: { path: doc.path, baseVersion: doc.version, selection: { start, end: start + 4, text: '同一句。' } } })).result.proposals[0];
      assert.equal(p.content, original.slice(0, start) + '换一句！' + original.slice(start + 4)); await decide(p);
      doc = await read(doc.path); const before = doc.content;
      const continued = (await send({ task: 'continue', instructions: plan([review, proposal(doc.path, '新增尾部。\n')]), target: { path: doc.path, baseVersion: doc.version } })).result.proposals[0];
      assert.equal(continued.content, before + '新增尾部。\n'); await decide(continued);
      doc = await read(doc.path);
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
    await t.test('世界观需逐条确认，按生效与揭示章节引用；交稿建议依赖对应正式稿', async () => {
      const world = '世界观.md';
      const session = '/api/sessions/' + chat.id;
      const directWrite = await server.request(session + '/messages', 'POST', { text: plan([
        { name: 'write', args: { path: world, content: '第五、六章全城宵禁。' } },
      ]) });
      const directEvents = [];
      for await (const event of events(directWrite)) {
        directEvents.push(event);
        if (event.type === 'tool_approval_required') {
          await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'deny' });
        }
      }
      assertFinal(directEvents, 'completed');
      assert(!directEvents.some(event => event.type === 'tool_approval_required' || event.type === 'user_answer_required'));
      assert(directEvents.some(event => event.type === 'tool_end' && event.name === 'write' && event.outcome === 'failed'));
      assert.equal((await read(world)).version, null);
      const rule = { subject: '内功境界', fact: '宗师之上还有归元境。', effective: 1, revealed: 10,
        evidence: { quote: '宗师之上还有归元境。' } };
      const steps = (args: typeof rule) => [{ name: 'propose_world_rule', args }];
      for (const index of [0, 2, 1]) {
        const stream = await server.request(session + '/messages', 'POST', { text: plan(steps(rule)) });
        const seen = [];
        for await (const event of events(stream)) {
          seen.push(event);
          if (event.type === 'tool_approval_required') {
            assert.match(event.approval.preview, /归元境/);
            assert.equal((await read(world)).version, null);
            if (index === 0) await json(session + '/stop', 'POST');
            else await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: index === 1 ? 'approve' : 'deny' });
          }
        }
        assert(seen.some(event => event.type === 'tool_approval_required'));
        assertFinal(seen, index === 0 ? 'aborted' : 'completed');
        assert.equal((await read(world)).version === null, index !== 1);
      }
      const nextChat = await json(prefix + '/sessions', 'POST', {}, 201);
      const context = async (chapterNumber: number) => (await json('/api/sessions/' + nextChat.id + '/writing/context',
        'POST', { task: 'discuss', chapterNumber, instructions: '核对设定' })).sources[0].content;
      assert.equal(await context(4), '');
      assert.match(await context(10), /归元境/);
      const early = await collect(await server.request('/api/sessions/' + nextChat.id + '/writing/messages', 'POST', {
        task: 'discuss', chapterNumber: 4, instructions: plan([{ name: 'read_document', args: { path: world } },
          { name: 'search_documents', args: { query: '宗师', paths: [world] } }, { name: 'read', args: { path: world } }, { name: 'grep', args: { path: world, pattern: '归元境' } }]) }));
      assertFinal(early, 'completed');
      const toolMessages = fixture.requests.at(-1).messages.filter((m: any) => m.role === 'tool');
      assert.equal(toolMessages.length, 4);
      assert.doesNotMatch(JSON.stringify(toolMessages), /归元境/);
      const source = { path: '正文章节/第十二章.md', baseVersion: null };
      const quote = '凡以血契传功，师徒都要承受同样的伤。';
      const { result } = await send({ task: 'chapter', instructions: plan([review, proposal(source.path, quote),
        { name: 'propose_world_rule', args: { subject: '血契传功', fact: quote, effective: 1, revealed: 12, impact: '全书任何一次以血契传功，师徒都须承受同样的伤。', evidence: { path: source.path, quote } } }]),
        target: source, outline: { path: outline.path, version: outline.version } });
      const chapter = result.proposals.find((p: any) => p.path === source.path);
      const change = result.proposals.find((p: any) => p.path === world);
      assert(chapter && change);
      await json(prefix + '/proposals/' + change.id + '/changes/' + change.changes[0].id, 'POST', { action: 'accept' }, 409);
      await decide(chapter); await decide(change);
      assert.doesNotMatch(await context(11), /血契/);
      assert.match(await context(12), /血契/);
      assert.doesNotMatch(await context(4), /归元|血契/);
    });
    await t.test('新章交稿后可提议全书规则，阶段性剧情、缺少影响说明和过期证据无法保存', async () => {
      const session = '/api/sessions/' + chat.id;
      const world = '世界观.md';
      const before = await read(world);
      const rule = '任何人施术复活死者，都要折损自己的寿命。';
      const impact = '全书任何一章出现复活，施术者均须承担折寿的代价。';
      for (const scenario of ['temporary', 'missingImpact', 'edited', 'accepted'] as const) {
        const number = { temporary: 21, missingImpact: 24, edited: 22, accepted: 23 }[scenario];
        const temporary = scenario === 'temporary';
        const quote = temporary ? '城门从今日起关闭两天，林舟只能走水路。' : rule;
        const seen = [];
        const text = `写第${number}章：${quote}\n` + plan([
          { name: 'write_chapter_part', args: { part: 1, content: quote } }, review,
          { name: 'deliver_chapter', args: { partCount: 1, reason: '交稿' } },
          { name: 'list_documents', args: {} },
          { name: 'propose_world_rule', args: {
            subject: temporary ? '城门关闭' : '复活代价', fact: quote, effective: temporary ? number : 1, revealed: number,
            evidence: { path: `正文章节/第${number}章.md`, quote },
            ...(scenario === 'missingImpact' ? {} : { impact: temporary ? '接下来两章，进城必须走水路。' : impact }),
          } },
        ]);
        for await (const event of events(await server.request(session + '/messages', 'POST', { text }))) {
          seen.push(event);
          if (event.type !== 'tool_approval_required' && event.type !== 'user_answer_required') continue;
          const preview = event.type === 'tool_approval_required' ? event.approval.preview : event.question.question;
          if (preview.includes('对全书写作的约束')) {
            assert(scenario === 'edited' || scenario === 'accepted');
            assert(preview.includes(impact));
            if (scenario === 'edited') {
              const path = `正文章节/第${number}章.md`;
              const doc = await read(path);
              await save(path, '作者改稿：复活代价暂未揭示。', doc.version);
            }
          }
          if (event.type === 'tool_approval_required')
            await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
          else await json(session + '/questions/' + event.question.id + '/answer', 'POST', { kind: 'option', index: 1 });
        }
        assertFinal(seen, 'completed');
        const result = seen.find(event => event.type === 'tool_end' && event.name === 'propose_world_rule');
        assert(result?.type === 'tool_end');
        assert.equal(result.outcome, scenario === 'accepted' ? 'completed' : 'failed');
        if (scenario === 'accepted') assert.match((await read(world)).content, /生效章节：1\n揭示章节：23\n\n任何人施术复活死者/);
        else assert.equal((await read(world)).version, before.version);
      }
    });
    await t.test('普通聊天的润色候选可在右侧审阅，也可从旧工具结果恢复', async () => {
      const path = '正文章节/润色验证.md';
      const before = '雨下得很大。';
      const after = '雨点敲着窗沿。';
      await save(path, before);
      const session = '/api/sessions/' + chat.id;
      const result = await collect(await server.request(session + '/messages', 'POST', { text: plan([
        { name: 'read_document', args: { path } }, review, proposal(path, after),
      ]) }));
      assertFinal(result, 'completed');
      const completion = result.find(event => event.type === 'tool_end' && event.name === 'propose_change');
      assert(completion?.type === 'tool_end' && completion.manuscriptView?.proposalId);
      const view = completion.manuscriptView;
      assert.deepEqual((await json(session)).manuscriptRequest.view, view);
      const pending = await json(`${prefix}/proposals/${view.proposalId}`);
      assert.equal(pending.status, 'pending');
      assert.equal((await read(path)).content, before);

      await server.close();
      const sessions = join(env.PLOTLOOM_DATA_DIR, 'sessions');
      const name = (await readdir(sessions)).find(file => file.endsWith(chat.id + '.jsonl'));
      assert(name);
      const log = join(sessions, name);
      const entries = (await readFile(log, 'utf8')).trimEnd().split('\n').map(line => JSON.parse(line));
      const viewIndex = entries.findIndex(entry => entry.customType === 'plotloom-manuscript-view' && entry.data?.view?.proposalId === view.proposalId);
      assert(viewIndex >= 0);
      const [removed] = entries.splice(viewIndex, 1);
      // 模拟产生候选却未保存定位的旧会话，保留工具结果及可读分支。
      for (const entry of entries) if (entry.parentId === removed.id) entry.parentId = removed.parentId;
      const legacy = entries.find(entry => entry.message?.role === 'toolResult' && entry.message?.details?.id === view.proposalId);
      assert(legacy);
      delete legacy.message.details.view;
      await writeFile(log, entries.map(entry => JSON.stringify(entry)).join('\n') + '\n');
      server = await startServer(env);
      const recovered = (await json(session)).manuscriptRequest;
      assert.equal(recovered.id, legacy.id);
      assert.deepEqual(recovered.view, view);
      await decide(pending);
      assert.equal((await read(path)).content, after);
    });
    await t.test('面板修改直接生成右侧候选，只有采纳才更新正式稿', async () => {
      const path = '正文章节/局部修改.md';
      const before = '开头保持\n原来的对白。\n结尾保持';
      const after = before.replace('原来的对白。', '修改后的对白。');
      await save(path, before);
      const session = '/api/sessions/' + chat.id;
      for (const action of ['reject', 'accept']) {
        const response = await server.request(session + '/messages', 'POST', { text: plan([
          { name: 'read_document', args: { path } }, { name: 'manuscript_workspace', args: { action: 'edit', path, content: after } },
        ]) });
        const result = await collect(response);
        assertFinal(result, 'completed');
        assert(!result.some(event => event.type === 'tool_approval_required' || event.type === 'user_answer_required'));
        const applied = result.find(event => event.type === 'tool_end' && event.name === 'manuscript_workspace');
        assert(applied?.type === 'tool_end' && applied.manuscriptView?.proposalId);
        const view = applied.manuscriptView;
        assert.deepEqual((await json(session)).manuscriptRequest.view, view);
        assert.equal(view.path, path);
        const proposal = await json(`${prefix}/proposals/${view.proposalId}`);
        assert.equal(proposal.status, 'pending');
        assert.equal((await read(path)).content, before);
        await decide(proposal, action);
        assert.equal((await read(path)).content, action === 'accept' ? after : before);
      }
    });
    await t.test('定稿和回退仍需确认，拒绝不留档，回退核对确认前的磁盘版本', async () => {
      const path = '正文章节/第三章.md';
      const doc = await save(path, '第三章初稿');
      const session = '/api/sessions/' + chat.id;
      async function operate(action: string, index: number, revisionId?: string, onQuestion?: () => Promise<void>) {
        const results = [];
        const response = await server.request(session + '/messages', 'POST', { text: plan([{ name: 'manuscript_workspace',
          args: { action, path, ...(revisionId ? { revisionId } : {}) } }]) });
        for await (const event of events(response)) {
          results.push(event);
          if (event.type === 'tool_approval_required') {
            await onQuestion?.();
            await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: index === 1 ? 'approve' : 'deny' });
          }
        }
        assert.equal(results.filter(event => event.type === 'tool_approval_required').length, 1);
        assertFinal(results, 'completed');
        return results.find(event => event.type === 'tool_end' && event.name === 'manuscript_workspace');
      }
      const before = () => json(prefix + '/history', 'POST', { path });
      await operate('finalize', 2);
      assert.deepEqual((await before()).revisions, []);
      await operate('finalize', 1);
      const [final] = (await before()).revisions;
      const edited = await save(path, '第三章新稿', doc.version);
      const failed = await operate('restore', 1, final.id, async () => { await save(path, '等待确认时的手改', edited.version); });
      assert(failed?.type === 'tool_end');
      assert.equal(failed.outcome, 'failed');
      assert.equal((await read(path)).content, '等待确认时的手改');
      const restored = await operate('restore', 1, final.id);
      assert(restored?.type === 'tool_end');
      assert.deepEqual(restored.manuscriptView, { workspaceId: ws.id, path, mode: 'edit' });
      assert.deepEqual((await json(session)).manuscriptRequest.view, restored.manuscriptView);
      assert.equal((await read(path)).content, doc.content);
      assert.equal((await before()).revisions.length, 1);
    });
    await t.test('确认导出得到单次下载指令，停止或拒绝保留上一条指令', async () => {
      const session = '/api/sessions/' + chat.id;
      const path = '正文章节/导出测试.md';
      await save(path, '# 开船\n\n“等潮退了再走。”');
      let downloadId: string | undefined;
      for (const decision of ['accept', 'reject', 'stop']) {
        const stream = await server.request(session + '/messages', 'POST', { text: plan([
          { name: 'manuscript_workspace', args: { action: 'export_txt', path } },
        ]) });
        const received = [];
        for await (const event of events(stream)) {
          received.push(event);
          if (event.type !== 'user_answer_required') continue;
          if (decision === 'stop') await json(session + '/stop', 'POST');
          else await json(session + '/questions/' + event.question.id + '/answer', 'POST', { kind: 'option', index: decision === 'accept' ? 1 : 2 });
        }
        assertFinal(received, decision === 'stop' ? 'aborted' : 'completed');
        const result = received.find(event => event.type === 'tool_end' && event.manuscriptView);
        if (decision === 'accept') {
          assert(result?.type === 'tool_end');
          assert.equal(result.manuscriptView?.mode, 'export_txt');
          assert.equal(result.manuscriptView.path, path);
          downloadId = result.manuscriptView.downloadId;
          assert(downloadId);
        } else assert.equal(result, undefined);
        assert.equal((await json(session)).manuscriptRequest.view.downloadId, downloadId);
      }
    });
    await t.test('旧稿附件只在作者确认后导入，保留正文、可重试且不覆盖手改', async () => {
      const session = '/api/sessions/' + chat2.id;
      const bookPath = '/api/workspaces/' + ws2.id;
      const attach = async (name: string, file: string) => (await json(session + '/attachments', 'POST',
        { name, mimeType: 'text/plain', data: Buffer.from(file).toString('base64') }, 201)).id;
      const originals = ['\r\n第一章重回\r\n作者正文😀\r\n\r\n第二段。', '第二章往日\r\n原文段落。\r\n', '第三章访客\r\n保留空行。\r\n\r\n'];
      const ids = await Promise.all(originals.map((file, index) => attach(`样本${index + 1}.txt`, file)));
      const expected = ['正文章节/第1章.md', '正文章节/第2章.md', '正文章节/第3章.md'];
      const paths = async () => (await json(bookPath + '/documents')).paths.filter((path: string) => path.startsWith('正文章节/'));
      async function run(attachmentIds: string[], decision: 'accept' | 'skip' | 'stop' | 'ambiguous', expectedCount = 0,
        expectedTitles = /第一章重回[\s\S]*第二章往日[\s\S]*第三章访客/) {
        const received = [];
        for await (const event of events(await server.request(session + '/messages', 'POST', {
          text: plan([{ name: 'import_chapters', args: {} }]), attachmentIds,
        }))) {
          received.push(event);
          if (event.type !== 'tool_approval_required') continue;
          assert.equal((await paths()).length, expectedCount);
          assert.match(event.approval.preview, expectedTitles);
          if (decision === 'stop') await json(session + '/stop', 'POST');
          else await json(session + '/tool-approvals/' + event.approval.id, 'POST',
            { decision: decision === 'accept' ? 'approve' : 'deny' });
        }
        assertFinal(received, decision === 'stop' ? 'aborted' : 'completed');
        assert.equal(received.some(event => event.type === 'tool_approval_required'), decision !== 'ambiguous');
        return received.find(event => event.type === 'tool_end' && event.name === 'import_chapters');
      }
      await run([await attach('没有章号.txt', '需要先核对的正文。')], 'ambiguous');
      await run(ids, 'skip');
      await run(ids, 'stop');
      assert.deepEqual(await paths(), []);
      const imported = await run(ids, 'accept');
      assert(imported?.type === 'tool_end');
      assert.equal(imported.manuscriptView?.path, expected[0]);
      assert.deepEqual((await paths()).sort(), expected.slice().sort());
      for (const [index, path] of expected.entries()) {
        const original = originals[index].replace(/^\r\n/, '');
        assert.equal(await readFile(join(other, path), 'utf8'), '# ' + original.replace('\r\n', '\r\n\r\n'));
      }
      await run(ids, 'accept', 3);
      const doc = await json(bookPath + '/document/read', 'POST', { path: expected[1] });
      await json(bookPath + '/document', 'PUT', { path: doc.path, baseVersion: doc.version, content: '作者手改。' });
      const conflict = await run(ids, 'accept', 3);
      assert(conflict?.type === 'tool_end' && conflict.outcome === 'failed');
      assert.equal(await readFile(join(other, expected[1]), 'utf8'), '作者手改。');
      const legacy = '正文章节/第十一章 旧标题.md';
      await json(bookPath + '/document', 'PUT', { path: legacy, baseVersion: null, content: '# 第十一章 旧标题\n\n原文。' });
      const legacyId = await attach('旧格式.txt', '第十一章 旧标题\n原文。');
      const reused = await run([legacyId], 'accept', 4, /第十一章 旧标题/);
      assert(reused?.type === 'tool_end' && reused.outcome === 'completed');
      assert.equal(reused.manuscriptView?.path, legacy);
      const different = await attach('冲突.txt', '第十一章 旧标题\n不同正文。');
      const legacyConflict = await run([different], 'accept', 4, /第十一章 旧标题/);
      assert(legacyConflict?.type === 'tool_end' && legacyConflict.outcome === 'failed');
      assert.deepEqual((await paths()).sort(), [...expected, legacy].sort());
      assert.equal(await readFile(join(other, legacy), 'utf8'), '# 第十一章 旧标题\n\n原文。');
    });
    await t.test('聊天大纲交付新章，重写候选保护作者正文及重试版本', async () => {
      const session = '/api/sessions/' + chat2.id;
      const base = '/api/workspaces/' + ws2.id;
      const path = '正文章节/第4章.md';
      const stage = (chapter: number, note: string) => json(base + '/character-cards', 'POST', { character: '林舟', chapter, note,
        content: '## 性格特点\n### 表征\n随和\n### 内在\n谨慎\n\n## 愿景\n### 明示\n安全\n### 潜意识\n保护妹妹' }, 201);
      const currentCard = await stage(3, '守约');
      const futureCard = await stage(10, '离乡');
      await json(base + '/document', 'PUT', { path: '世界观.md', baseVersion: null,
        content: '# 世界观\n\n## 隐藏境界\n生效章节：1\n揭示章节：10\n\n归元境。\n' });
      const target = (file = path) => json(base + '/document/read', 'POST', { path: file });
      const part = (part: number, content: string) => ({ name: 'write_chapter_part', args: { part, content } });
      const deliver = { name: 'deliver_chapter', args: { partCount: 2, reason: '按大纲完成整章' } };
      // 真实中止进程后重试只生成第二段；最终确认卡必须包含重启前已成功暂存的第一段。
      const firstPart = '保留的第一段。'.repeat(150);
      const secondPart = '续写的第二段。'.repeat(150);
      const resumePlan = plan([part(1, firstPart)], { waitBefore: 1,
        resumedSteps: [part(2, secondPart), review, deliver] });
      const stream = events(await server.request(session + '/messages', 'POST', { text: '写第四章：码头。\n' + resumePlan }));
      for await (const event of stream) if (event.type === 'text_delta' && event.delta === '等待测试继续。') break;
      await restart(true);
      const retryEvents = [];
      for await (const event of events(await server.request(session + '/retry', 'POST', { messageId: (await json(session)).retryMessageId }))) {
        retryEvents.push(event);
        if (event.type === 'tool_approval_required') {
          assert(event.approval.preview.endsWith(firstPart + '\n\n' + secondPart));
          await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'deny' });
        }
      }
      assertFinal(retryEvents, 'completed');
      assert(fixture.requests.at(-1).messages.some((m: any) => JSON.stringify(m.content).includes('重试已恢复的草稿如下')));
      assert.equal(retryEvents.filter(e => e.type === 'tool_approval_required').length, 1);
      assert.equal((await target()).version, null);
      const sendChapter = async (command: string, answer: number, expected: string, file = path) => {
        const received = [];
        for await (const event of events(await server.request(session + '/messages', 'POST', { text:
          command + '，大纲如下本章大纲：\n\n1. 林舟从第三章接续。\n' + plan([part(1, '初稿。'), part(1, '第四章'), part(2, '交稿。'), review, deliver]) }))) {
          received.push(event);
          if (event.type !== 'tool_approval_required') continue;
          assert.equal(event.approval.path, file);
          assert.equal((await target(file)).content, expected);
          await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: answer === 1 ? 'approve' : 'deny' });
        }
        assertFinal(received, 'completed');
        assert.equal(received.filter(event => event.type === 'tool_approval_required').length, 1);
        return received.find(event => event.type === 'tool_end' && event.name === 'deliver_chapter');
      };
      const priorWrites = (await json(session + '/project-writes')).changes;
      await sendChapter('写第四章', 2, '');
      assert.deepEqual((await json(session + '/project-writes')).changes, priorWrites);
      assert.equal((await target()).version, null);
      const created = await sendChapter('完成第四章', 1, '');
      assert(created?.type === 'tool_end');
      assert.equal(created.manuscriptView?.path, path);
      const write = (await json(session + '/project-writes')).changes.at(-1);
      assert.equal(write.path, path);
      assert.equal((await json(session + '/project-writes/' + write.id)).blocks[0].kind, 'added');
      assert.equal((await json(session)).fileChanges.at(-1).files[0].path, path);
      const fresh = await target();
      assert.equal(fresh.content, '第四章\n\n交稿。');
      const record = (await json(session + '/writing')).requests[0];
      assert.equal(record.context.chapterNumber, 4);
      assert(record.context.sources.some((source: any) => source.role === 'history' && source.path === '正文章节/第3章.md'));
      assert(record.context.sources.some((source: any) => source.role === 'character' && source.path === currentCard.path));
      assert(!record.context.sources.some((source: any) => source.path === futureCard.path));
      assert.doesNotMatch(record.context.sources.find((source: any) => source.path === '世界观.md').content, /归元境/);
      const retry = await json(session + '/retry', 'POST', { messageId: (await json(session)).retryMessageId }, 409);
      assert.equal(retry.error.code, 'REVISION_CONFLICT');
      await json(base + '/document', 'PUT', { path, baseVersion: fresh.version, content: '作者手改对白。' });
      const rewritten = await sendChapter('重写第四章', 1, '作者手改对白。');
      assert(rewritten?.type === 'tool_end' && rewritten.manuscriptView?.proposalId);
      const proposal = await json(base + '/proposals/' + rewritten.manuscriptView.proposalId);
      assert.equal(proposal.baseContent, '作者手改对白。');
      assert.equal((await target()).content, '作者手改对白。');
      await json(base + '/proposals/' + proposal.id + '/changes/' + proposal.changes[0].id, 'POST', { action: 'accept' });
      assert.equal((await target()).content, fresh.content);
      const olderFile = '正文章节/第十一章 旧标题.md';
      const legacyRewrite = await sendChapter('重写第11章', 1, '# 第十一章 旧标题\n\n原文。', olderFile);
      assert(legacyRewrite?.type === 'tool_end' && legacyRewrite.manuscriptView?.proposalId);
      assert.equal(legacyRewrite.manuscriptView.path, olderFile);
      assert.equal((await target('正文章节/第11章.md')).version, null);

      const phaseCard = await stage(4, '第四章前');
      const changeContent = '## 性格特点\n### 表征\n冷硬\n### 内在\n悲恸\n\n## 愿景\n### 明示\n复仇\n### 潜意识\n求得补偿\n\n## 社会背景\n\n## 外表特点\n\n## 特殊性\n### 心理特质\n警觉。';
      const runCharacterChange = async (chapter: number, answer: number, edit?: 'other' | 'evidence' | 'stop' | 'card') => {
        const chapterPath = `正文章节/第${chapter}章.md`;
        const received = [];
        const change = (quote: string, note: string) => ({ name: 'propose_character_change', args: {
          character: '林舟', chapter, note, content: changeContent + '\n' + note, evidence: { path: chapterPath, quote },
        } });
        for await (const event of events(await server.request(session + '/messages', 'POST', { text:
          `写第${chapter}章：林舟烧掉旧信。\n` + plan([
            part(1, `第${chapter}章\n\n他烧掉了旧信。`), review,
            { name: 'deliver_chapter', args: { partCount: 1, reason: '完成本章交稿。' } },
            change('他烧掉了旧信。', '黑化'),
            ...(edit === 'evidence' ? [change('原来那是一场梦。', '梦醒')] : []),
          ]) }))) {
          received.push(event);
          if (event.type !== 'tool_approval_required') continue;
          if (received.filter(item => item.type === 'tool_approval_required').length === 1) {
            await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
          } else {
            if (received.filter(item => item.type === 'tool_approval_required').length === 2) {
              if (edit === 'stop') { await json(session + '/stop', 'POST'); continue; }
              if (edit === 'other' || edit === 'evidence') {
                const doc = await json(base + '/document/read', 'POST', { path: chapterPath });
                await json(base + '/document', 'PUT', { path: chapterPath, baseVersion: doc.version,
                  content: doc.content + (edit === 'other' ? '\n\n他走进院中。' : '原来那是一场梦。') });
              }
              if (edit === 'card') await stage(chapter, '作者手改人物设定');
            } else {
              assert.match(event.approval.preview, /原来那是一场梦/);
              const stages = await json(base + '/character-cards?chapter=' + chapter);
              assert(!stages.cards.some((card: any) => card.chapter === chapter));
            }
            assert.match(event.approval.preview, /原阶段[\s\S]*对应情节[\s\S]*建议变化/);
            await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: answer === 1 ? 'approve' : 'deny' });
          }
        }
        assertFinal(received, edit === 'stop' ? 'aborted' : 'completed');
        assert.equal(received.filter(item => item.type === 'tool_approval_required').length, edit === 'evidence' ? 3 : 2);
        return { received, chapterPath };
      };
      await runCharacterChange(5, 2);
      const declined = await json(`${base}/character-cards?chapter=5&character=林舟`);
      assert.equal(declined.applicable[0].path, phaseCard.path);
      await runCharacterChange(6, 1, 'other');
      const accepted = await json(`${base}/character-cards?chapter=6&character=林舟`);
      assert.equal(accepted.applicable[0].chapter, 6);
      assert.deepEqual(accepted.applicable[0].evidence, { path: '正文章节/第6章.md', quote: '他烧掉了旧信。' });
      await runCharacterChange(7, 1, 'evidence');
      const reconsidered = await json(base + '/character-cards?chapter=7');
      assert.deepEqual(reconsidered.cards.filter((card: any) => card.chapter === 7).map((card: any) => card.note), ['梦醒']);
      await runCharacterChange(8, 1, 'stop');
      assert.equal((await json(base + '/character-cards?chapter=8')).applicable[0].chapter, 7);
      await runCharacterChange(9, 1, 'card');
      assert.deepEqual((await json(base + '/character-cards?chapter=9')).cards.filter((card: any) => card.chapter === 9)
        .map((card: any) => card.note), ['作者手改人物设定']);
      // 重写已采纳后，跨轮次从同一聊天的交稿记录核对第四章，保留同章旧阶段。
      await restart();
      const followup = [];
      for await (const event of events(await server.request(session + '/messages', 'POST', { text: plan([{
        name: 'propose_character_change', args: { character: '林舟', chapter: 4, note: '复核重写', content: changeContent,
          evidence: { path, quote: '交稿。' } },
      }]) }))) {
        followup.push(event);
        if (event.type === 'tool_approval_required') {
          assert.match(event.approval.preview, /第四章前/);
          await json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
        }
      }
      assertFinal(followup, 'completed');
      assert.equal((await json(base + '/character-cards?chapter=4')).applicable[0].note, '复核重写');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); await fixture.close();
    // 只清理由本测试 mkdtemp 创建的临时作品和应用数据。
    await rm(dir, { recursive: true, force: true });
  }
});
