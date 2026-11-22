import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startServer } from './client.ts';

test('单章 TXT 取最新磁盘稿，保留标题文字、对白分行和字面标点', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-export-'));
  const book = join(root, 'book');
  await mkdir(book);
  const api = await startServer({ PLOTLOOM_DATA_DIR: join(root, 'data') });
  try {
    const workspace = await api.json('/api/workspaces', 'POST', { title: '归舟', root: book }, 201);
    const base = '/api/workspaces/' + workspace.id;
    const path = '正文章节/第四章 归舟.md';
    const save = (content: string, baseVersion: string | null) => api.json(base + '/document', 'PUT', { path, content, baseVersion });
    const download = (name = path, status = 200) => api.json(base + '/chapter/export-txt', 'POST', { path: name }, status);
    await download(path, 404);
    await download('大纲/第四章.md', 400);
    await download('正文章节/../世界观.md', 400);
    const initial = await save('# 旧标题\n\n旧对白。', null);
    await api.json(base + '/finalize', 'POST', { path, baseVersion: initial.version });
    await api.json(base + '/proposals', 'POST', { path, baseVersion: initial.version, content: '未采纳的改稿。' }, 201);
    const source = '\uFEFF# 第四章 **归舟**\r\n\r\n“我改主意了。”\r\n“当真？”\r\n\r\n\r\n他指向[码头](https://example.org)。2 * 3 = 6。';
    const current = await save(source, initial.version);
    assert.deepEqual(await download(), { filename: '第四章 归舟.txt', version: current.version,
      content: '第四章 归舟\r\n\r\n“我改主意了。”\r\n“当真？”\r\n\r\n\r\n他指向码头。2 * 3 = 6。' });
    assert.equal((await api.json(base + '/document/read', 'POST', { path })).content, source);
    const noTitle = '　　“潮来了。”\n  她回头。\n\n他答：\\*是\\*。  \n她走近。😀\n';
    await save(noTitle, current.version);
    assert.equal((await download()).content, '　　“潮来了。”\n  她回头。\n\n他答：*是*。\n她走近。😀\n');
  } finally { await api.close(); await rm(root, { recursive: true, force: true }); }
});
