import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, open, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { startServer } from './client.ts';
import type { DocumentView, Proposal } from '../../packages/contracts/src/workspaces.ts';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** 所有业务断言使用独立子进程 HTTP；直接文件操作仅模拟用户外部编辑和崩溃落盘状态。 */
test('P2 Markdown 工作区公开接口闭环', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-p2-'));
  const data = join(root, 'data'); const bookA = join(root, '作品甲'); const bookB = join(root, '作品乙');
  await mkdir(bookA); await mkdir(bookB); await mkdir(data);
  const env = { PLOTLOOM_DATA_DIR: data, PLOTLOOM_API_KEY: '', PLOTLOOM_PROVIDER: '', PLOTLOOM_MODEL: '' };
  let server = await startServer(env);
  let a = ''; let b = ''; let proposal: Proposal;
  const path = '章节/0001.md'; const base = '\uFEFF# 第一章\r\n旧一😀\r\n不改甲\r\n旧二\r\n不改乙\r\n旧三\r\n';
  const read = (id = a, p = path) => server.json<DocumentView>(`/api/workspaces/${id}/document/read`, 'POST', { path: p });
  const save = (p: string, content: string, baseVersion: string | null, id = a) => server.json<DocumentView>(`/api/workspaces/${id}/document`, 'PUT', { path: p, content, baseVersion });
  const decide = (p: Proposal, index: number, action = 'accept', expected = 200, id = a) => server.json<Proposal>(`/api/workspaces/${id}/proposals/${p.id}/changes/${p.changes[index].id}`, 'POST', { action }, expected);
  const history = (p = path) => server.json(`/api/workspaces/${a}/history`, 'POST', { path: p });
  try {
    await t.test('登记、目录归属、同名原稿隔离和重启', async () => {
      a = (await server.json('/api/workspaces', 'POST', { title: '甲', root: bookA }, 201)).id;
      b = (await server.json('/api/workspaces', 'POST', { title: '乙', root: bookB }, 201)).id;
      assert.equal((await server.json('/api/workspaces')).workspaces.length, 2);
      assert.equal((await server.json(`/api/workspaces/${a}`)).root, bookA);
      await server.json('/api/workspaces', 'POST', { title: '重复', root: bookA }, 409);
      await mkdir(join(bookA, '子目录'));
      await server.json('/api/workspaces', 'POST', { title: '嵌套', root: join(bookA, '子目录') }, 409);
      await server.json('/api/workspaces', 'POST', { title: '越界', root }, 400);
      assert.equal((await read()).version, null);
      assert.equal((await save(path, base, null)).content, base);
      await save(path, '另一部作品', null, b);
      await server.close(); server = await startServer(env);
      assert.equal((await read()).content, base);
      assert.equal((await read(b)).content, '另一部作品');
      assert.deepEqual((await server.json(`/api/workspaces/${a}/documents`)).paths, [path]);
    });
    await t.test('过期保存、并发保存和外部修改被观察', async () => {
      const v = (await read()).version;
      const responses = await Promise.all(['甲稿', '乙稿'].map((content) => server.request(`/api/workspaces/${a}/document`, 'PUT', { path, content, baseVersion: v })));
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      await writeFile(join(bookA, path), base, 'utf8');
      assert.equal((await read()).content, base);
      const count = (await history()).revisions.length;
      await save(path, base, digest(base));
      assert.equal((await history()).revisions.length, count);
    });
    await t.test('候选差异、乱序采纳、偏移、重复采纳和重启继续', async () => {
      const next = base.replace('旧一😀', '新一😀增加长度').replace('旧二', '新二').replace('旧三', '新三');
      proposal = await server.json(`/api/workspaces/${a}/proposals`, 'POST', { path, content: next, baseVersion: digest(base) }, 201);
      assert.equal(proposal.changes.length, 3);
      assert.equal(await readFile(join(bookA, path), 'utf8'), base);
      await decide(proposal, 2); await decide(proposal, 0);
      const expected = base.replace('旧一😀', '新一😀增加长度').replace('旧三', '新三');
      assert.equal((await read()).content, expected);
      const count = (await history()).revisions.length;
      await decide(proposal, 0);
      assert.equal((await history()).revisions.length, count);
      await server.close(true); server = await startServer(env);
      const reopened = await server.json<Proposal>(`/api/workspaces/${a}/proposals/${proposal.id}`);
      assert.equal(reopened.status, 'partial');
      assert.deepEqual(reopened.changes.map((c) => c.status), ['accepted', 'pending', 'accepted']);
      await decide(proposal, 1, 'reject');
      assert.equal((await read()).content, expected);
      await decide(proposal, 1, 'accept', 409);
      await decide(proposal, 0, 'accept', 404, b);
      assert.equal((await server.json(`/api/workspaces/${a}/proposals`)).proposals[0].status, 'resolved');
    });
    await t.test('先采纳前处再采纳后处；选区定位重复文字及 emoji', async () => {
      await save('选区.md', '相同😀\n保留\n相同😀\n结尾', null);
      const doc = await read(a, '选区.md'); const start = doc.content.lastIndexOf('相同');
      const p = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path: doc.path, baseVersion: doc.version, content: '仅改第二次', selection: { start, end: start + '相同😀'.length, text: '相同😀' } }, 201);
      await decide(p, 0);
      assert.equal((await read(a, doc.path)).content, '相同😀\n保留\n仅改第二次\n结尾');
      const current = await read(a, doc.path);
      await server.json(`/api/workspaces/${a}/proposals`, 'POST', { path: doc.path, baseVersion: current.version, content: '错位', selection: { start: 3, end: 4, text: current.content.slice(3, 4) } }, 400);
      const p2 = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path: doc.path, baseVersion: current.version, content: current.content.replace('相同😀', '第一段明显增长😀').replace('结尾', '新结尾') }, 201);
      await decide(p2, 0); await decide(p2, 1);
      assert.equal((await read(a, doc.path)).content, '第一段明显增长😀\n保留\n仅改第二次\n新结尾');
    });
    await t.test('新建候选、外部新建占位和拒绝不落盘', async () => {
      const p = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path: '新章.md', baseVersion: null, content: '候选新章' }, 201);
      assert.equal((await read(a, '新章.md')).version, null);
      await writeFile(join(bookA, '新章.md'), '外部先创建');
      await decide(p, 0, 'accept', 409);
      await decide(p, 0, 'reject');
      assert.equal((await read(a, '新章.md')).content, '外部先创建');
      const accepted = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path: '正式新章.md', baseVersion: null, content: '新章正文' }, 201);
      await decide(accepted, 0); assert.equal((await read(a, '正式新章.md')).content, '新章正文');
    });
    await t.test('参考资料变化和部分采纳后外部改稿', async () => {
      await save('角色.md', '# 性格特点\n谨慎', null);
      const ref = await read(a, '角色.md'); const doc = await read();
      const p = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path, baseVersion: doc.version, content: '新内容', references: [{ path: ref.path, version: ref.version }] }, 201);
      await writeFile(join(bookA, ref.path), '人物已调整');
      const error = await server.json(`/api/workspaces/${a}/proposals/${p.id}/changes/${p.changes[0].id}`, 'POST', { action: 'accept' }, 409);
      assert.equal(error.error.code, 'REFERENCE_CONFLICT');
      await save('外部.md', '一\n保留\n二\n', null);
      const p2 = await server.json<Proposal>(`/api/workspaces/${a}/proposals`, 'POST', { path: '外部.md', baseVersion: digest('一\n保留\n二\n'), content: '新一\n保留\n新二\n' }, 201);
      await decide(p2, 0);
      await writeFile(join(bookA, '外部.md'), '手工稿');
      await decide(p2, 1, 'accept', 409);
      assert.equal((await read(a, '外部.md')).content, '手工稿');
    });
    await t.test('历史恢复创建新记录、导出原文和指定章节搜索', async () => {
      const previous = (await history()).revisions.find((r: any) => r.version === digest(base));
      const current = await read();
      await server.json(`/api/workspaces/${a}/restore`, 'POST', { path, revisionId: previous.id, baseVersion: 'f'.repeat(64) }, 409);
      const beforeCount = (await history()).revisions.length;
      await server.json(`/api/workspaces/${a}/restore`, 'POST', { path, revisionId: previous.id, baseVersion: current.version });
      assert.equal((await history()).revisions.length, beforeCount + 1);
      const exported = await server.json(`/api/workspaces/${a}/export`, 'POST', { files: [{ path }, { path, revisionId: previous.id }] });
      assert.deepEqual(exported.files.map((f: any) => f.content), [base, base]);
      const found = await server.json(`/api/workspaces/${a}/search`, 'POST', { query: '旧一😀', paths: [path] });
      assert.equal(found.matches.length, 1); assert.equal(found.matches[0].start, base.indexOf('旧一😀'));
      assert.deepEqual((await server.json(`/api/workspaces/${b}/search`, 'POST', { query: '旧一😀' })).matches, []);
    });
    await t.test('Windows 已有写句柄阻止提交，原稿不损坏', async () => {
      const doc = await read();
      const handle = await open(join(bookA, path), 'r+');
      try { const err = await server.json(`/api/workspaces/${a}/document`, 'PUT', { path, content: '不能覆盖', baseVersion: doc.version }, 409); assert.equal(err.error.code, 'FILE_BUSY'); }
      finally { await handle.close(); }
      assert.equal((await read()).content, doc.content);
    });
    await t.test('路径、联接、编码和协议参数拒绝', async () => {
      for (const p of ['../越界.md', 'C:/越界.md', 'con.md', '章节/../越界.md', '章节\\0001.md', '章节/0001.md:流.md']) await server.json(`/api/workspaces/${a}/document/read`, 'POST', { path: p }, 400);
      await symlink(bookB, join(bookA, '链接'), 'junction');
      await server.json(`/api/workspaces/${a}/document/read`, 'POST', { path: '链接/章节/0001.md' }, 400);
      assert(!(await server.json(`/api/workspaces/${a}/documents`)).paths.some((p: string) => p.startsWith('链接/')));
      await writeFile(join(bookA, '编码.md'), Buffer.from([0xff, 0xfe, 0x61, 0]));
      await server.json(`/api/workspaces/${a}/document/read`, 'POST', { path: '编码.md' }, 422);
      await rm(join(bookA, '编码.md'));
      await server.json(`/api/workspaces/${a}/document`, 'PUT', { path, content: '缺少基础版本' }, 400);
      await server.json(`/api/workspaces/${a}/search`, 'POST', { query: '' }, 400);
    });
    await t.test('崩溃窗口：未写/已写/另有改稿分别恢复，不自动覆盖', async () => {
      const stateFile = join(data, 'workspaces', a, 'state.json');
      const inject = async (disk: 'before' | 'after' | 'external') => {
        const doc = await read();
        await server.close(true);
        const state = JSON.parse(await readFile(stateFile, 'utf8'));
        const revision = { id: randomUUID(), path, version: digest('待提交目标'), source: 'manual', createdAt: new Date().toISOString() };
        state.pending = { path, beforeVersion: doc.version, afterVersion: revision.version, revision };
        await writeFile(join(data, 'workspaces', a, 'revisions', `${revision.id}.md`), '待提交目标');
        await writeFile(stateFile, JSON.stringify(state));
        if (disk !== 'before') await writeFile(join(bookA, path), disk === 'after' ? '待提交目标' : '另外的外部内容');
        server = await startServer(env);
        return revision;
      };
      await inject('before'); await read();
      assert.equal((await server.json(`/api/workspaces/${a}/recovery`)).pending, null);
      const revision = await inject('after'); assert.equal((await read()).content, '待提交目标');
      assert((await history()).revisions.some((r: any) => r.id === revision.id));
      await inject('external');
      await server.json(`/api/workspaces/${a}/document/read`, 'POST', { path }, 409);
      const recovery = await server.json(`/api/workspaces/${a}/recovery`);
      assert.equal(recovery.current.content, '另外的外部内容'); assert.equal(recovery.intendedContent, '待提交目标');
      await server.json(`/api/workspaces/${a}/recovery`, 'POST', { version: '0'.repeat(64) }, 409);
      await server.json(`/api/workspaces/${a}/recovery`, 'POST', { version: recovery.current.version });
      assert.equal((await read()).content, '另外的外部内容');
    });
    await t.test('真实强退：登记写者后终止父进程，再开不会越过仍存活的写者', async () => {
      const doc = await read();
      const next = '写入进程中断验证😀'.repeat(10000);
      const request = server.request(`/api/workspaces/${a}/document`, 'PUT', { path, baseVersion: doc.version, content: next }).catch(() => null);
      const stateFile = join(data, 'workspaces', a, 'state.json');
      let sawWriter = false;
      for (let i = 0; i < 200; i++) {
        const state = JSON.parse(await readFile(stateFile, 'utf8'));
        if (state.pending?.writerPid) { sawWriter = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      assert(sawWriter, '必须实际命中已经登记写入进程的窗口');
      await server.close(true); await request; server = await startServer(env);
      let result: DocumentView | undefined;
      for (let i = 0; i < 100; i++) {
        const response = await server.request(`/api/workspaces/${a}/document/read`, 'POST', { path });
        const body = await response.json();
        if (response.ok) { result = body as DocumentView; break; }
        assert.equal((body as any).error.code, 'FILE_BUSY');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert(result); assert([doc.content, next].includes(result.content));
      assert.equal((await server.json(`/api/workspaces/${a}/recovery`)).pending, null);
    });
    await t.test('备份真实 Markdown、历史和候选，按说明恢复后状态一致', async () => {
      const destination = join(root, 'backup');
      const result = await server.json(`/api/workspaces/${a}/backup`, 'POST', { destination });
      assert(result.files > 0);
      assert.equal(await readFile(join(destination, 'manuscripts', path), 'utf8'), (await read()).content);
      const state = JSON.parse(await readFile(join(destination, 'metadata', 'state.json'), 'utf8'));
      assert.equal(state.proposals[0].status, 'resolved');
      assert((await readdir(join(destination, 'metadata', 'revisions'))).every((p) => p.endsWith('.md')));
      await server.json(`/api/workspaces/${a}/backup`, 'POST', { destination }, 409);
      const restoreData = join(root, 'restored-data');
      const { cp } = await import('node:fs/promises');
      await mkdir(join(restoreData, 'workspaces'), { recursive: true });
      await cp(join(destination, 'metadata'), join(restoreData, 'workspaces', a), { recursive: true });
      state.workspace.root = join(destination, 'manuscripts');
      await writeFile(join(restoreData, 'workspaces', a, 'state.json'), JSON.stringify(state));
      const restored = await startServer({ ...env, PLOTLOOM_DATA_DIR: restoreData });
      try {
        assert.equal((await restored.json(`/api/workspaces/${a}/proposals/${proposal.id}`)).status, 'resolved');
        assert.equal((await restored.json(`/api/workspaces/${a}/document/read`, 'POST', { path })).content, (await read()).content);
      } finally { await restored.close(); }
    });
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
