import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { AgentQuestionAnswer, SessionDetail } from '../../packages/contracts/src/index.ts';
import { assertFinal, events, startServer } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 只替换模型响应。提问、状态、答复、停止与历史使用实际 HTTP/SSE 和 SDK。 */
test('Agent 等待选择、自填、跳过或停止，答复只消费一次', { timeout: 60_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-question-'));
  const fixture = await createModelFixture();
  const project = join(directory, 'project');
  const book = join(directory, 'book');
  await Promise.all([mkdir(project), mkdir(book)]);
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'question', name: 'question', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 2048,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const server = await startServer({ PLOTLOOM_DATA_DIR: join(directory, 'data'), PLOTLOOM_MODELS_PATH: modelsPath,
    PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'question', PLOTLOOM_API_KEY: TEST_KEY });
  try {
    const chat = await server.json('/api/sessions', 'POST', { projectPath: project }, 201);
    const workspace = await server.json('/api/workspaces', 'POST', { title: '选择题验收', root: book }, 201);
    const novel = await server.json(`/api/workspaces/${workspace.id}/sessions`, 'POST', {}, 201);
    const args = { question: '采用哪个视角？', options: ['第一人称', '第三人称'] };
    const text = 'WRITE:' + JSON.stringify({ steps: [{ name: 'ask_user', args }], finalText: '继续原轮次' });
    const cases: { name: string; session: string; answer?: AgentQuestionAnswer; result?: string }[] = [
      { name: '项目聊天单选', session: chat.id, answer: { kind: 'option', index: 2 }, result: '用户选择：第三人称' },
      { name: '小说聊天自填', session: novel.id, answer: { kind: 'custom', text: ' 书信体 ' }, result: '用户自填：书信体' },
      { name: '跳过继续', session: chat.id, answer: { kind: 'skip' }, result: '用户跳过了问题，未提供答案。' },
      { name: '停止取消待回答', session: chat.id },
    ];
    for (const item of cases) await t.test(item.name, async () => {
      const path = `/api/sessions/${item.session}`;
      const response = await server.request(path + '/messages', 'POST', { text });
      const received = [];
      let pendingPath = '';
      for await (const event of events(response)) {
        received.push(event);
        if (event.type !== 'user_answer_required') continue;
        const detail = await server.json<SessionDetail>(path);
        assert.equal(detail.status, 'running');
        assert.equal(detail.activity, 'awaiting_answer');
        assert.deepEqual(detail.pendingQuestion, event.question);
        assert.deepEqual(event.question.options, args.options);
        assert.equal((await server.json(path + '/context')).activity, 'awaiting_answer');
        pendingPath = path + '/questions/' + event.question.id + '/answer';
        if (item.answer?.kind === 'option') {
          assert.equal((await server.json(pendingPath, 'POST', { kind: 'option', index: 3 }, 422)).error.code, 'INVALID_QUESTION_OPTION');
          assert.equal((await server.json(pendingPath, 'POST', { kind: 'custom', text: ' ' }, 400)).error.code, 'INVALID_REQUEST');
          const wrongChat = `/api/sessions/${novel.id}/questions/${event.question.id}/answer`;
          assert.equal((await server.json(wrongChat, 'POST', { kind: 'skip' }, 409)).error.code, 'QUESTION_UNAVAILABLE');
          assert.equal((await server.json(path + '/messages', 'POST', { text: '另一轮' }, 409)).error.code, 'SESSION_BUSY');
        }
        if (item.answer) {
          assert.deepEqual(await server.json(pendingPath, 'POST', item.answer), { id: event.question.id, kind: item.answer.kind });
        } else {
          await server.json(path + '/stop', 'POST');
        }
      }
      assert(pendingPath, '必须收到等待事件');
      assertFinal(received, item.answer ? 'completed' : 'aborted');
      assert.equal((await server.json(pendingPath, 'POST', { kind: 'skip' }, 409)).error.code, 'QUESTION_UNAVAILABLE');
      const detail = await server.json<SessionDetail>(path);
      assert.equal(detail.activity, 'idle');
      assert.equal(detail.pendingQuestion, undefined);
      if (item.result) {
        assert(received.some(event => event.type === 'text_delta' && event.delta.includes('继续原轮次')));
        const latestTurn = detail.messages.findLast(message => message.role === 'user')?.turnId;
        const blocks = detail.messages.filter(message => message.turnId === latestTurn).flatMap(message => message.content);
        assert(blocks.some(block => block.type === 'tool' && block.name === 'ask_user' && block.text === item.result));
        assert(fixture.requests.some(request => request.messages.some((message: { role: string; content: unknown }) =>
          message.role === 'tool' && JSON.stringify(message.content).includes(item.result!))));
      }
    });
  } finally {
    await server.close();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
