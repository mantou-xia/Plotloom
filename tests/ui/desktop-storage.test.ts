import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildServer } from '../../apps/server/src/bootstrap.ts';

const { storageLocation } = createRequire(import.meta.url)('../../apps/desktop/storage-location.cjs');

test('桌面存储在重启时复制当前数据，后续启动持续使用新目录', async t => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'plotloom-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = join(directory, 'profile');
  const parent = join(directory, '写作数据');
  await mkdir(parent);
  const storage = storageLocation(profile);
  const { dataDir } = await storage.open();
  const session = join('sessions', 'test.jsonl');
  await mkdir(join(dataDir, 'sessions'));
  await writeFile(join(dataDir, session), '聊天记录');
  const destination = await storage.destination(parent, [profile, dataDir]);
  await storage.schedule(dataDir, destination);
  await assert.rejects(readFile(join(destination, session)), { code: 'ENOENT' });
  assert.deepEqual(await storageLocation(profile).open(), { dataDir: destination });
  assert.equal(await readFile(join(destination, session), 'utf8'), '聊天记录');
  assert.equal(await readFile(join(dataDir, session), 'utf8'), '聊天记录');
  assert.deepEqual(await storageLocation(profile).open(), { dataDir: destination });
});

test('桌面存储拒绝受保护目录，重启时目标被占用则回退且不覆盖文件', async t => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'plotloom-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = join(directory, 'profile');
  const parent = join(directory, 'destination');
  await mkdir(parent);
  const storage = storageLocation(profile);
  const { dataDir } = await storage.open();
  await assert.rejects(storage.destination(dataDir, [profile, dataDir]), /之外/);
  const destination = await storage.destination(parent, [profile, dataDir]);
  await storage.schedule(dataDir, destination);
  await mkdir(destination);
  await writeFile(join(destination, 'existing.txt'), '已有文件');
  assert.deepEqual(await storageLocation(profile).open(), { dataDir, migrationFailed: true });
  assert.equal(await readFile(join(destination, 'existing.txt'), 'utf8'), '已有文件');
  assert.deepEqual(await storageLocation(profile).open(), { dataDir });
});

test('覆盖升级继续使用旧版默认数据目录，导入其他旧目录时保留两边的原数据', async t => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'plotloom-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = join(directory, 'profile');
  const dataDir = join(profile, 'data');
  const legacy = join(directory, '.plotloom-data');
  await Promise.all([
    mkdir(join(dataDir, 'sessions'), { recursive: true }),
    mkdir(join(legacy, 'sessions'), { recursive: true }),
    mkdir(join(legacy, 'agent'), { recursive: true }),
    mkdir(join(legacy, 'attachments'), { recursive: true }),
  ]);
  const session = join('sessions', 'test.jsonl');
  const provider = { id: 'legacy-model-service', name: '旧版模型服务', api: 'openai-completions',
    baseUrl: 'http://127.0.0.1:1/v1', models: ['test'], apiKey: 'fixture-only-key' };
  const selection = { provider: provider.id, model: 'test', thinkingLevel: 'off' };
  const persona = { setup: 'configured', name: '小舟', style: '简洁', preferences: '先核对版本' };
  const files = {
    [session]: '旧版会话',
    'projects.json': '[]',
    'model-config.json': JSON.stringify(selection),
    'agent-profile.json': JSON.stringify(persona),
    [join('agent', 'providers.json')]: JSON.stringify([provider]),
    [join('agent', 'auth.json')]: '{}',
    [join('attachments', 'note.txt')]: '旧版附件',
  };
  await Promise.all(Object.entries(files).map(([file, content]) => writeFile(join(legacy, file), content)));
  await writeFile(join(dataDir, session), '当前会话');
  const storage = storageLocation(profile);
  assert.deepEqual(await storage.open(), { dataDir });
  assert.equal(await readFile(join(dataDir, session), 'utf8'), '当前会话');
  await assert.rejects(storage.importLocation(dataDir, dataDir), /旧版/);
  await assert.rejects(storage.importLocation(join(legacy, 'attachments'), dataDir), /未找到 Plotloom 数据/);

  const { sourceDir, pendingDir } = await storage.importLocation(legacy, dataDir);
  await storage.schedule(dataDir, pendingDir, sourceDir);
  assert.deepEqual(await storageLocation(profile).open(), { dataDir: pendingDir });
  for (const [file, content] of Object.entries(files)) {
    assert.equal(await readFile(join(pendingDir, file), 'utf8'), content);
    assert.equal(await readFile(join(legacy, file), 'utf8'), content);
  }
  assert.equal(await readFile(join(dataDir, session), 'utf8'), '当前会话');
  assert.deepEqual(await storageLocation(profile).open(), { dataDir: pendingDir });
  // 使用桌面后端相同的启动参数，验证迁移后的设置可以直接被应用读取。
  const app = await buildServer({ dataDir: pendingDir });
  try {
    const model = await app.inject('/api/model-config');
    assert.equal(model.statusCode, 200);
    assert.deepEqual(model.json(), { ...selection, configured: true });
    const profile = await app.inject('/api/agent-profile');
    assert.equal(profile.statusCode, 200);
    assert.deepEqual(profile.json(), persona);
  } finally { await app.close(); }
});

test('重启前旧数据目录不可访问时，继续使用当前目录', async t => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'plotloom-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = join(directory, 'profile');
  const legacy = join(directory, 'legacy');
  await mkdir(legacy);
  await writeFile(join(legacy, 'projects.json'), '[]');
  const storage = storageLocation(profile);
  const { dataDir } = await storage.open();
  const { sourceDir, pendingDir } = await storage.importLocation(legacy, dataDir);
  await storage.schedule(dataDir, pendingDir, sourceDir);
  await rm(join(legacy, 'projects.json'));
  await rm(legacy, { recursive: true });
  assert.deepEqual(await storageLocation(profile).open(), { dataDir, migrationFailed: true });
  assert.deepEqual(await storageLocation(profile).open(), { dataDir });
});
