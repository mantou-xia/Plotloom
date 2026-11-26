import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startServer, collect, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

/** 模型仅决定工具参数；项目目录、文件审批和持久化均走真实实现。 */
test('项目 Agent 文件、权限、历史与停止闭环', { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-project-'));
  const project = join(directory, 'project');
  const other = join(directory, 'other');
  const book = join(directory, 'book');
  await mkdir(project); await mkdir(other); await mkdir(book);
  await writeFile(join(project, 'README.md'), '项目原文-731', 'utf8');
  await mkdir(join(project, 'node_modules'));
  await writeFile(join(project, 'node_modules', 'ignored.txt'), '不可作为候选');
  const fixture = await createModelFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'project', name: 'project', reasoning: true, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 2048 }] } } }));
  const env = { PLOTLOOM_DATA_DIR: join(directory, 'data'), PLOTLOOM_MODELS_PATH: modelsPath, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'project', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env, 40000);
  const path = (suffix = '') => `/api/sessions/${id}${suffix}`;
  const openPlan = (steps: unknown[]) => server.request(path('/messages'), 'POST', { text: `WRITE:${JSON.stringify({ steps, finalText: '项目任务完成' })}` });
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
      assert.equal((await server.json('/api/sessions', 'POST', {}, 400)).error.code, 'INVALID_REQUEST');
      await server.json('/api/sessions', 'POST', { mode: 'general', projectPath: project }, 400);
      const ordinary = await server.json('/api/sessions', 'POST', { mode: 'general' }, 201);
      const ordinaryPath = '/api/sessions/' + ordinary.id;
      assert.equal(ordinary.projectPath, undefined);
      await server.json(ordinaryPath + '/project-files', 'POST', { query: '' }, 409);
      await server.json(ordinaryPath + '/config', 'PUT', { projectApprovalMode: 'required' }, 409);
      await server.json('/api/agent-profile', 'PUT', { action: 'save', name: '小舟', style: '温和', preferences: '' });
      assertFinal(await collect(await server.request(ordinaryPath + '/messages', 'POST', { text: '平台普通聊天' })), 'completed');
      const ordinaryPrompt = JSON.stringify(fixture.requests.at(-1).messages.filter((message: { role: string }) => ['system', 'developer'].includes(message.role)));
      assert.match(ordinaryPrompt, /没有绑定项目或小说.*小舟/s);
      assert.doesNotMatch(ordinaryPrompt, /当前通过微信对话/);
      const ordinaryTools = (await server.json(ordinaryPath + '/tools')).tools.filter((tool: { active: boolean }) => tool.active);
      assert(!ordinaryTools.some((tool: { name: string }) => ['read', 'write', 'edit'].includes(tool.name)));
      const workspace = await server.json('/api/workspaces', 'POST', { title: '小说验收', root: book }, 201);
      const novelPath = `/api/workspaces/${workspace.id}/sessions`;
      await server.json(novelPath, 'POST', { projectPath: book }, 400);
      const novel = await server.json(novelPath, 'POST', {}, 201);
      await writeFile(join(book, '正文章节', '第四章.md'), '# 第四章');
      assert.deepEqual(await server.json('/api/sessions/' + novel.id + '/deliverable', 'POST',
        { path: '正文章节/第四章.md', action: 'preview' }), { kind: 'markdown', content: '# 第四章' });
      const toolNames = (await server.json(path('/tools'))).tools.filter((v: any) => v.active).map((v: any) => v.name);
      assert.deepEqual(new Set(toolNames), new Set(['read', 'write', 'edit', 'grep', 'find', 'ls', 'browser', 'web_fetch', 'ask_user']));
      assert((await server.json(`/api/sessions/${novel.id}/tools`)).tools.some((v: any) => v.name === 'write' && v.active));
      assert((await server.json(`/api/sessions/${novel.id}/project-files`, 'POST', { query: '第四章' })).entries.some((entry: { path: string }) => entry.path === '正文章节/第四章.md'));
      const novelSession = '/api/sessions/' + novel.id;
      assert.deepEqual((await server.json(novelSession + '/project-writes')).changes, []);
      const response = await server.request(novelSession + '/messages', 'POST', { text: 'WRITE:' + JSON.stringify({
        steps: [{ name: 'write', args: { path: '写作笔记.txt', content: '线索' } }], finalText: '已保存',
      }) });
      const received = [];
      for await (const event of events(response)) {
        received.push(event);
        if (event.type === 'tool_approval_required') await server.json(novelSession + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
      }
      assertFinal(received, 'completed');
      const [change] = (await server.json(novelSession + '/project-writes')).changes;
      assert.equal(change.path, '写作笔记.txt');
      assert.equal((await server.json(novelSession + '/project-writes/' + change.id)).added, 1);
      assert.equal((await server.json(novelSession)).fileChanges[0].files[0].path, change.path);
      await server.json(path('/config'), 'PUT', { projectPath: other }, 400);
      await server.close();
      const sessionsDir = join(env.PLOTLOOM_DATA_DIR, 'sessions');
      const files = await readdir(sessionsDir);
      const projectFile = files.find(name => name.includes(second.id))!;
      const legacyEntries = (await readFile(join(sessionsDir, projectFile), 'utf8')).trim().split('\n')
        .map(line => JSON.parse(line)).filter(entry => entry.customType !== 'plotloom-project');
      const legacySessions = await Promise.all([false, true].map(async archived => {
        const id = crypto.randomUUID();
        const file = join(sessionsDir, projectFile.replace(second.id, id));
        const [header, ...entries] = legacyEntries;
        const organization = { type: 'custom', id: 'abcdef01', parentId: entries.at(-1)?.id ?? null, timestamp: new Date().toISOString(),
          customType: 'plotloom-organization', data: { pinned: true, archived } };
        await writeFile(file, [{ ...header, id }, ...entries, organization].map(entry => JSON.stringify(entry)).join('\n') + '\n');
        const paths = ['attachments', 'browsers'].map(kind => join(env.PLOTLOOM_DATA_DIR, kind, id, 'legacy.txt'));
        for (const path of paths) {
          await mkdir(join(path, '..'), { recursive: true });
          await writeFile(path, '旧普通会话专属数据');
        }
        return { id, paths: [file, ...paths] };
      }));
      const retainedDir = join(env.PLOTLOOM_DATA_DIR, 'attachments', novel.id);
      await mkdir(retainedDir, { recursive: true });
      const retained = join(retainedDir, 'preserved.txt');
      await writeFile(retained, '小说附件保留');
      server = await startServer(env, 40000);
      for (const legacy of legacySessions) {
        await server.json(`/api/sessions/${legacy.id}`, 'GET', undefined, 404);
        for (const path of legacy.paths) await assert.rejects(readFile(path), { code: 'ENOENT' });
      }
      assert.equal(await readFile(retained, 'utf8'), '小说附件保留');
      const sessions = (await server.json('/api/sessions')).sessions;
      for (const expected of [id, second.id, novel.id, ordinary.id]) assert(sessions.some((v: any) => v.id === expected));
      assert(JSON.stringify((await server.json(ordinaryPath)).messages).includes('平台普通聊天'));
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
    await t.test('交付产物预览限于当前项目，未知格式与不可访问文件分别反馈', async () => {
      const endpoint = path('/deliverable');
      const preview = (path: string, status = 200) => server.json(endpoint, 'POST', { path, action: 'preview' }, status);
      assert.deepEqual(await preview('README.md'), { kind: 'markdown', content: '项目原文-731' });
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR6kAAAAASUVORK5CYII=', 'base64');
      await writeFile(join(project, '封面.png'), image);
      assert.deepEqual(await preview('封面.png'), { kind: 'image', src: 'data:image/png;base64,' + image.toString('base64') });
      await writeFile(join(project, '输出.xlsx'), 'spreadsheet');
      assert.deepEqual(await preview('输出.xlsx'), { kind: 'unsupported' });
      await writeFile(join(other, 'outside.md'), '# Other');
      for (const input of ['不存在.md', '../other/outside.md', 'node_modules']) {
        assert.equal((await preview(input, 404)).error.code, 'DELIVERABLE_UNAVAILABLE');
      }
      assert.equal((await preview(join(other, 'outside.md'), 400)).error.code, 'INVALID_REQUEST');
      await writeFile(join(project, '脚本.cmd'), '');
      assert.equal((await server.json(endpoint, 'POST', { path: '脚本.cmd', action: 'open' }, 422)).error.code, 'DELIVERABLE_OPEN_UNSUPPORTED');
    });
    await t.test('项目读取、搜索和审批后的修改真正作用于绑定目录', async () => {
      const steps = [
        { name: 'ls', args: { path: '.' } },
        { name: 'find', args: { pattern: '*.md', path: '.' } },
        { name: 'grep', args: { pattern: '731', path: '.' } },
        { name: 'read', args: { path: 'README.md' } },
        { name: 'write', args: { path: 'result.txt', content: 'before' } },
        { name: 'edit', args: { path: 'result.txt', oldText: 'before', newText: 'after-731' } },
      ];
      const result = [];
      for await (const event of events(await openPlan(steps))) {
        result.push(event);
        if (event.type === 'tool_approval_required') {
          assert.equal((await server.json(path())).fileChanges, undefined, '即使已有写入，轮次执行中也不返回本轮摘要');
          await server.json(path('/tool-approvals/' + event.approval.id), 'POST', { decision: 'approve' });
        }
      }
      assert.equal(result.filter(event => event.type === 'tool_approval_required').length, 2);
      assertFinal(result, 'completed');
      const ends = result.filter(v => v.type === 'tool_end');
      assert.equal(ends.length, steps.length);
      assert(ends.every(v => v.type === 'tool_end' && v.outcome === 'completed'), JSON.stringify(await server.json(path())));
      assert.equal(await readFile(join(project, 'result.txt'), 'utf8'), 'after-731');
      await assert.rejects(readFile(join(other, 'result.txt')));
      await server.close(); server = await startServer(env, 40000);
      const restored = await server.json(path());
      assert(restored.messages.some((v: any) => v.role === 'tool' && JSON.stringify(v).includes('731')));
      assert(restored.messages.some((v: any) => v.role === 'assistant' && JSON.stringify(v).includes('项目任务完成')));
    });
    await t.test('文件对比保存成功写入的当次前后版本与行号', async () => {
      const list = path('/project-writes');
      const changes = (await server.json(list)).changes;
      assert.deepEqual(changes.map((entry: { path: string; operation: string }) => [entry.path, entry.operation]), [
        ['result.txt', 'create'], ['result.txt', 'edit'],
      ]);
      assert.notEqual(changes[0].id, changes[1].id);
      const snapshot = await server.json(path());
      const turnId = snapshot.messages.find((message: { role: string }) => message.role === 'user').turnId;
      assert.deepEqual(snapshot.fileChanges, [{ turnId, files: [{ path: 'result.txt', added: 1, removed: 0,
        writeIds: changes.map((entry: { id: string }) => entry.id) }] }], '同一轮新建后再编辑同一文件只计最终新增');
      assert(!('before' in changes[0]) && !('after' in changes[0]));
      const create = await server.json(list + '/' + changes[0].id);
      assert.deepEqual(create.blocks, [{ kind: 'added', beforeStart: null, afterStart: 1, lines: ['before'] }]);
      assert.equal(create.added, 1);
      assert.equal(create.removed, 0);
      const resultPath = join(project, 'result.txt');
      await writeFile(resultPath, '引言\r\n旧行\r\n结尾\r\n');
      const steps = [{ name: 'write', args: { path: 'result.txt', content: '引言\r\n新行\r\n又一行\r\n结尾\r\n' } }];
      for await (const event of events(await openPlan(steps))) {
        if (event.type === 'tool_approval_required') {
          assert.equal((await server.json(list)).changes.length, 2);
          await server.json(path('/tool-approvals/' + event.approval.id), 'POST', { decision: 'approve' });
        }
      }
      const latest = (await server.json(list)).changes.at(-1);
      assert.equal(latest.operation, 'overwrite');
      const diffPath = list + '/' + latest.id;
      const diff = await server.json(diffPath);
      assert.equal(diff.added, 2);
      assert.equal(diff.removed, 1);
      assert.deepEqual(diff.blocks, [
        { kind: 'context', beforeStart: 1, afterStart: 1, lines: ['引言\r\n'] },
        { kind: 'removed', beforeStart: 2, afterStart: null, lines: ['旧行\r\n'] },
        { kind: 'added', beforeStart: null, afterStart: 2, lines: ['新行\r\n', '又一行\r\n'] },
        { kind: 'context', beforeStart: 3, afterStart: 4, lines: ['结尾\r\n'] },
      ]);
      const sameText = await collect(await openPlan(steps));
      assert(!sameText.some(e => e.type === 'tool_approval_required'));
      for await (const event of events(await openPlan([{ name: 'write', args: { path: 'denied.txt', content: '拒绝的内容' } }]))) {
        if (event.type === 'tool_approval_required') await server.json(path('/tool-approvals/' + event.approval.id), 'POST', { decision: 'deny' });
      }
      assert.equal((await server.json(list)).changes.length, 3);
      const summaries = (await server.json(path())).fileChanges;
      assert.equal(summaries.length, 2, '无变化和拒绝写入的轮次无摘要');
      assert.deepEqual(summaries[1].files, [{ path: 'result.txt', added: 2, removed: 1, writeIds: [latest.id] }]);
      await assert.rejects(readFile(join(project, 'denied.txt')), { code: 'ENOENT' });
      const otherSession = await server.json('/api/sessions', 'POST', { projectPath: project }, 201);
      assert.deepEqual(await server.json(`/api/sessions/${otherSession.id}/project-writes`), { changes: [] });
      assert.equal((await server.json(`/api/sessions/${otherSession.id}/project-writes/${latest.id}`, 'GET', undefined, 404)).error.code, 'PROJECT_WRITE_NOT_FOUND');
      assert.equal((await server.json(list + '/invalid', 'GET', undefined, 400)).error.code, 'INVALID_REQUEST');
      assert.equal((await server.json('/api/sessions/unknown/project-writes', 'GET', undefined, 404)).error.code, 'SESSION_NOT_FOUND');
      await writeFile(resultPath, '后续人工修改');
      await server.close(); server = await startServer(env, 40000);
      assert.deepEqual(await server.json(diffPath), diff);
      assert.deepEqual((await server.json(path())).fileChanges, summaries);
    });
    await t.test('项目技能按实际工具诊断并可发送', async () => {
      const skill = await server.json('/api/skills', 'POST', { content: '---\nname: project-read\ndescription: 检查工程\nallowed-tools: read write\n---\n读取项目内容后再处理。' }, 201);
      const active = await server.json(path('/skills'), 'PUT', { skillIds: [skill.id] });
      assert.equal(active.skills[0].runnable, true);
      const response = await collect(await server.request(path('/messages'), 'POST', { text: 'HELLO', skillIds: [skill.id] }));
      assertFinal(response, 'completed');
      assert(fixture.requests.some(v => JSON.stringify(v.messages).includes('读取项目内容后再处理')));
    });
    await t.test('失败可见，停止会取消审批且不会继续写入', async () => {
      const failed = await collect(await openPlan([{ name: 'read', args: { path: 'missing.txt' } }]));
      assert(failed.some(v => v.type === 'tool_end' && v.outcome === 'failed'));
      const terminal = await collect(await openPlan([{ name: process.platform === 'win32' ? 'powershell' : 'bash', args: { command: 'echo blocked' } }]));
      assert(terminal.some(v => v.type === 'tool_end' && v.outcome === 'failed'));
      const before = await server.json(path('/project-writes'));
      const received = [];
      for await (const event of events(await openPlan([{ name: 'write', args: { path: 'not-expected.txt', content: 'blocked' } }]))) {
        received.push(event);
        if (event.type === 'tool_approval_required') {
          await server.json(path('/config'), 'PUT', { autoCompaction: false }, 409);
          await server.json(path('/stop'), 'POST');
        }
      }
      assertFinal(received, 'aborted');
      assert.deepEqual(await server.json(path('/project-writes')), before);
      await assert.rejects(readFile(join(project, 'not-expected.txt')));
      assert.equal((await server.json(path())).activity, 'idle');
      const partialSteps = ['saved-before-stop.txt', 'not-expected.txt'].map(path => ({ name: 'write', args: { path, content: '一行\n' } }));
      const partial = [];
      for await (const event of events(await openPlan(partialSteps))) {
        partial.push(event);
        if (event.type !== 'tool_approval_required') continue;
        if (event.approval.path === 'saved-before-stop.txt') await server.json(path('/tool-approvals/' + event.approval.id), 'POST', { decision: 'approve' });
        else await server.json(path('/stop'), 'POST');
      }
      assertFinal(partial, 'aborted');
      const detail = await server.json(path());
      const stoppedTurn = detail.messages.filter((message: { role: string }) => message.role === 'user').at(-1);
      const saved = detail.fileChanges.find((summary: { turnId: string }) => summary.turnId === stoppedTurn.turnId);
      assert.deepEqual(saved.files.map((file: { path: string }) => file.path), ['saved-before-stop.txt']);
    });
  } finally { await server.close(); await fixture.close(); await rm(directory, { recursive: true, force: true }); }
});
