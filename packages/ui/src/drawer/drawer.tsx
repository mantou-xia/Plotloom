import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './drawer.css';

/** 保持节点挂载，让关闭过渡走完；原生模态处理背景隔离和焦点归还。 */
export function Drawer({ open, onOpenChange, title, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
}) {
  const node = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = node.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={node} className="pl-drawer" aria-label={title}
    onCancel={event => { event.preventDefault(); onOpenChange(false); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onOpenChange(false);
    }}>
    <header className="pl-drawer__header"><h2>{title}</h2><Button variant="ghost" iconOnly tooltip aria-label="关闭抽屉" onClick={() => onOpenChange(false)}><X /></Button></header>
    <ScrollBox className="pl-drawer__body">{children}</ScrollBox>
  </dialog>;
}
