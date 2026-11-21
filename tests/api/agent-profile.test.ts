import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertFinal, collect, events, startServer } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 用实际 HTTP、SSE 与 Pi 请求检验持久化、跨会话注入和重试语义。 */
test('全局 Agent 人设跨重启并应用于项目和小说', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-agent-profile-'));
  const fixture = await createModelFixture();
  const project = join(directory, 'project');
  const book = join(directory, 'book');
  await Promise.all([mkdir(project), mkdir(book)]);
  const models = join(directory, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'fixture', name: 'Fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const env = { PLOTLOOM_DATA_DIR: join(directory, 'data'), PLOTLOOM_MODELS_PATH: models,
    PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const profilePath = '/api/agent-profile';
  const save = { action: 'save', name: ' 小舟 ', style: ' 简洁直率 ', preferences: ' 先给结论，再解释风险。 ' };
  const configured = { setup: 'configured', name: '小舟', style: '简洁直率', preferences: '先给结论，再解释风险。' };
  const systemPrompt = () => JSON.stringify(fixture.requests.at(-1).messages.find((message: { role: string }) => message.role === 'system'));
  const send = async (session: string, text: string) =>
    assertFinal(await collect(await server.request('/api/sessions/' + session + '/messages', 'POST', { text })), 'completed');
  try {
    assert.deepEqual(await server.json(profilePath), { setup: 'pending', name: '', style: '', preferences: '' });
    assert.equal((await server.json(profilePath, 'PUT', { action: 'save', name: '未填写完整' }, 400)).error.code, 'INVALID_REQUEST');
    await server.json(profilePath, 'PUT', { ...save, name: '字'.repeat(41) }, 400);
    await server.json(profilePath, 'PUT', { action: 'skip', name: '多余字段' }, 400);
    const forbidden = await fetch(server.address + profilePath, { headers: { Origin: 'https://example.test' } });
    assert.equal(forbidden.status, 403);
    const projectSession = await server.json('/api/sessions', 'POST', { projectPath: project }, 201);
    const projectPath = '/api/sessions/' + projectSession.id;
    await send(projectSession.id, '使用默认助手');
    assert.doesNotMatch(systemPrompt(), /用户确认的全局 Agent 人设/);
    assert.match(systemPrompt(), /用户开场给了具体任务时，先处理任务/);
    assert.equal((await server.json(profilePath)).setup, 'pending', '使用聊天不必完成首用引导');
    const prompt = 'WRITE:' + JSON.stringify({ steps: [{ name: 'setup_agent_profile', args: save }] });
    for (const decision of ['defer', 'stop', 'save']) {
      const response = await server.request(projectPath + '/messages', 'POST', { text: prompt });
      const received = [];
      for await (const event of events(response)) {
        received.push(event);
        if (event.type !== 'user_answer_required') continue;
        assert.match(event.question.question, /小舟[\s\S]*简洁直率[\s\S]*先给结论/);
        assert.equal((await server.json(profilePath)).setup, 'pending', '等待确认时未写盘');
        if (decision === 'stop') await server.json(projectPath + '/stop', 'POST');
        else await server.json(projectPath + '/questions/' + event.question.id + '/answer', 'POST',
          { kind: 'option', index: decision === 'save' ? 1 : 2 });
      }
      assert(received.some(event => event.type === 'user_answer_required'));
      assertFinal(received, decision === 'stop' ? 'aborted' : 'completed');
      assert.equal((await server.json(profilePath)).setup, decision === 'save' ? 'configured' : 'pending');
    }
    assert.deepEqual(JSON.parse(await readFile(join(env.PLOTLOOM_DATA_DIR, 'agent-profile.json'), 'utf8')), configured);
    assert.deepEqual(await server.json(profilePath, 'PUT', save), configured);
    assert.deepEqual(await server.json(profilePath, 'PUT', { action: 'skip' }), configured, '过时的跳过不覆盖已存配置');
    await server.close();
    server = await startServer(env);
    assert.deepEqual(await server.json(profilePath), configured);

    const workspace = await server.json('/api/workspaces', 'POST', { title: '人设验收', root: book }, 201);
    const novel = await server.json('/api/workspaces/' + workspace.id + '/sessions', 'POST', {}, 201);
    const writing = '/api/sessions/' + novel.id + '/writing/messages';
    assertFinal(await collect(await server.request(writing, 'POST', { task: 'discuss', instructions: '讨论章节' })), 'completed');
    assert.match(systemPrompt(), /本轮小说任务：discuss/);
    assert.match(systemPrompt(), /小舟.*简洁直率.*先给结论/);
    await send(projectSession.id, '继续原项目');
    assert.match(systemPrompt(), /项目助手.*小舟.*简洁直率.*先给结论/);
    assert.doesNotMatch(systemPrompt(), /本机 Agent 人设尚未设置/);
    assert(!fixture.requests.at(-1).tools.some((tool: any) => tool.function.name === 'setup_agent_profile'));

    const stream = await server.request(projectPath + '/messages', 'POST', { text: 'WAIT:persona' });
    const received = [];
    for await (const event of events(stream)) {
      received.push(event);
      if (event.type === 'text_delta') {
        assert.match(systemPrompt(), /小舟/);
        await server.json(profilePath, 'PUT', { ...save, name: '新称呼' });
        await server.json(projectPath + '/stop', 'POST');
      }
    }
    assertFinal(received, 'aborted');
    const { retryMessageId } = await server.json(projectPath);
    const retry = await server.request(projectPath + '/retry', 'POST', { messageId: retryMessageId });
    const replayed = [];
    for await (const event of events(retry)) {
      replayed.push(event);
      if (event.type === 'text_delta') {
        assert.match(systemPrompt(), /小舟/);
        assert.doesNotMatch(systemPrompt(), /新称呼/);
        await server.json(projectPath + '/stop', 'POST');
      }
    }
    assertFinal(replayed, 'aborted');
    await send(projectSession.id, '使用当前设置');
    assert.match(systemPrompt(), /新称呼/);
    assert.doesNotMatch(systemPrompt(), /小舟/);
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
