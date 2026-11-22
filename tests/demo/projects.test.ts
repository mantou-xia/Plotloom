import assert from 'node:assert/strict';
import test from 'node:test';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';

test('项目创建、历史、文件候选和技能诊断在试验台有完整契约', () => {
  const create = API_CATALOG.find(item => item.id === 'sessions.create')!;
  assert(create.request.some(field => field.name === 'projectPath' && field.required));
  assert(create.examples.some(example => example.body.projectPath));
  assert.match(create.note, /PROJECT_PATH_INVALID/);
  assert.match(create.note, /400 INVALID_REQUEST/);
  assert(create.examples.every(example => example.body.projectPath));
  const novel = API_CATALOG.find(item => item.id === 'chats.create')!;
  assert.equal(novel.path, '/api/workspaces/:workspaceId/sessions');
  assert(novel.request.some(field => field.name === 'workspaceId' && field.required));
  assert(novel.request.every(field => field.name !== 'projectPath'));
  assert.match(novel.note, /400 INVALID_REQUEST/);
  for (const id of ['sessions.get', 'sessions.list', 'chats.list']) {
    assert(API_CATALOG.find(item => item.id === id)!.response.some(field => field.name.endsWith('projectPath')), id);
  }
  const search = API_CATALOG.find(item => item.id === 'sessions.project-files')!;
  assert.equal(search.method, 'POST');
  assert(search.request.some(field => field.name === 'query'));
  for (const name of ['entries[].path', 'entries[].isDirectory', 'truncated']) assert(search.response.some(field => field.name === name));
  assert.match(search.note, /PROJECT_NOT_SELECTED/);
});

test('项目登记、空项目列表与系统选择器具有完整公开契约，旧浏览接口已删除', () => {
  assert(!API_CATALOG.some(item => item.path === '/api/project-directories'));
  const create = API_CATALOG.find(item => item.id === 'projects.create')!;
  assert.equal(create.success, 201);
  assert(create.request.every(field => field.required));
  for (const name of ['id', 'name', 'path', 'createdAt']) assert(create.response.some(field => field.name === name));
  assert.match(create.note, /409 PROJECT_ALREADY_EXISTS/);
  const list = API_CATALOG.find(item => item.id === 'projects.list')!;
  assert.match(list.description, /尚无聊天/);
  const picker = API_CATALOG.find(item => item.id === 'projects.select-folder')!;
  assert.equal(picker.method, 'POST');
  assert.equal(picker.response[0].type, 'string | null');
  assert.match(picker.note, /中止请求会关闭/);
  for (const code of ['FOLDER_PICKER_BUSY', 'FOLDER_PICKER_FAILED', 'FOLDER_PICKER_UNAVAILABLE']) assert(picker.note.includes(code));
});

test('试验台可提交交付产物预览和外部打开示例，并核对各类响应', () => {
  const endpoint = API_CATALOG.find(item => item.id === 'sessions.deliverable')!;
  assert.equal(endpoint.method, 'POST');
  assert.equal(endpoint.path, '/api/sessions/:id/deliverable');
  assert.deepEqual(endpoint.request.map(field => field.name), ['id', 'path', 'action']);
  assert.deepEqual(endpoint.response.map(field => field.name), ['kind', 'content', 'src']);
  assert(endpoint.examples.some(example => example.body.action === 'open'));
  assert(endpoint.examples.some(example => example.body.action === 'preview' && String(example.body.path).startsWith('正文章节/')));
  assert.match(endpoint.note, /DELIVERABLE_UNAVAILABLE/);
});

test('分组接口在试验台提供目标 ID、置顶、移除及打开目录的可执行示例', () => {
  for (const [module, param] of [['projects', 'projectId'], ['workspaces', 'workspaceId']]) {
    const open = API_CATALOG.find(item => item.id === module + '.open-folder')!;
    assert.deepEqual(open.request.map(field => field.name), [param]);
    assert.deepEqual(open.examples[0].body, {});
    assert.equal(open.response[0].name, 'opened');
    const list = API_CATALOG.find(item => item.id === module + '.list')!;
    assert(list.response.some(field => field.name.endsWith('[].sidebarHidden') && !field.required));
    const update = API_CATALOG.find(item => item.id === (module === 'projects' ? 'projects.update' : 'workspaces.shelf'))!;
    for (const name of [param, 'pinned', 'sidebarHidden', module === 'projects' ? 'name' : 'title'])
      assert(update.request.some(field => field.name === name));
  }
});
