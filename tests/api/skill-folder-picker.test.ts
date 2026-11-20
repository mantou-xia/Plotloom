import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { WorkspaceError } from '../../packages/domain/src/index.ts';

/** 真正 HTTP 断连验证原生选择端口的清理；不替换技能业务与持久化。 */
test('技能选择取消、选择器错误、并发和断连均不新增技能', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-skill-picker-'));
  let mode = 'cancelled';
  let signal: AbortSignal | undefined;
  let complete: (() => void) | undefined;
  let started: () => void = () => {};
  let closed = false;
  const app = await buildServer({ dataDir: directory }, { folderPicker: {
    select: async next => {
      if (complete) throw new WorkspaceError('FOLDER_PICKER_BUSY', '已有选择窗口', 409);
      signal = next;
      if (mode === 'cancelled') return { path: null };
      if (mode === 'failed') throw new WorkspaceError('FOLDER_PICKER_FAILED', '打开失败', 500);
      if (mode === 'unavailable') throw new WorkspaceError('FOLDER_PICKER_UNAVAILABLE', '不支持', 501);
      return new Promise(resolve => {
        complete = () => { complete = undefined; resolve({ path: null }); };
        next.addEventListener('abort', () => complete?.(), { once: true });
        started();
      });
    },
    close() { closed = true; complete?.(); },
  } });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const send = (requestSignal?: AbortSignal) => fetch(address + '/api/skills/import-folder', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: requestSignal,
  });
  try {
    const before = await (await fetch(address + '/api/skills')).json();
    assert.deepEqual(await (await send()).json(), { skill: null });
    for (const [value, status, code] of [['failed', 500, 'FOLDER_PICKER_FAILED'], ['unavailable', 501, 'FOLDER_PICKER_UNAVAILABLE']] as const) {
      mode = value;
      const response = await send();
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
    mode = 'pending';
    const entered = new Promise<void>(resolve => { started = resolve; });
    const controller = new AbortController();
    const pending = send(controller.signal);
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await entered;
    const busy = await send(); assert.equal(busy.status, 409);
    // 项目与技能共享选择端口，跨模块并发也被拒绝。
    const project = await fetch(address + '/api/projects/select-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(project.status, 409);
    const aborted = new Promise<void>(resolve => signal!.addEventListener('abort', () => resolve(), { once: true }));
    controller.abort(); await rejected;
    await Promise.race([aborted, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('断连未通知选择器')), 2000); timer.unref(); })]);
    assert.equal(signal?.aborted, true);
    assert.deepEqual(await (await fetch(address + '/api/skills')).json(), before);
    // 服务关闭时也应完成挂起选择，避免等待窗口导致关闭卡住。
    const enteredClose = new Promise<void>(resolve => { started = resolve; });
    const closing = send(); await enteredClose;
    await app.close(); await closing;
    assert.equal(closed, true);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
