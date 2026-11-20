import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import './disclosure.css';

type TriggerProps = { open: boolean; children: ReactNode } & (
  { as: 'summary' } | ({ as?: 'button' } & ComponentPropsWithoutRef<'button'>)
);

/** 共享文字、箭头和反馈样式，保留原生 summary 或外部控制的按钮语义。 */
export function DisclosureTrigger(props: TriggerProps) {
  const Chevron = props.open ? ChevronDown : ChevronRight;
  const content = <>{props.children}<Chevron size={14} aria-hidden="true" /></>;
  if (props.as === 'summary') return <summary className="pl-disclosure-trigger">{content}</summary>;
  const { as: _as, open, children: _children, className = '', ...button } = props;
  return <button {...button} type="button" className={`pl-disclosure-trigger ${className}`} aria-expanded={open}>{content}</button>;
}
