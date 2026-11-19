import { useEffect, useRef, useState } from 'react';
import { Button } from '../button/button.tsx';
import { ToastViewport } from '../toast/toast.tsx';
import { createToastStore, type ToastKind } from '../toast/store.ts';

/** 独立实例隔离调试消息；离开示例时清理模拟任务，避免污染下一次预览。 */
export function ToastExample({ state }: { state: string }) {
  const [store] = useState(createToastStore);
  const [message, setMessage] = useState('操作已完成');
  const [kind, setKind] = useState<ToastKind>('success');
  const [duration, setDuration] = useState(3500);
  const sequence = useRef(0);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  useEffect(() => {
    if (state === 'queue') for (let i = 1; i <= 6; i++) store.info(`队列提示 ${i}`);
    else store.success('操作已完成');
    return () => { for (const [timer, cancel] of timers.current) { clearTimeout(timer); cancel(); } timers.current.clear(); store.clear(); };
  }, [store, state]);
  function simulate(fail: boolean) {
    void store.promise(() => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { timers.current.delete(timer); if (fail) reject(new Error('示例请求失败，请重试。')); else resolve(); }, 1200);
      timers.current.set(timer, () => reject(new DOMException('示例已卸载', 'AbortError')));
    }), { loading: '正在提交示例请求…', success: '示例请求已完成' }).catch(() => {});
  }
  return <>
    <ToastViewport store={store} />
    <div className="pl-toast-example">
      <label>提示内容<input value={message} onChange={event => setMessage(event.target.value)} /></label>
      <label>提示类型<select value={kind} onChange={event => setKind(event.target.value as ToastKind)}>
        <option value="success">成功</option><option value="error">失败</option><option value="info">信息</option><option value="loading">处理中</option>
      </select></label>
      <label>显示时长（毫秒，0 为不自动关闭）<input type="number" min="0" step="500" value={duration} onChange={event => setDuration(Math.max(0, event.target.valueAsNumber || 0))} /></label>
      <Button onClick={() => store[kind](message, { duration: kind === 'loading' ? 0 : duration })}>显示提示</Button>
      <Button variant="secondary" onClick={() => { for (let i = 0; i < 6; i++) store.info(`并发提示 ${++sequence.current}`, { duration }); }}>同时产生 6 条</Button>
      <Button variant="secondary" onClick={() => { for (let i = 0; i < 5; i++) store.error('同一请求失败'); }}>重复错误 5 次</Button>
      <Button variant="secondary" onClick={() => simulate(false)}>模拟请求成功</Button>
      <Button variant="secondary" onClick={() => simulate(true)}>模拟请求失败</Button>
      <Button variant="ghost" onClick={() => store.clear()}>清空提示</Button>
      <p>最多显示 3 条，其他排队；悬停或聚焦暂停倒计时。重复消息合并，异步操作原位更新。</p>
    </div>
  </>;
}
