import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startServer, collect, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

const source = (name: string, text = '技能正文唯一标记甲', extra = '') => `---\nname: ${name}\ndescription: 测试对白技能\n${extra}---\n${text}\n`;
/** 独立 HTTP 服务 + 模型协议替身：只替换模型，资源管理、SDK 工具与持久化都走生产路径。 */
test('P2.1 技能管理、受控加载和小说聊天', { timeout: 120000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'plotloom-skills-')); const fixture = await createModelFixture();
  const data = join(dir, 'data'); const book = join(dir, 'book'); const other = join(dir, 'other');
  await mkdir(book); await mkdir(other);
  const models = join(dir, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 2048, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const env = { PLOTLOOM_DATA_DIR: data, PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const json = (...args: Parameters<typeof server.json>) => server.json(...args);
  const msg = (id: string) => `/api/sessions/${id}/messages`;
  const setting = (id: string) => `/api/sessions/${id}/skills`;
  const send = async (id: string, text: string, skillIds?: string[]) => collect(await server.request(msg(id), 'POST', { text, ...(skillIds ? { skillIds } : {}) }));
  const text = (result: Awaited<ReturnType<typeof send>>) => result.filter(e => e.type === 'text_delta').map(e => e.delta).join('');
  const command = (skillId: string, path = 'SKILL.md', wait = false) => `${wait ? 'WAIT_SKILL' : 'SKILL'}:${JSON.stringify({ skillId, path })}`;
  const restart = async () => { await server.close(); server = await startServer(env); };
  let skill: any; let imported: any; let workspace: any; let workspace2: any; let chat: any; let chat2: any; let normal: any;
  try {
    await t.test('内置诊断、自定义创建、复制、编辑与过期保护', async () => {
      const builtin = (await json('/api/skills')).skills[0];
      assert.equal(builtin.id, 'builtin-novel-writing'); assert.equal(builtin.runnable, false); assert(builtin.missingTools.includes('propose_change'));
      await json(`/api/skills/${builtin.id}`, 'DELETE', undefined, 409);
      await json(`/api/skills/${builtin.id}/file`, 'PUT', { path: 'SKILL.md', content: source('novel-writing'), baseVersion: builtin.version }, 409);
      const copy = await json(`/api/skills/${builtin.id}/copy`, 'POST', { name: 'my-writing' }, 201);
      assert.equal(copy.source, 'custom'); assert(copy.files.includes('references/character-card.md'));
      assert.match((await json(`/api/skills/${copy.id}/file`, 'POST', { path: 'SKILL.md' })).content, /name: my-writing/);
      await json(`/api/skills/${copy.id}`, 'DELETE'); await json(`/api/skills/${copy.id}`, 'GET', undefined, 404);
      skill = await json('/api/skills', 'POST', { content: source('dialogue') }, 201);
      await json('/api/skills', 'POST', { content: source('dialogue') }, 409);
      await json('/api/skills', 'POST', { content: '# 无元信息' }, 400);
      await json('/api/skills', 'POST', { content: source('Bad-Name') }, 400);
      const old = skill.version;
      skill = await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'references/tone.md', content: '参考标记：旧版本😀', baseVersion: old });
      await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'SKILL.md', content: source('dialogue'), baseVersion: old }, 409);
      await json(`/api/skills/${skill.id}/file`, 'POST', { path: '../secret' }, 400);
      await json(`/api/skills/${skill.id}/file`, 'POST', { path: 'unknown.md' }, 404);
      const saved = skill.version;
      skill = await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'references/tone.md', content: '临时改写', baseVersion: saved });
      skill = await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'references/tone.md', content: '参考标记：旧版本😀', baseVersion: skill.version });
      assert.equal(skill.version, saved); // 重新使用已发布版本不能截断或破坏旧文件。
      await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'References/other.md', content: '大小写别名', baseVersion: saved }, 400);
      await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'references', content: '文件与目录冲突', baseVersion: saved }, 400);
    });
    await t.test('完整目录导入、二进制保留、脚本不执行及源目录隔离', async () => {
      const root = join(dir, 'imported-skill'); await mkdir(join(root, 'references'), { recursive: true }); await mkdir(join(root, 'assets')); await mkdir(join(root, 'scripts'));
      await writeFile(join(root, 'SKILL.md'), source('imported-skill', '引用 references/readme.md', 'compatibility: 需要用户确认本地环境\nallowed-tools: read_skill\n'));
      await writeFile(join(root, 'references/readme.md'), '导入原始参考'); const bytes = Buffer.from([0, 255, 128, 1]); await writeFile(join(root, 'assets/icon.bin'), bytes);
      await writeFile(join(root, 'scripts/run.js'), 'throw new Error("不得执行")');
      imported = await json('/api/skills/import', 'POST', { root }, 201);
      assert(imported.warnings.some((s: string) => s.includes('不执行')) || imported.warnings.some((s: string) => s.includes('不会执行')));
      const binary = await json(`/api/skills/${imported.id}/file`, 'POST', { path: 'assets/icon.bin' }); assert.equal(binary.encoding, 'base64'); assert.deepEqual(Buffer.from(binary.content, 'base64'), bytes);
      await writeFile(join(root, 'references/readme.md'), '源目录更新');
      assert.equal((await json(`/api/skills/${imported.id}/file`, 'POST', { path: 'references/readme.md' })).content, '导入原始参考');
      await json('/api/skills/import', 'POST', { root }, 409);
      await json('/api/skills/import', 'POST', { root: join(dir, 'missing') }, 422);
      const linked = join(dir, 'linked-skill'); await mkdir(linked); await writeFile(join(linked, 'SKILL.md'), source('linked-skill'));
      await symlink(root, join(linked, 'outside'), 'junction'); await json('/api/skills/import', 'POST', { root: linked }, 400);
    });
    await t.test('小说聊天固定归属、普通聊天与最近列表、空会话跨重启', async () => {
      workspace = await json('/api/workspaces', 'POST', { title: '甲', root: book }, 201);
      workspace2 = await json('/api/workspaces', 'POST', { title: '乙', root: other }, 201);
      chat = await json(`/api/workspaces/${workspace.id}/sessions`, 'POST', { name: '甲聊天' }, 201);
      chat2 = await json(`/api/workspaces/${workspace2.id}/sessions`, 'POST', {}, 201);
      normal = await json('/api/sessions', 'POST', {}, 201);
      assert.deepEqual((await json(`/api/workspaces/${workspace.id}/skills`)).skillIds, ['builtin-novel-writing']);
      const initial = await json(setting(chat.id)); assert.equal(initial.mode, 'inherit'); assert.equal(initial.unavailable.length, 1);
      await json(setting(chat.id), 'PUT', { skillIds: [skill.id] }); await restart();
      assert.equal((await json(setting(chat.id))).workspaceId, workspace.id); assert.deepEqual((await json(setting(chat.id))).skillIds, [skill.id]);
      assert.equal((await json(`/api/sessions/${chat.id}`)).messages.length, 0);
      assert.deepEqual((await json(`/api/workspaces/${workspace.id}/sessions`)).sessions.map((s: any) => s.id), [chat.id]);
      const recent = (await json('/api/chats')).sessions; assert.equal(recent.length, 3); assert.equal(recent.find((s: any) => s.id === normal.id).workspaceId, null);
      await json('/api/workspaces/unknown/sessions', 'POST', {}, 404);
    });
    await t.test('工作区默认、聊天覆盖、恢复跟随与显式空列表', async () => {
      await json(`/api/workspaces/${workspace.id}/skills`, 'PUT', { skillIds: [imported.id] });
      assert.deepEqual((await json(setting(chat.id))).effectiveSkillIds, [skill.id]);
      await json(setting(chat.id), 'PUT', { skillIds: null }); assert.deepEqual((await json(setting(chat.id))).effectiveSkillIds, [imported.id]);
      await json(`/api/workspaces/${workspace.id}/skills`, 'PUT', { skillIds: [skill.id, imported.id] });
      assert.deepEqual((await json(setting(chat.id))).effectiveSkillIds, [skill.id, imported.id]);
      await json(setting(chat.id), 'PUT', { skillIds: [] }); assert.deepEqual((await json(setting(chat.id))).effectiveSkillIds, []);
      await json(setting(chat.id), 'PUT', { skillIds: null });
      assert.deepEqual((await json(setting(normal.id))).effectiveSkillIds, []);
      await json(setting(chat.id), 'PUT', { skillIds: ['unknown'] }, 404);
      await json(`/api/workspaces/${workspace.id}/skills`, 'PUT', { skillIds: [skill.id, skill.id] }, 400);
    });
    await t.test('摘要按需读取真实工具、显式加载与跨聊天隔离', async () => {
      const result = await send(chat.id, command(skill.id)); assertFinal(result, 'completed'); assert.match(text(result), /技能正文唯一标记甲/);
      assert(result.some(e => e.type === 'tool_end' && e.name === 'read_skill' && e.outcome === 'completed'));
      const system = JSON.stringify(fixture.requests.at(-1).messages.filter((m: any) => m.role === 'system'));
      assert.match(system, /dialogue/); assert.doesNotMatch(system, /技能正文唯一标记甲/);
      const explicit = await send(chat.id, '显式技能', [skill.id]); assertFinal(explicit, 'completed');
      assert.match(JSON.stringify(fixture.requests.at(-1).messages.filter((m: any) => m.role === 'system')), /技能正文唯一标记甲/);
      await json(msg(normal.id), 'POST', { text: '显式越权', skillIds: [skill.id] }, 422);
      await json(msg(chat2.id), 'POST', { text: '缺失工具', skillIds: ['builtin-novel-writing'] }, 422);
      const bad = await send(chat.id, command(skill.id, '../secret')); assert(bad.some(e => e.type === 'tool_end' && e.outcome === 'failed'));
      const disabled = await json('/api/skills', 'POST', { content: source('not-enabled') }, 201);
      const cross = await send(chat.id, command(disabled.id)); assert(cross.some(e => e.type === 'tool_end' && e.outcome === 'failed'));
      await send(normal.id, '普通聊天'); assert.doesNotMatch(JSON.stringify(fixture.requests.at(-1).tools), /read_skill/);
    });
    await t.test('生成中编辑与停用只影响下一轮，旧快照仍能读取', async () => {
      const prompt = command(skill.id, 'references/tone.md', true);
      const response = await server.request(msg(chat.id), 'POST', { text: prompt });
      const result = [];
      for await (const event of events(response)) {
        result.push(event);
        if (event.type === 'text_delta' && event.delta === '准备读取技能。') {
          skill = await json(`/api/skills/${skill.id}/file`, 'PUT', { path: 'references/tone.md', content: '参考标记：新版本😀', baseVersion: skill.version });
          await json(setting(chat.id), 'PUT', { skillIds: [] }); fixture.release(prompt);
        }
      }
      assertFinal(result, 'completed'); assert.match(text(result), /旧版本/); assert.doesNotMatch(text(result), /新版本/);
      await send(chat.id, '停用后下一轮'); assert.doesNotMatch(JSON.stringify(fixture.requests.at(-1).tools), /read_skill/);
      await json(setting(chat.id), 'PUT', { skillIds: null }); const next = await send(chat.id, command(skill.id, 'references/tone.md')); assert.match(text(next), /新版本/);
      const before = (await json(`/api/sessions/${chat.id}`)).messages; await restart(); assert.deepEqual((await json(`/api/sessions/${chat.id}`)).messages, before);
      assert.match(text(await send(chat.id, command(skill.id, 'references/tone.md'))), /新版本/);
    });
    await t.test('删除不破坏正在运行的快照，配置诊断与停止仍有效', async () => {
      await json(setting(chat.id), 'PUT', { skillIds: [imported.id] });
      const prompt = command(imported.id, 'references/readme.md', true);
      const result = [];
      for await (const event of events(await server.request(msg(chat.id), 'POST', { text: prompt }))) {
        result.push(event);
        if (event.type === 'text_delta' && event.delta === '准备读取技能。') { await json(`/api/skills/${imported.id}`, 'DELETE'); fixture.release(prompt); }
      }
      assert.match(text(result), /导入原始参考/); assert.equal((await json(setting(chat.id))).unavailable.length, 1);
      assert.equal(await readFile(join(dir, 'imported-skill/references/readme.md'), 'utf8'), '源目录更新');
      await json(setting(chat.id), 'PUT', { skillIds: [skill.id] });
      const stopped = [];
      for await (const event of events(await server.request(msg(chat.id), 'POST', { text: 'WAIT:skill-stop' }))) {
        stopped.push(event); if (event.type === 'text_delta') await json(`/api/sessions/${chat.id}/stop`, 'POST');
      }
      assertFinal(stopped, 'aborted');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); await fixture.close();
    // 目录由本测试 mkdtemp 创建，只清理已知临时夹具。
    await rm(dir, { recursive: true, force: true });
  }
});
