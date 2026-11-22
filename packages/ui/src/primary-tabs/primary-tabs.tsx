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
  renderList?: (list: ReactNode) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 一级内容导航：基础库关联标签与面板并管理键盘；数据和选中值由应用维护。 */
export function PrimaryTabs({ label, options, value, onValueChange, disabled, children, renderList, className = '', style }: PrimaryTabsProps) {
  const list = <div className="pl-primary-tabs__scroll">
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
    </div>;
  return <Tabs.Root value={value} onValueChange={next => { if (typeof next === 'string') onValueChange(next); }}
    className={`pl-primary-tabs ${className}`} style={style}>
    {renderList ? renderList(list) : list}
    {children}
  </Tabs.Root>;
}

export interface PrimaryTabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
  keepMounted?: boolean;
}

/** 编辑器可保留输入节点，切换后恢复光标和滚动位置。 */
export function PrimaryTabPanel({ value, children, className = '', keepMounted }: PrimaryTabPanelProps) {
  return <Tabs.Panel value={value} keepMounted={keepMounted} className={`pl-primary-tabs__panel ${className}`}>{children}</Tabs.Panel>;
}
