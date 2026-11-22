import assert from 'node:assert/strict';
import test from 'node:test';
import type { ToolInfo } from '../../packages/contracts/src/skills.ts';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { startServer, collect, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 只替换模型决策；独立服务进程、技能快照、网络抓取和持久化均使用生产链路。 */
test('核心工具目录、全局技能准入与网页抓取', { timeout: 90000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'plotloom-skill-tools-'));
  const fixture = await createModelFixture();
  const models = join(dir, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 2048, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const project = join(dir, 'project'); await mkdir(project);
  const env = { PLOTLOOM_DATA_DIR: join(dir, 'data'), PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const json = (...args: Parameters<typeof server.json>) => server.json(...args);
  const send = async (id: string, text: string) => collect(await server.request(`/api/sessions/${id}/messages`, 'POST', { text }));
  const skill = await json('/api/skills', 'POST', { content: '---\nname: fetch-research\ndescription: 网页研究\nallowed-tools: web_fetch\n---\n快照正文唯一标记。' }, 201);
  const book = join(dir, 'book'); await mkdir(book);
  const workspace = await json('/api/workspaces', 'POST', { title: '技能验收小说', root: book }, 201);
  const chat = await json(`/api/workspaces/${workspace.id}/sessions`, 'POST', {}, 201);
  // 此处只测试网页技能开关，关闭小说自带技能以单独观察 read_skill 的注册。
  await json('/api/skills/builtin-novel-writing/enabled', 'PUT', { enabled: false });
  const enabledPath = `/api/skills/${skill.id}/enabled`;
  const settings = `/api/sessions/${chat.id}/skills`;
  const site = createServer((req, res) => {
    if (req.url === '/slow') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.write('waiting'); return; }
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/article' }); res.end(); return; }
    if (req.url === '/error') { res.writeHead(403); res.end(); return; }
    if (req.url === '/binary') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end('PDF'); return; }
    if (req.url === '/large') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('x'.repeat(2 * 1024 * 1024 + 1)); return; }
    if (req.url === '/long') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('文'.repeat(31000)); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><head><title>网页验收</title></head><body><nav>导航噪声</nav><main><h1>正文标题</h1><p>中文 &amp; 资料。</p><script>隐藏脚本</script></main></body></html>');
  });
  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
  const fetchCommand = (target: string) => 'WRITE:' + JSON.stringify({ steps: [{ name: 'web_fetch', args: { url: target } }], finalText: '抓取结束' });
  try {
    await t.test('目录提供方、用途和条件完整，声明按实际聊天工具诊断', async () => {
      const directory: ToolInfo[] = (await json('/api/tools')).tools;
      assert.equal(new Set(directory.map(tool => tool.name)).size, directory.length);
      for (const tool of directory) assert(tool.provider && tool.description && tool.parameters && tool.condition && tool.availableIn.length);
      const byName = new Map(directory.map(tool => [tool.name, tool]));
      assert.equal(byName.get('browser')?.provider, 'Plotloom 浏览器（Playwright）');
      assert.equal(byName.get('web_fetch')?.provider, 'Plotloom 网页抓取');
      assert.equal(byName.get('write')?.provider, 'Plotloom 项目文件工具');
      assert.equal(byName.get('read_skill')?.provider, 'Plotloom 技能系统');
      assert.equal(byName.get('propose_change')?.provider, 'Plotloom 小说工作区');
      assert(!byName.has('read_fixture'));
      assert.deepEqual(byName.get('write')?.availableIn, ['project', 'novel']);
      for (const name of ['browser', 'web_fetch']) assert.deepEqual(byName.get(name)?.availableIn, ['project', 'novel']);
      assert(!byName.has('web_search'));
      assert((await json(settings)).effectiveSkillIds.includes(skill.id));
      const projectSkill = await json('/api/skills', 'POST', { content: '---\nname: project-reader\ndescription: 读取项目\nallowed-tools: read\n---\n按需读取项目文件。' }, 201);
      assert.deepEqual(projectSkill.availableIn, ['project', 'novel']);
      assert((await json(settings)).effectiveSkillIds.includes(projectSkill.id));
      const projectChat = await json('/api/sessions', 'POST', { projectPath: project }, 201);
      assert((await json(`/api/sessions/${projectChat.id}/skills`)).effectiveSkillIds.includes(projectSkill.id));
      assert((await json(`/api/sessions/${projectChat.id}/skills`)).effectiveSkillIds.includes(skill.id));
      const active = (await json(`/api/sessions/${projectChat.id}/tools`)).tools.filter((tool: any) => tool.active);
      assert(active.every((tool: any) => byName.has(tool.name)));
    });
    await t.test('全局关闭保留当前快照，下一轮和显式覆盖不能绕过；重启持久化', async () => {
      await json(settings, 'PUT', { skillIds: [skill.id] });
      const prompt = 'WAIT_SKILL:' + JSON.stringify({ skillId: skill.id, path: 'SKILL.md' });
      const result = [];
      for await (const event of events(await server.request(`/api/sessions/${chat.id}/messages`, 'POST', { text: prompt }))) {
        result.push(event);
        if (event.type === 'text_delta' && event.delta === '准备读取技能。') {
          const saved = await json(enabledPath, 'PUT', { enabled: false });
          assert.equal(saved.enabled, false); assert.equal(saved.version, skill.version); fixture.release(prompt);
        }
      }
      assertFinal(result, 'completed');
      assert.match(result.filter(e => e.type === 'text_delta').map(e => e.delta).join(''), /快照正文唯一标记/);
      await send(chat.id, '关闭后的下一轮');
      assert(!fixture.requests.at(-1).tools.some((tool: any) => tool.function.name === 'read_skill'));
      await json(settings, 'PUT', { skillIds: [skill.id] });
      assert.match((await json(settings)).unavailable[0].reason, /全局停用/);
      await json(`/api/sessions/${chat.id}/messages`, 'POST', { text: '显式选择', skillIds: [skill.id] }, 422);
      await server.close(); server = await startServer(env);
      assert.equal((await json(`/api/skills/${skill.id}`)).enabled, false);
      await json(enabledPath, 'PUT', { enabled: 'true' }, 400);
      await json('/api/skills/missing/enabled', 'PUT', { enabled: true }, 404);
      await json(enabledPath, 'PUT', { enabled: true });
      await json(settings, 'PUT', { skillIds: null });
      assert((await json(settings)).skills.some((item: any) => item.id === skill.id && item.runnable));
    });
    await t.test('真实正文、重定向、截断和错误均通过工具事件返回', async () => {
      const read = await send(chat.id, fetchCommand(url + '/redirect')); assertFinal(read, 'completed');
      const end = read.find(event => event.type === 'tool_end' && event.name === 'web_fetch');
      assert(end?.type === 'tool_end'); assert.equal(end.outcome, 'completed');
      const output = fixture.requests.at(-1).messages.findLast((message: any) => message.role === 'tool').content;
      assert.match(output, /网页验收/); assert.match(output, /中文 & 资料/);
      assert.match(output, /article/); assert.doesNotMatch(output, /隐藏脚本|导航噪声/);
      const long = await send(chat.id, fetchCommand(url + '/long'));
      assert(long.some(event => event.type === 'tool_end' && event.outcome === 'completed'));
      const toolMessage = fixture.requests.at(-1).messages.findLast((message: any) => message.role === 'tool');
      const payload = JSON.parse(toolMessage.content); assert.equal(payload.text.length, 30000, JSON.stringify({ length: payload.text.length, start: payload.text.slice(0, 40), end: payload.text.slice(-40), truncated: payload.truncated })); assert.equal(payload.truncated, true);
      for (const target of [url + '/error', url + '/binary', url + '/large', 'file:///private.txt']) {
        const failed = await send(chat.id, fetchCommand(target));
        assert(failed.some(event => event.type === 'tool_end' && event.name === 'web_fetch' && event.outcome === 'failed'), target);
      }
    });
    await t.test('抓取中停止，后续仍可正常抓取', async () => {
      const result = [];
      for await (const event of events(await server.request(`/api/sessions/${chat.id}/messages`, 'POST', { text: fetchCommand(url + '/slow') }))) {
        result.push(event);
        if (event.type === 'tool_start' && event.name === 'web_fetch') await json(`/api/sessions/${chat.id}/stop`, 'POST');
      }
      assertFinal(result, 'aborted');
      assertFinal(await send(chat.id, fetchCommand(url + '/article')), 'completed');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); await fixture.close(); site.closeAllConnections(); await new Promise<void>(resolve => site.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
