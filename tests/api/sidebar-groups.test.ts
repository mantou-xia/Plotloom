import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { openRegisteredFolder } from '../../apps/server/src/platform/open-folder.ts';

/** 真实登记与磁盘，替换桌面窗口启动，以便独立验证两个公开入口实际解析出的目录。 */
test('分组更新只影响登记属性，移除后可继续读取目录、稿件和书架', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-groups-'));
  const options = { dataDir: join(root, 'data') };
  const opened: string[] = [];
  const deps = { openFolder: async (path: string) => { opened.push(path); return { opened: true }; } };
  let app = await buildServer(options, deps);
  try {
    const projectPath = join(root, '项目 A'), novelPath = join(root, '小说 B');
    await mkdir(projectPath); await mkdir(novelPath);
    const project = (await app.inject({ method: 'POST', url: '/api/projects', payload: { name: '项目', path: projectPath } })).json();
    const novel = (await app.inject({ method: 'POST', url: '/api/workspaces', payload: { title: '小说', root: novelPath } })).json();
    const manuscript = join(novelPath, '正文章节', '第一章.md');
    await writeFile(manuscript, '保留正文');
    for (const [base, edit, name, dir] of [
      ['/api/projects/' + project.id, '', 'name', project.path],
      ['/api/workspaces/' + novel.id, '/shelf', 'title', novel.root],
    ]) {
      const url = base + edit;
      const updates = await Promise.all([{ pinned: true }, { [name]: '  新名  ' }, { sidebarHidden: true }].map(payload =>
        app.inject({ method: 'PUT', url, payload })));
      assert(updates.every(result => result.statusCode === 200));
      assert.equal((await app.inject({ method: 'PUT', url, payload: {} })).statusCode, 400);
      assert.equal((await app.inject({ method: 'PUT', url, payload: { [name]: '  ' } })).statusCode, name === 'name' ? 422 : 400);
      assert.equal((await app.inject({ method: 'POST', url: base + '/open-folder', payload: { path: root } })).statusCode, 400);
      assert.deepEqual((await app.inject({ method: 'POST', url: base + '/open-folder', payload: {} })).json(), { opened: true });
      assert.equal(opened.at(-1), dir);
      const absent = base.slice(0, base.lastIndexOf('/') + 1) + 'unknown';
      assert.equal((await app.inject({ method: 'POST', url: absent + '/open-folder', payload: {} })).statusCode, 404);
      assert.equal((await app.inject({ method: 'PUT', url: absent + edit, payload: { pinned: false } })).statusCode, 404);
    }
    await app.close();
    app = await buildServer(options);
    for (const [url, list, name] of [['/api/projects', 'projects', 'name'], ['/api/workspaces', 'workspaces', 'title']]) {
      const [entry] = (await app.inject(url)).json()[list];
      assert.equal(entry[name], '新名');
      assert.equal(entry.pinned, true);
      assert.equal(entry.sidebarHidden, true);
    }
    assert.equal(await readFile(manuscript, 'utf8'), '保留正文');
    assert.equal((await app.inject('/api/workspaces/' + novel.id + '/documents')).json().paths[0], '正文章节/第一章.md');
    await rename(projectPath, projectPath + '-moved');
    if (process.platform === 'win32') {
      const missing = await app.inject({ method: 'POST', url: '/api/projects/' + project.id + '/open-folder', payload: {} });
      assert.equal(missing.statusCode, 422);
      assert.equal(missing.json().error.code, 'FOLDER_UNAVAILABLE');
    } else await assert.rejects(openRegisteredFolder(novelPath), { code: 'EXPLORER_UNAVAILABLE' });
  } finally { await app.close(); await rm(root, { recursive: true, force: true }); }
});
