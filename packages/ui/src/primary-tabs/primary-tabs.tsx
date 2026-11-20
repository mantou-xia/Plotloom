import type { CSSProperties, ReactNode } from 'react';
import { Tabs } from 'deep-agent-base-ui/tabs';
import './primary-tabs.css';

export interface PrimaryTabsProps {
  label: string;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 一级内容导航：基础库关联标签与面板并管理键盘；数据和选中值由应用维护。 */
export function PrimaryTabs({ label, options, value, onValueChange, disabled, children, className = '', style }: PrimaryTabsProps) {
  return <Tabs.Root value={value} onValueChange={next => { if (typeof next === 'string') onValueChange(next); }}
    className={`pl-primary-tabs ${className}`} style={style}>
    <div className="pl-primary-tabs__scroll">
      <Tabs.List aria-label={label} activateOnFocus className="pl-primary-tabs__list" onKeyDown={event => {
        // 基础库允许方向键聚焦禁用 Tab；一级导航沿用项目约定，只在可用项之间循环。
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.preventBaseUIHandler();
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([aria-disabled="true"])'));
        if (!tabs.length) return;
        const index = tabs.indexOf(event.target as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
      }}>
        {options.map(option => <Tabs.Tab key={option.value} value={option.value} disabled={disabled || option.disabled}
          className="pl-primary-tabs__tab">{option.label}</Tabs.Tab>)}
        <Tabs.Indicator className="pl-primary-tabs__indicator" />
      </Tabs.List>
    </div>
    {children}
  </Tabs.Root>;
}

export interface PrimaryTabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

/** 面板内容由页面组合；仅挂载当前面板，避免隐藏内容参与布局或焦点导航。 */
export function PrimaryTabPanel({ value, children, className = '' }: PrimaryTabPanelProps) {
  return <Tabs.Panel value={value} className={`pl-primary-tabs__panel ${className}`}>{children}</Tabs.Panel>;
}
