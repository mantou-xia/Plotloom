import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildServer } from '../../apps/server/src/bootstrap.ts';

/** 临时书籍通过真实 HTTP 契约读取摘要、保存定稿并回收；失效版本不能删除后来写入的正文。 */
test('文稿目录、资源管理器路径约束和章节回收', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plotloom-directory-'));
  const root = join(dir, 'book');
  await mkdir(root);
  const app = await buildServer({ dataDir: join(dir, 'data') });
  try {
    const created = await app.inject({ method: 'POST', url: '/api/workspaces', payload: { title: '目录验收', root } });
    const base = '/api/workspaces/' + created.json().id;
    const post = (suffix: string, payload: object) => app.inject({ method: 'POST', url: base + suffix, payload });
    const path = '正文章节/目录验收第一章.md';
    const full = join(root, path);
    await writeFile(full, '# 目录验收第一章\n\n渡船抵达。');
    const entry = (await app.inject(base + '/document-entries')).json().entries[0];
    assert.equal(entry.path, path); assert.equal(entry.excerpt, '渡船抵达。');
    assert(Number.isFinite(Date.parse(entry.modifiedAt)));
    const { version } = (await post('/document/read', { path })).json();
    await post('/finalize', { path, baseVersion: version });
    for (const bad of ['../越界.md', '正文章节/../大纲/文稿.md'])
      assert.equal((await post('/document/reveal', { path: bad })).statusCode, 400);
    assert.equal((await post('/document/reveal', { path: '大纲/缺失.md' })).statusCode, 404);
    assert.equal((await post('/chapter/recycle', { path: '大纲/文稿.md', baseVersion: version })).statusCode, 400);
    await writeFile(full, '更新后');
    assert.equal((await post('/chapter/recycle', { path, baseVersion: version })).statusCode, 409);
    assert.equal(await readFile(full, 'utf8'), '更新后');
    if (process.platform === 'win32') {
      const current = (await post('/document/read', { path })).json();
      const result = await post('/chapter/recycle', { path, baseVersion: current.version });
      assert.equal(result.statusCode, 200, result.body); assert.deepEqual(result.json(), { recycled: true });
      assert.deepEqual((await app.inject(base + '/document-entries')).json().entries, []);
      assert.equal((await post('/history', { path })).json().revisions[0].version, version);
    }
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
});
