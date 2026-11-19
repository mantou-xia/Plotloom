import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { startServer, collect, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 模型仅决定工具参数；项目目录、SDK 工具、终端进程和持久化均走真实实现。 */
test('项目 Agent 文件、终端、历史与停止闭环', { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-project-'));
  const project = join(directory, 'project');
  const other = join(directory, 'other');
  await mkdir(project); await mkdir(other);
  await writeFile(join(project, 'README.md'), '项目原文-731', 'utf8');
  await mkdir(join(project, 'node_modules'));
  await writeFile(join(project, 'node_modules', 'ignored.txt'), '不可作为候选');
  const fixture = await createModelFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'project', name: 'project', reasoning: true, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 2048 }] } } }));
  const env = { PLOTLOOM_DATA_DIR: directory, PLOTLOOM_MODELS_PATH: modelsPath, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'project', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env, 40000);
  const path = (suffix = '') => `/api/sessions/${id}${suffix}`;
  const sendPlan = async (steps: unknown[]) => collect(await server.request(path('/messages'), 'POST', { text: `WRITE:${JSON.stringify({ steps, finalText: '项目任务完成' })}` }));
  let id = '';
  try {
    await t.test('目录校验、固定归属、跨项目列表和工具隔离', async () => {
      for (const projectPath of ['relative', join(directory, 'missing'), join(project, 'README.md')]) {
        assert.equal((await server.json('/api/sessions', 'POST', { projectPath }, 422)).error.code, 'PROJECT_PATH_INVALID');
      }
      await server.json('/api/sessions', 'POST', { projectPath: '' }, 400);
      const session = await server.json('/api/sessions', 'POST', { projectPath: project, name: '工程任务' }, 201);
      id = session.id;
      assert.equal(session.projectPath.toLowerCase(), project.toLowerCase());
      const second = await server.json('/api/sessions', 'POST', { projectPath: other }, 201);
      const ordinary = await server.json('/api/sessions', 'POST', {}, 201);
      const toolNames = (await server.json(path('/tools'))).tools.filter((v: any) => v.active).map((v: any) => v.name);
      for (const name of ['read', 'write', 'edit', 'grep', 'find', 'ls', process.platform === 'win32' ? 'powershell' : 'bash']) assert(toolNames.includes(name), name);
      assert(!(await server.json(`/api/sessions/${ordinary.id}/tools`)).tools.some((v: any) => v.name === 'write' && v.active));
      assert.equal((await server.json(`/api/sessions/${ordinary.id}/project-files`, 'POST', { query: '' }, 409)).error.code, 'PROJECT_NOT_SELECTED');
      await server.json(path('/config'), 'PUT', { projectPath: other }, 400);
      await server.close(); server = await startServer(env, 40000);
      const sessions = (await server.json('/api/sessions')).sessions;
      for (const expected of [id, second.id, ordinary.id]) assert(sessions.some((v: any) => v.id === expected));
      assert.equal((await server.json(path())).projectPath.toLowerCase(), project.toLowerCase());
      assert((await server.json('/api/chats')).sessions.some((v: any) => v.id === id && v.projectPath));
    });
    await t.test('项目文件候选仅返回当前项目相对路径与截断状态', async () => {
      const found = await server.json(path('/project-files'), 'POST', { query: 'readme' });
      assert.deepEqual(found, { entries: [{ path: 'README.md', name: 'README.md', isDirectory: false }], truncated: false });
      assert.deepEqual((await server.json(path('/project-files'), 'POST', { query: 'ignored' })).entries, []);
      await server.json(path('/project-files'), 'POST', { query: 1 }, 400);
      await server.json('/api/sessions/unknown/project-files', 'POST', { query: '' }, 404);
    });
    await t.test('原生读取、搜索、写入、编辑及终端命令真正作用于项目', async () => {
      const steps = [
        { name: 'ls', args: { path: '.' } },
        { name: 'find', args: { pattern: '*.md', path: '.' } },
        { name: 'grep', args: { pattern: '731', path: '.' } },
        { name: 'read', args: { path: 'README.md' } },
        { name: 'write', args: { path: 'result.txt', content: 'before' } },
        { name: 'edit', args: { path: 'result.txt', oldText: 'before', newText: 'after-731' } },
        { name: process.platform === 'win32' ? 'powershell' : 'bash', args: { command: process.platform === 'win32'
          ? '[System.IO.File]::WriteAllText((Join-Path (Get-Location) "command.txt"), "terminal-731")' : 'printf terminal-731 > command.txt' } },
      ];
      const result = await sendPlan(steps);
      assertFinal(result, 'completed');
      const ends = result.filter(v => v.type === 'tool_end');
      assert.equal(ends.length, steps.length);
      assert(ends.every(v => v.type === 'tool_end' && v.outcome === 'completed'), JSON.stringify(await server.json(path())));
      assert.equal(await readFile(join(project, 'result.txt'), 'utf8'), 'after-731');
      assert.equal(await readFile(join(project, 'command.txt'), 'utf8'), 'terminal-731');
      await assert.rejects(readFile(join(other, 'result.txt')));
      await server.close(); server = await startServer(env, 40000);
      const restored = await server.json(path());
      assert(restored.messages.some((v: any) => v.role === 'tool' && JSON.stringify(v).includes('731')));
      assert(restored.messages.some((v: any) => v.role === 'assistant' && JSON.stringify(v).includes('项目任务完成')));
    });
    await t.test('项目技能按实际工具诊断并可发送', async () => {
      const skill = await server.json('/api/skills', 'POST', { content: '---\nname: project-read\ndescription: 检查工程\nallowed-tools: read write\n---\n读取项目内容后再处理。' }, 201);
      const active = await server.json(path('/skills'), 'PUT', { skillIds: [skill.id] });
      assert.equal(active.skills[0].runnable, true);
      const response = await collect(await server.request(path('/messages'), 'POST', { text: 'HELLO', skillIds: [skill.id] }));
      assertFinal(response, 'completed');
      assert(fixture.requests.some(v => JSON.stringify(v.messages).includes('读取项目内容后再处理')));
    });
    await t.test('工具失败可见，停止终端结束当前请求且不会执行后续命令', async () => {
      const failed = await sendPlan([{ name: 'read', args: { path: 'missing.txt' } }]);
      assert(failed.some(v => v.type === 'tool_end' && v.outcome === 'failed'));
      const running = sendPlan([{ name: process.platform === 'win32' ? 'powershell' : 'bash', args: { command: process.platform === 'win32'
        ? '[System.IO.File]::WriteAllText((Join-Path (Get-Location) "started.txt"), "started"); Start-Sleep -Seconds 30; [System.IO.File]::WriteAllText((Join-Path (Get-Location) "not-expected.txt"), "done")'
        : 'touch started.txt; sleep 30; touch not-expected.txt' } }]);
      for (let i = 0; i < 100; i++) { try { await readFile(join(project, 'started.txt')); break; } catch { await delay(80); } }
      await readFile(join(project, 'started.txt'));
      await server.json(path('/config'), 'PUT', { autoCompaction: false }, 409);
      await server.json(path('/stop'), 'POST');
      assertFinal(await running, 'aborted');
      await assert.rejects(readFile(join(project, 'not-expected.txt')));
      assert.equal((await server.json(path())).activity, 'idle');
    });
  } finally { await server.close(); await fixture.close(); await rm(directory, { recursive: true, force: true }); }
});
