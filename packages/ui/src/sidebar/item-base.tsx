import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../button/button.tsx';
import './item-base.css';

export interface SidebarEntryProps {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  actions?: ReactNode;
  onClick?: () => void;
  rowHeight?: number;
  gap?: number;
  iconSize?: number;
  indicatorWidth?: number;
  indicatorHeight?: number;
  className?: string;
  style?: CSSProperties;
}

/** 内部共享行机制；各公开 item 具有独立样式入口，避免复制选中与操作隔离逻辑。 */
export function SidebarEntry({ label, icon, active = false, disabled = false, actions, onClick,
  rowHeight = 38, gap = 8, iconSize = 16, indicatorWidth = 4, indicatorHeight = 18,
  className = '', style }: SidebarEntryProps) {
  return <div className={`pl-sidebar-entry ${className}`} data-active={active || undefined} data-disabled={disabled || undefined}
    style={{ '--pl-entry-height': `${rowHeight}px`, '--pl-entry-gap': `${gap}px`, '--pl-entry-icon': `${iconSize}px`,
      '--pl-entry-indicator-width': `${indicatorWidth}px`, '--pl-entry-indicator-height': `${indicatorHeight}px`, ...style } as CSSProperties}>
    <Button className="pl-sidebar-entry__button" variant="ghost" disabled={disabled} title={label}
      aria-current={active ? 'page' : undefined} startIcon={icon} onClick={onClick}>
      <span className="pl-sidebar-entry__label">{label}</span>
    </Button>
    {actions ? <div className="pl-sidebar-entry__actions">{actions}</div> : null}
  </div>;
}
