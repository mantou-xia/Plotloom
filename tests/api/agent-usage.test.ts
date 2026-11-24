import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { assertFinal, events, startServer } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

test('回答评价跨重启，使用记录压缩包关联原文、文件改动和反馈', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-usage-'));
  const model = await createModelFixture();
  const models = join(root, 'models.json');
  const book = join(root, 'book');
  await mkdir(book);
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: model.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096 }] } } }));
  const env = { PLOTLOOM_DATA_DIR: join(root, 'data'), PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'test',
    PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  try {
    const workspace = await server.json('/api/workspaces', 'POST', { title: '灯塔', root: book }, 201);
    const base = '/api/workspaces/' + workspace.id;
    const chat = await server.json(base + '/sessions', 'POST', {}, 201);
    const session = '/api/sessions/' + chat.id;
    const text = '请写一份灯塔说明。\nWRITE:' + JSON.stringify({
      steps: [{ name: 'write', args: { path: '灯塔笔记.md', content: 'Agent 写入的文字。' } }],
      finalText: '这是灯塔说明。',
    });
    const seen = [];
    for await (const event of events(await server.request(session + '/messages', 'POST', { text }))) {
      seen.push(event);
      if (event.type === 'tool_approval_required')
        await server.json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
    }
    assertFinal(seen, 'completed');
    const detail = await server.json(session);
    const turnId = detail.messages.find((message: any) => message.role === 'user').turnId;
    const feedback = session + '/feedback/' + turnId;
    const note = { rating: 'dislike', comment: '希望先列出修改范围。' };
    await server.json(session + '/feedback/missing', 'PUT', note, 404);
    await server.json(feedback, 'PUT', { ...note, rating: 'other' }, 400);
    const saved = await server.json(feedback, 'PUT', note);
    assert.deepEqual(await server.json(feedback, 'PUT', note), saved);

    const path = '正文章节/第1章.md';
    const first = await server.json(base + '/document', 'PUT', { path, baseVersion: null, content: '初稿。' });
    await server.json(base + '/document', 'PUT', { path, baseVersion: first.version, content: '作者改稿。' });
    await server.json(session + '/organization', 'PUT', { archived: true });
    await server.close();
    server = await startServer(env);
    assert.deepEqual((await server.json(session)).feedback, [saved]);

    const response = await server.request('/api/agent-usage/export', 'POST', {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/gzip/);
    assert.match(response.headers.get('content-disposition') ?? '', /Plotloom-agent-usage\.jsonl\.gz/);
    const raw = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');
    assert(!raw.includes(TEST_KEY), '模型密钥文件不进入导出');
    const records = raw.trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(records[0].version, 1);
    const exported = records.find(item => item.type === 'session' && item.id === chat.id);
    assert.equal(exported.archived, true);
    assert.deepEqual(exported.feedback, [saved]);
    assert(exported.messages.some((message: any) => message.turnId === turnId && JSON.stringify(message.content).includes('这是灯塔说明')));
    assert(exported.messages.some((message: any) => message.turnId === turnId && JSON.stringify(message.content).includes('请写一份灯塔说明')));
    assert(records.some(item => item.type === 'agent-write' && item.sessionId === chat.id && item.change.path === '灯塔笔记.md' && item.after === 'Agent 写入的文字。'));
    assert.deepEqual(records.filter(item => item.type === 'document-revision' && item.path === path).map(item => item.content), ['初稿。', '作者改稿。']);
    await server.json('/api/agent-usage/export', 'POST', { path: '.' }, 400);
    await server.json(feedback, 'PUT', { rating: 'like', comment: '' });
    assert.equal((await server.json(session)).feedback[0].rating, 'like');
    await server.json(feedback, 'PUT', { rating: null, comment: '' });
    assert.equal((await server.json(session)).feedback, undefined);
  } finally {
    await server.close();
    await model.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
