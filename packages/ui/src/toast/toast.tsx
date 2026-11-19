import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { toast, type ToastItem, type ToastStore } from './store.ts';
import './toast.css';

export interface ToastViewportProps { store?: ToastStore }

/** 一次最多显示三条；原生模态弹窗打开时提示随它进入顶层，避免被遮挡或变为不可交互。 */
export function ToastViewport({ store = toast }: ToastViewportProps) {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [modal, setModal] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const syncModal = () => setModal(document.querySelector<HTMLDialogElement>('dialog:modal'));
    syncModal();
    document.addEventListener('toggle', syncModal, true);
    document.addEventListener('close', syncModal, true);
    return () => { document.removeEventListener('toggle', syncModal, true); document.removeEventListener('close', syncModal, true); };
  }, []);
  const content = <section className="plotloom-toasts" aria-label="操作提示">
    {items.slice(0, 3).map(item => <Toast key={item.id} item={item} store={store} />)}
    {items.length > 3 ? <span className="plotloom-toasts__queue">还有 {items.length - 3} 条提示等待展示</span> : null}
  </section>;
  return modal ? createPortal(content, modal) : content;
}

/** 可见后开始倒计时，悬停或键盘焦点停留时暂停；更新内容重新计时，卸载清理所有定时器。 */
function Toast({ item, store }: { item: ToastItem; store: ToastStore }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(item.duration);
  useEffect(() => { remaining.current = item.duration; }, [item.revision, item.duration]);
  useEffect(() => {
    if (item.exiting) {
      const timer = setTimeout(() => store.remove(item.id), 180);
      return () => clearTimeout(timer);
    }
    if (!item.duration || hovered || focused) return;
    const started = Date.now();
    const timer = setTimeout(() => store.dismiss(item.id), remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
  }, [item.id, item.revision, item.duration, item.exiting, hovered, focused, store]);
  const Icon = item.kind === 'success' ? Check : item.kind === 'error' ? CircleAlert : item.kind === 'loading' ? LoaderCircle : Info;
  return <div className="plotloom-toast-slot" data-exiting={item.exiting}>
    <div className="plotloom-toast-clip"><div className="plotloom-toast" data-kind={item.kind}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <Icon className="plotloom-toast__icon" size={18} aria-hidden="true" />
      <div className="plotloom-toast__message" role={item.kind === 'error' ? 'alert' : 'status'} aria-atomic="true">
        {item.message}{item.count > 1 ? <span className="plotloom-toast__count">（{item.count} 次）</span> : null}
      </div>
      <Button variant="ghost" size="sm" iconOnly aria-label="关闭提示" onClick={() => store.dismiss(item.id)}><X size={16} /></Button>
    </div></div>
  </div>;
}
