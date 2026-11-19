import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToastStore } from '../../packages/ui/src/toast/store.ts';

test('重复提示合并并计数，独立异步任务不按 loading 文案合并', () => {
  const store = createToastStore();
  const id = store.error('请求失败');
  assert.equal(store.error('请求失败'), id);
  assert.equal(store.getSnapshot()[0].count, 2);
  assert.notEqual(store.loading('正在保存'), store.loading('正在保存'));
});

test('排队保持先进先出，退出占位到动画结束，取消队列项目不会闪现', () => {
  const store = createToastStore();
  const ids = Array.from({ length: 6 }, (_, index) => store.info(`消息 ${index}`));
  store.dismiss(ids[0]);
  assert.equal(store.getSnapshot()[0].exiting, true);
  assert.deepEqual(store.getSnapshot().slice(0, 3).map(item => item.id), ids.slice(0, 3));
  store.remove(ids[0]);
  assert.deepEqual(store.getSnapshot().slice(0, 3).map(item => item.id), ids.slice(1, 4));
  store.dismiss(ids[5]);
  assert.ok(!store.getSnapshot().some(item => item.id === ids[5]));
});

test('异步成功原位更新，返回业务结果，不额外创建第二条提示', async () => {
  const store = createToastStore();
  let resolve!: (value: number) => void;
  const task = store.promise(() => new Promise<number>(done => { resolve = done; }), {
    loading: '正在保存', success: value => `已保存 ${value} 条`,
  });
  const id = store.getSnapshot()[0].id;
  assert.equal(store.getSnapshot()[0].duration, 0);
  resolve(2);
  assert.equal(await task, 2);
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.getSnapshot()[0].id, id);
  assert.equal(store.getSnapshot()[0].message, '已保存 2 条');
  assert.equal(store.getSnapshot()[0].kind, 'success');
});

test('同步抛错和异步拒绝均更新原消息，并保持错误可由业务捕获', async () => {
  const store = createToastStore();
  const failure = new Error('服务不可用');
  await assert.rejects(store.promise(() => { throw failure; }, { loading: '提交中', success: '完成' }), failure);
  assert.equal(store.getSnapshot()[0].kind, 'error');
  await assert.rejects(store.promise(async () => { throw failure; }, { loading: '提交中', success: '完成', error: '提交失败' }), failure);
  assert.equal(store.getSnapshot()[1].message, '提交失败');
});

test('主动取消不报告失败，手动关闭的异步任务完成后不重新弹出', async () => {
  const store = createToastStore();
  await assert.rejects(store.promise(async () => { throw new DOMException('取消', 'AbortError'); }, { loading: '读取中', success: '完成' }));
  assert.equal(store.getSnapshot()[0].exiting, true);
  assert.equal(store.getSnapshot()[0].kind, 'loading');
  store.clear();
  let resolve!: () => void;
  const task = store.promise(() => new Promise<void>(done => { resolve = done; }), { loading: '读取中', success: '完成' });
  const id = store.getSnapshot()[0].id;
  store.dismiss(id); store.remove(id); resolve(); await task;
  assert.equal(store.getSnapshot().length, 0);
});

test('实例互不污染，稳定 id 更新与订阅清理正常', () => {
  const store = createToastStore();
  const other = createToastStore();
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  store.loading('提交中', { id: 'save' });
  store.success('提交完成', { id: 'save' });
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(other.getSnapshot().length, 0);
  unsubscribe(); store.clear();
  assert.equal(changes, 2);
});
