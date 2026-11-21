import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { checkJson, checkFields } from '../../apps/api-demo/src/client.ts';

test('工具目录与全局开关在试验台可触发并检查新字段', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-tool-demo-'));
  const app = await buildServer({ dataDir: directory });
  try {
    for (const id of ['tools.list', 'skills.list', 'skills.get', 'skills.enabled']) {
      const endpoint = API_CATALOG.find(item => item.id === id)!;
      const response = await app.inject({ method: endpoint.method, url: endpoint.path.replace(':skillId', 'builtin-novel-writing'),
        ...(endpoint.method === 'PUT' ? { payload: { enabled: false } } : {}) });
      assert.equal(response.statusCode, endpoint.success);
      assert(checkJson(endpoint, response.statusCode, String(response.headers['content-type']), response.json()).every(check => check.passed), id);
      if (id === 'tools.list') {
        assert(endpoint.response.some(field => field.name === 'tools[].provider' && field.required));
        for (const name of ['browser', 'web_fetch']) {
          assert.deepEqual(response.json().tools.find((tool: { name: string }) => tool.name === name)?.availableIn, ['project', 'novel']);
        }
        const forbidden = await app.inject({ method: endpoint.method, url: endpoint.path, headers: { origin: 'http://other.example' } });
        assert.equal(forbidden.statusCode, 403);
        assert.equal(forbidden.json().error.code, 'ORIGIN_FORBIDDEN');
      }
    }
    const endpoint = API_CATALOG.find(item => item.id === 'skills.enabled')!;
    const path = endpoint.path.replace(':skillId', 'builtin-novel-writing');
    const on = await app.inject({ method: 'PUT', url: path, payload: { enabled: true } });
    assert.equal(on.json().enabled, true); assert.equal(on.json().runnable, true);
    assert(checkFields(on.json(), endpoint.response).every(check => check.passed));
    assert.equal((await app.inject({ method: 'PUT', url: path, payload: { enabled: 1 } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: endpoint.path.replace(':skillId', 'missing'), payload: { enabled: false } })).statusCode, 404);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

/** 使用试验台相同的目录与响应检查器，实际触发新协议，取消和成功均须可检查。 */
test('技能试验台新导入契约覆盖成功、取消、错误并移除旧路径输入', async () => {
  const endpoint = API_CATALOG.find(item => item.id === 'skills.import-folder')!;
  assert(endpoint);
  assert(!API_CATALOG.some(item => item.path === '/api/skills/import'));
  assert.deepEqual(endpoint.request, []);
  assert.deepEqual(endpoint.examples[0].body, {});
  for (const code of ['FOLDER_PICKER_BUSY', 'FOLDER_PICKER_FAILED', 'FOLDER_PICKER_UNAVAILABLE', 'SKILL_NAME_EXISTS', 'SKILL_IMPORT_FAILED']) assert(endpoint.note.includes(code));
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-skill-demo-'));
  const source = join(directory, 'sample-skill'); await mkdir(source);
  await writeFile(join(source, 'SKILL.md'), '---\nname: sample-skill\ndescription: 试验台导入\n---\n技能内容');
  let selection: string | null = null;
  const app = await buildServer({ dataDir: join(directory, 'data') }, { folderPicker: { select: async () => ({ path: selection }), close() {} } });
  try {
    const invoke = () => app.inject({ method: endpoint.method, url: endpoint.path, payload: endpoint.examples[0].body });
    const cancelled = await invoke();
    assert.deepEqual(cancelled.json(), { skill: null });
    assert(checkJson(endpoint, cancelled.statusCode, String(cancelled.headers['content-type']), cancelled.json()).every(c => c.passed));
    selection = source;
    const imported = await invoke();
    assert(checkJson(endpoint, imported.statusCode, String(imported.headers['content-type']), imported.json()).every(c => c.passed));
    const details = API_CATALOG.find(item => item.id === 'skills.get')!;
    assert(checkFields(imported.json().skill, details.response).every(c => c.passed));
    assert.equal(imported.json().skill.source, 'imported');
    const duplicate = await invoke(); assert.equal(duplicate.statusCode, 409); assert.equal(duplicate.json().error.code, 'SKILL_NAME_EXISTS');
    selection = join(directory, 'missing'); assert.equal((await invoke()).statusCode, 422);
    assert.equal((await app.inject({ method: 'POST', url: endpoint.path, payload: { root: source } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/api/skills/import', payload: { root: source } })).statusCode, 404);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
