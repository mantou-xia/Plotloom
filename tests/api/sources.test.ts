import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startServer, collect, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';
import { SOURCE_LIMITS } from '../../packages/contracts/src/sources.ts';

/** 三种真实编码图像通过实际上传、Pi SDK 及模型协议，避免仅凭扩展名验证图片链路。 */
function images() {
  const { PhotonImage } = createRequire(new URL('../../packages/application/package.json', import.meta.url))('@silvia-odwyer/photon-node');
  const image = new PhotonImage(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), 2, 2);
  try { return [
    { name: '线索.png', mimeType: 'image/png', data: Buffer.from(image.get_bytes()).toString('base64') },
    { name: '线索.jpg', mimeType: 'image/jpeg', data: Buffer.from(image.get_bytes_jpeg(90)).toString('base64') },
    { name: '线索.webp', mimeType: 'image/webp', data: Buffer.from(image.get_bytes_webp()).toString('base64') },
  ]; } finally { image.free(); }
}

test('聊天附件与指定版本资料的独立 HTTP / SSE 验收', { timeout: 120000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-sources-'));
  const fixture = await createModelFixture();
  const models = join(directory, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: ['vision', 'plain'].map(id => ({ id, name: id, reasoning: false, input: id === 'vision' ? ['text', 'image'] : ['text'],
      contextWindow: 128000, maxTokens: 2048, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })) } } }));
  const env = { PLOTLOOM_DATA_DIR: join(directory, 'data'), PLOTLOOM_MODELS_PATH: models,
    PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'vision', PLOTLOOM_API_KEY: TEST_KEY };
  let server = await startServer(env);
  const json = (...args: Parameters<typeof server.json>) => server.json(...args);
  const create = () => json('/api/sessions', 'POST', { projectPath: directory }, 201);
  const base = (id: string) => `/api/sessions/${id}`;
  const upload = (id: string, file: unknown, status = 201) => json(`${base(id)}/attachments`, 'POST', file, status);
  const filePath = (id: string, file: { id: string }) => `${base(id)}/attachments/${file.id}`;
  const send = async (id: string, body: unknown) => collect(await server.request(`${base(id)}/messages`, 'POST', body));
  const history = async (id: string) => (await json(base(id))).messages;
  const restart = async (overrides = {}) => { await server.close(); server = await startServer({ ...env, ...overrides }); };
  const textFile = { name: '线索.txt', mimeType: 'text/plain', data: Buffer.from('\uFEFF灯塔-附件731\r\n😀').toString('base64') };
  const pictures = images();
  const a = await create(); const b = await create();
  let uploaded: any[] = [];
  try {
    await t.test('五种类型上传、列表、原文读取、跨重启和未发送移除', async () => {
      assert.deepEqual((await json(`${base(a.id)}/attachments`)).attachments, []);
      const files = [...pictures, textFile, { ...textFile, name: '笔记.md', mimeType: 'text/markdown' }];
      const count = fixture.requests.length;
      for (const file of files) {
        const stored = await upload(a.id, file); uploaded.push(stored);
        assert.equal(stored.size, Buffer.from(file.data, 'base64').length);
        assert.equal(stored.name, file.name); assert.equal(stored.sessionId, a.id); assert.equal(stored.data, undefined);
        assert.equal((await json(filePath(a.id, stored))).data, file.data);
      }
      assert.equal(fixture.requests.length, count);
      await restart();
      assert.deepEqual((await json(`${base(a.id)}/attachments`)).attachments, uploaded);
      const remove = await upload(a.id, textFile);
      assert.deepEqual(await json(filePath(a.id, remove), 'DELETE'), { id: remove.id, deleted: true });
      await json(filePath(a.id, remove), 'GET', undefined, 404);
      await json(filePath(a.id, remove), 'DELETE', undefined, 404);
    });
    await t.test('类型、编码、大小、空文件和非法参数在落盘前拒绝', async () => {
      const before = (await json(`${base(a.id)}/attachments`)).attachments;
      await upload(a.id, { ...textFile, name: '../线索.txt' }, 400);
      await upload(a.id, { ...textFile, data: '' }, 400);
      await upload(a.id, { ...textFile, data: 'aGVsbG8=!not-base64' }, 400);
      await upload(a.id, { ...textFile, name: '资料.pdf' }, 422);
      await upload(a.id, { ...pictures[0], mimeType: 'image/jpeg', name: '假.jpg' }, 422);
      await upload(a.id, { ...pictures[0], data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64') }, 422);
      assert.equal((await upload(a.id, { ...textFile, data: Buffer.from([255, 254]).toString('base64') }, 422)).error.code, 'ENCODING_UNSUPPORTED');
      await upload(a.id, { ...textFile, data: Buffer.from([0, 1, 2]).toString('base64') }, 422);
      assert.equal((await upload(a.id, { ...textFile, data: Buffer.alloc(SOURCE_LIMITS.textBytes + 1, 65).toString('base64') }, 422)).error.code, 'ATTACHMENT_TOO_LARGE');
      assert.equal((await upload(a.id, { ...pictures[0], data: Buffer.alloc(SOURCE_LIMITS.imageBytes + 1).toString('base64') }, 422)).error.code, 'ATTACHMENT_TOO_LARGE');
      await upload('unknown', textFile, 404);
      assert.deepEqual((await json(`${base(a.id)}/attachments`)).attachments, before);
    });
    await t.test('跨会话附件、纯文本模型和无效消息不进入 SSE 或历史', async () => {
      for (const method of ['GET', 'DELETE']) {
        assert.equal((await json(filePath(b.id, uploaded[0]), method, undefined, 404)).error.code, 'ATTACHMENT_NOT_FOUND');
      }
      await json(`${base(b.id)}/messages`, 'POST', { attachmentIds: [uploaded[0].id] }, 404);
      await json(`${base(a.id)}/config`, 'PUT', { provider: 'test', model: 'plain' });
      const count = fixture.requests.length;
      assert.equal((await json(`${base(a.id)}/messages`, 'POST', { attachmentIds: [uploaded[0].id] }, 422)).error.code, 'MODEL_IMAGE_UNSUPPORTED');
      for (const body of [{}, { text: ' ' }, { attachmentIds: [] }, { references: [] }, { attachmentIds: [uploaded[0].id, uploaded[0].id] }, { attachmentIds: Array(11).fill('unknown') }]) {
        await json(`${base(a.id)}/messages`, 'POST', body, 400);
      }
      assert.equal(fixture.requests.length, count); assert.deepEqual(await history(a.id), []);
      await json(`${base(a.id)}/config`, 'PUT', { provider: 'test', model: 'vision' });
    });
    await t.test('纯图片、纯文本附件和混合输入抵达模型，历史不显示拼接或 base64', async () => {
      for (const file of uploaded.slice(0, 3)) {
        const result = await send(a.id, { attachmentIds: [file.id] }); assertFinal(result, 'completed');
        const request = fixture.requests.at(-1);
        assert(request.messages.at(-2)?.role !== 'tool');
        const user = request.messages.findLast((message: any) => message.role === 'user');
        assert(user.content.some((part: any) => part.type === 'image_url' && part.image_url.url.startsWith('data:image/')));
        const actual = (await history(a.id)).findLast((message: any) => message.role === 'user');
        assert.deepEqual(actual.content, []); assert.deepEqual(actual.attachments, [file]);
        assert.equal(actual.id, result[0].type === 'accepted' && result[0].messageId);
      }
      assertFinal(await send(a.id, { attachmentIds: [uploaded[3].id] }), 'completed');
      let request = fixture.requests.at(-1);
      assert.match(JSON.stringify(request.messages.findLast((m: any) => m.role === 'user')), /灯塔-附件731/);
      assertFinal(await send(a.id, { text: '只保留用户原文', attachmentIds: [uploaded[0].id, uploaded[4].id] }), 'completed');
      const snapshot = await history(a.id);
      const last = snapshot.findLast((m: any) => m.role === 'user');
      assert.deepEqual(last.content, [{ type: 'text', text: '只保留用户原文' }]);
      assert.equal(last.attachments.length, 2);
      assert.equal((await json(filePath(a.id, uploaded[0]), 'DELETE', undefined, 409)).error.code, 'ATTACHMENT_IN_USE');
      await restart(); assert.deepEqual(await history(a.id), snapshot);
      assert.equal((await json(filePath(a.id, uploaded[0]))).data, pictures[0].data);
      assertFinal(await send(a.id, { text: '继续根据上一轮资料回答' }), 'completed');
      request = fixture.requests.at(-1);
      assert(request.messages.some((m: any) => Array.isArray(m.content) && m.content.some((part: any) => part.type === 'image_url')));
    });
    await t.test('文档指定版本、选区、跨工作区显式引用及重启历史', async () => {
      const book = join(directory, 'book'); const other = join(directory, 'other'); await mkdir(book); await mkdir(other);
      const ws = await json('/api/workspaces', 'POST', { title: '书一', root: book }, 201);
      const ws2 = await json('/api/workspaces', 'POST', { title: '书二', root: other }, 201);
      const save = (workspaceId: string, content: string, baseVersion = null as string | null) => json(`/api/workspaces/${workspaceId}/document`, 'PUT', { path: '资料.md', content, baseVersion });
      const old = await save(ws.id, '林舟😀\n第一版线索');
      const latest = await save(ws.id, '第二版已修改', old.version);
      const otherDoc = await save(ws2.id, '另一部小说');
      const reference = { workspaceId: ws.id, path: old.path, version: old.version };
      assertFinal(await send(b.id, { references: [reference] }), 'completed');
      let actual = (await history(b.id)).findLast((m: any) => m.role === 'user');
      assert.deepEqual(actual.content, []); assert.equal(actual.references[0].content, old.content);
      const selected = { ...reference, selection: { start: 0, end: 4, text: '林舟😀' } };
      assertFinal(await send(b.id, { text: '对比', references: [selected, { workspaceId: ws2.id, path: otherDoc.path, version: otherDoc.version }] }), 'completed');
      actual = (await history(b.id)).findLast((m: any) => m.role === 'user');
      assert.equal(actual.references[0].content, '林舟😀'); assert.equal(actual.references[1].content, otherDoc.content);
      assert.equal((await json(`${base(b.id)}/tools`)).tools.some((tool: any) => tool.name === 'propose_change'), false);
      const count = fixture.requests.length;
      await json(`${base(b.id)}/messages`, 'POST', { references: [{ ...reference, version: '0'.repeat(64) }] }, 404);
      await json(`${base(b.id)}/messages`, 'POST', { references: [{ ...reference, path: '../资料.md' }] }, 400);
      await json(`${base(b.id)}/messages`, 'POST', { references: [{ ...selected, selection: { start: 0, end: 3, text: '林舟\ud83d' } }] }, 400);
      await json(`${base(b.id)}/messages`, 'POST', { references: [reference, reference] }, 400);
      const novel = await json(`/api/workspaces/${ws.id}/sessions`, 'POST', {}, 201);
      assert.equal((await json(`${base(novel.id)}/messages`, 'POST', { references: [{ workspaceId: ws2.id, path: otherDoc.path, version: otherDoc.version }] }, 403)).error.code, 'REFERENCE_FORBIDDEN');
      // 小说聊天继续遵守创作用例的当前版本校验，项目聊天才可明确引用历史稿。
      await json(`${base(novel.id)}/messages`, 'POST', { references: [reference] }, 409);
      assert.equal(fixture.requests.length, count);
      const snapshot = await history(b.id); await restart(); assert.deepEqual(await history(b.id), snapshot);
      assert.equal((await json(`/api/workspaces/${ws.id}/document/read`, 'POST', { path: old.path })).version, latest.version);
    });
    await t.test('附件总量和发送/删除竞争在真实接口下保持一致', async () => {
      const largeImage = Buffer.alloc(8 * 1024 * 1024);
      Buffer.from(pictures[0].data, 'base64').copy(largeImage);
      const largeFiles = [];
      for (let i = 0; i < 3; i++) largeFiles.push(await upload(b.id, { ...pictures[0], data: largeImage.toString('base64') }));
      assert.equal((await json(`${base(b.id)}/messages`, 'POST', { attachmentIds: largeFiles.map(file => file.id) }, 422)).error.code, 'MESSAGE_SOURCES_TOO_LARGE');
      for (const file of largeFiles) await json(filePath(b.id, file), 'DELETE');
      const chat = await create();
      const file = await upload(chat.id, pictures[0]);
      const [sending, removing] = await Promise.all([
        server.request(`${base(chat.id)}/messages`, 'POST', { attachmentIds: [file.id] }),
        server.request(filePath(chat.id, file), 'DELETE'),
      ]);
      if (sending.status === 200) {
        assertFinal(await collect(sending), 'completed');
        assert.equal(removing.status, 409);
        await json(filePath(chat.id, file));
      } else {
        // 删除占用同一会话锁时发送立即返回忙；删除已结束后才返回附件不存在。
        assert([404, 409].includes(sending.status)); assert.equal(removing.status, 200);
        if (sending.status === 409) assert.equal((await sending.json() as any).error.code, 'SESSION_BUSY');
        assert.deepEqual(await history(chat.id), []);
      }
    });
    await t.test('引用预算、生成中删除冲突、停止与失败保留来源', async () => {
      const large = await upload(b.id, { ...textFile, data: Buffer.from('字'.repeat(100001)).toString('base64') });
      assert.equal((await json(`${base(b.id)}/messages`, 'POST', { attachmentIds: [large.id] }, 422)).error.code, 'MESSAGE_SOURCES_TOO_LARGE');
      await json(filePath(b.id, large), 'DELETE');
      const unused = await upload(a.id, textFile);
      for await (const event of events(await server.request(`${base(a.id)}/messages`, 'POST', { text: 'WAIT:source-stop', attachmentIds: [uploaded[0].id] }))) {
        if (event.type === 'text_delta') {
          assert.equal((await json(filePath(a.id, unused), 'DELETE', undefined, 409)).error.code, 'SESSION_BUSY');
          await json(`${base(a.id)}/stop`, 'POST');
        }
        if (event.type === 'aborted') assert.equal((await history(a.id)).findLast((m: any) => m.role === 'user').attachments[0].id, uploaded[0].id);
      }
      await json(filePath(a.id, unused), 'DELETE');
      assertFinal(await send(a.id, { text: 'FAIL', attachmentIds: [uploaded[0].id] }), 'failed');
      const last = (await history(a.id)).findLast((m: any) => m.role === 'user');
      assert.equal(last.outcome, 'failed'); assert.equal(last.attachments[0].id, uploaded[0].id);
      await restart({ PLOTLOOM_API_KEY: '' });
      assert.equal((await json(filePath(a.id, uploaded[0]))).data, pictures[0].data);
      const offline = await upload(a.id, textFile); await json(filePath(a.id, offline), 'DELETE');
    });
    assert.deepEqual(fixture.errors, []);
  } finally {
    await server.close(); await fixture.close(); await rm(directory, { recursive: true, force: true });
  }
});
