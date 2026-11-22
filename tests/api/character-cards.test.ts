import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from './client.ts';

test('五栏角色卡阶段按章节筛选并保留历史', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-cards-'));
  const data = join(root, 'data'); const book = join(root, 'book');
  await mkdir(data); await mkdir(book);
  const server = await startServer({ PLOTLOOM_DATA_DIR: data, PLOTLOOM_API_KEY: '', PLOTLOOM_PROVIDER: '', PLOTLOOM_MODEL: '' });
  try {
    const workspace = await server.json<{ id: string }>('/api/workspaces', 'POST', { title: '测试书', root: book }, 201);
    const base = `/api/workspaces/${workspace.id}/character-cards`;
    const first = await server.json<any>(base, 'POST', { character: '林舟', chapter: 1, note: '初始', content: '## 性格特点\n### 表征\n随和\n### 内在\n谨慎\n\n## 愿景\n### 明示\n安全\n### 潜意识\n保护妹妹' }, 201);
    const second = await server.json<any>(base, 'POST', { character: '林舟', chapter: 4, note: '黑化、失去双亲', content: '## 性格特点\n### 表征\n冷硬\n### 内在\n悲恸\n\n## 愿景\n### 明示\n复仇\n### 潜意识\n求得补偿' }, 201);
    const beforeChange = await server.json<any>(`${base}?chapter=3`);
    assert.deepEqual(beforeChange.applicable.map((card: any) => [card.character, card.chapter, card.note]), [['林舟', 1, '初始']]);
    const afterChange = await server.json<any>(`${base}?chapter=4`);
    assert.deepEqual(afterChange.applicable.map((card: any) => [card.character, card.chapter, card.note]), [['林舟', 4, '黑化、失去双亲']]);
    assert.deepEqual(afterChange.cards.map((card: any) => card.path), [first.path, second.path].sort());
    const read = await server.json<any>(`${base}/read`, 'POST', { path: second.path });
    assert.equal(read.version, second.version);
    assert(Date.parse(first.createdAt) < Date.parse(second.createdAt));
    assert.equal(read.createdAt, second.createdAt);
    assert.match(read.content, /### 表征/);
    assert.match(read.content, /### 潜意识/);
    await server.json(`/api/workspaces/${workspace.id}/document`, 'PUT', {
      path: first.path, content: first.content + '\n补充设定', baseVersion: first.version,
    });
    const updated = await server.json(`${base}/read`, 'POST', { path: first.path });
    assert.equal(updated.createdAt, first.createdAt);
    assert.notEqual(updated.version, first.version);
    await server.json(`${base}/read`, 'POST', { path: '角色卡/不存在.md' }, 404);
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
