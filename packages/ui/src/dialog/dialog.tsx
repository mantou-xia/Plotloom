import { useLayoutEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './dialog.css';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 原生模态层负责焦点约束、背景不可交互与关闭后焦点恢复；业务内容和提交均由调用方管理。 */
export function Dialog({ open, onOpenChange, title, description, children, footer, className = '', style }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
    // 条件卸载也先关闭原生模态层，才能在节点移除前恢复触发按钮的焦点。
    return () => { if (node.open) node.close(); };
  }, [open]);
  return <dialog ref={dialog} className={`pl-dialog ${className}`} style={style} aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); onOpenChange(false); }}
    onClose={event => { if (open && !event.currentTarget.open) onOpenChange(false); }}
    onClick={event => {
      // 遮罩事件会落到 dialog；只关闭真正位于面板外的点击，内部空白不算取消。
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onOpenChange(false);
    }}>
    <header className="pl-dialog__header">
      <div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
      <Button variant="ghost" size="sm" iconOnly tooltip aria-label="关闭弹窗" onClick={() => onOpenChange(false)}><X /></Button>
    </header>
    <ScrollBox className="pl-dialog__body">{children}</ScrollBox>
    {footer ? <footer className="pl-dialog__footer">{footer}</footer> : null}
  </dialog>;
}
