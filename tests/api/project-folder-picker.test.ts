import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { registerProjectRoutes } from '../../apps/server/src/routes/projects.ts';

const fastify = createRequire(new URL('../../apps/server/package.json', import.meta.url))('fastify');

/** 使用真实 HTTP 连接验证断连生命周期；系统对话框本身由 Windows 实机验收覆盖。 */
test('文件夹选择返回路径/取消，HTTP 断连与服务关闭通知选择器清理', async () => {
  let mode: 'selected' | 'cancelled' | 'pending' = 'selected';
  let signal: AbortSignal | undefined;
  let started: () => void = () => {};
  let closed = false;
  const app = fastify();
  const unused = async (): Promise<never> => { throw new Error('选择器测试不应调用项目操作'); };
  registerProjectRoutes(app, { list: async () => [], create: unused, update: unused, get: unused }, {
    select: async nextSignal => {
      signal = nextSignal; started();
      if (mode === 'selected') return { path: 'D:\\项目' };
      if (mode === 'cancelled') return { path: null };
      return new Promise(resolve => nextSignal.addEventListener('abort', () => resolve({ path: null }), { once: true }));
    },
    close: () => { closed = true; },
  }, unused);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const select = (requestSignal?: AbortSignal) => fetch(address + '/api/projects/select-folder', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: requestSignal,
  });
  try {
    assert.deepEqual(await (await select()).json(), { path: 'D:\\项目' });
    assert.equal(signal?.aborted, false);
    mode = 'cancelled';
    assert.deepEqual(await (await select()).json(), { path: null });
    assert.equal(signal?.aborted, false);
    mode = 'pending';
    const entered = new Promise<void>(resolve => { started = resolve; });
    const controller = new AbortController();
    const request = select(controller.signal);
    const rejected = assert.rejects(request, { name: 'AbortError' });
    await entered;
    const aborted = new Promise<void>(resolve => signal!.addEventListener('abort', () => resolve(), { once: true }));
    controller.abort(); await rejected;
    await Promise.race([aborted, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('选择器未收到断连')), 2000); timer.unref(); })]);
    assert.equal(signal?.aborted, true);
  } finally { await app.close(); }
  assert.equal(closed, true);
});
