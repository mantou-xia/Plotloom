import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Project } from '../../packages/contracts/src/index.ts';
import { startServer } from './client.ts';

/** 独立进程和真实磁盘证明项目不依赖会话，重启仍存在，且源目录没有新增文件。 */
test('项目独立持久化、目录唯一和公开参数校验', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-projects-'));
  const path = join(root, '中文项目');
  await mkdir(path); await writeFile(join(path, 'README.md'), '原文');
  const env = { PLOTLOOM_DATA_DIR: join(root, 'data'), PLOTLOOM_API_KEY: '', PLOTLOOM_PROVIDER: '', PLOTLOOM_MODEL: '' };
  let server = await startServer(env);
  try {
    assert.deepEqual((await server.json('/api/projects')).projects, []);
    const project = await server.json<Project>('/api/projects', 'POST', { name: ' 自定义名称 ', path }, 201);
    assert.equal(project.name, '自定义名称'); assert.equal(project.path, await realpath(path));
    assert(project.id); assert(Number.isFinite(Date.parse(project.createdAt)));
    assert.deepEqual((await server.json('/api/projects')).projects, [project]);
    assert.deepEqual((await server.json('/api/sessions')).sessions, []);
    assert.deepEqual(await readdir(path), ['README.md']);
    await server.close(); server = await startServer(env);
    assert.deepEqual((await server.json('/api/projects')).projects, [project]);
    assert.equal((await server.json('/api/projects', 'POST', { name: '另一个名字', path: join(path, '..', '中文项目') }, 409)).error.code, 'PROJECT_ALREADY_EXISTS');
    for (const input of [{ name: '', path }, { name: 'a'.repeat(121), path }, { name: '名字' }, { name: 1, path }, { name: '名字', path, extra: true }]) {
      assert.equal((await server.json('/api/projects', 'POST', input, 400)).error.code, 'INVALID_REQUEST');
    }
    assert.equal((await server.json('/api/projects', 'POST', { name: '   ', path }, 422)).error.code, 'PROJECT_NAME_INVALID');
    for (const invalid of ['relative', join(path, 'missing'), join(path, 'README.md')]) {
      assert.equal((await server.json('/api/projects', 'POST', { name: '名字', path: invalid }, 422)).error.code, 'PROJECT_PATH_INVALID');
    }
    await assert.rejects(realpath(join(path, 'missing')));
    const next = join(root, 'another'); await mkdir(next);
    const results = await Promise.all([1, 2].map(i => server.request('/api/projects', 'POST', { name: `并发${i}`, path: next })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal((await server.json('/api/projects')).projects.length, 2);
    assert.equal((await server.json('/api/project-directories', 'POST', {}, 404)).error.code, 'NOT_FOUND');
    assert.equal((await server.json('/api/projects/select-folder', 'POST', { path }, 400)).error.code, 'INVALID_REQUEST');
    for (const endpoint of ['/api/projects', '/api/projects/select-folder']) {
      assert.equal((await fetch(server.address + endpoint, { method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    }
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
