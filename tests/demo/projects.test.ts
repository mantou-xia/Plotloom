import assert from 'node:assert/strict';
import test from 'node:test';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';

test('项目创建、历史、文件候选和技能诊断在试验台有完整契约', () => {
  const create = API_CATALOG.find(item => item.id === 'sessions.create')!;
  assert(create.request.some(field => field.name === 'projectPath' && !field.required));
  assert(create.examples.some(example => example.body.projectPath));
  assert.match(create.note, /PROJECT_PATH_INVALID/);
  for (const id of ['sessions.get', 'sessions.list', 'chats.list']) {
    assert(API_CATALOG.find(item => item.id === id)!.response.some(field => field.name.endsWith('projectPath')), id);
  }
  const search = API_CATALOG.find(item => item.id === 'sessions.project-files')!;
  assert.equal(search.method, 'POST');
  assert(search.request.some(field => field.name === 'query'));
  for (const name of ['entries[].path', 'entries[].isDirectory', 'truncated']) assert(search.response.some(field => field.name === name));
  assert.match(search.note, /PROJECT_NOT_SELECTED/);
});
