import { useState, type ReactNode, type CSSProperties } from 'react';
import { DisclosureTrigger } from './disclosure-trigger.tsx';

/** 原生折叠区域保留子表单值和键盘交互，校验隐藏字段时先展开以便聚焦。 */
export function Disclosure({ label, children, defaultOpen = false, style }: {
  label: string; children: ReactNode; defaultOpen?: boolean; style?: CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <details className="pl-disclosure" open={open} style={style}
    onToggle={event => setOpen(event.currentTarget.open)} onInvalidCapture={event => { event.currentTarget.open = true; }}>
    <DisclosureTrigger as="summary" open={open}>{label}</DisclosureTrigger>
    <div className="pl-disclosure__body">{children}</div>
  </details>;
}
