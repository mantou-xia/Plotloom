import { useId, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { SidebarContent, type SidebarContentProps } from './content.tsx';
import './section.css';

export interface SidebarSectionProps extends SidebarContentProps {
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** 分类级操作，与展开按钮并列，不触发分类折叠。 */
  actions?: ReactNode;
  /** 可容纳多个 SidebarGroup，也可直接放置对话条目；内容由业务选择。 */
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 外层分类统一控制整类内容显隐；保留子树，使内部各分组的展开状态不因分类收起而丢失。 */
export function SidebarSection({ label, expanded, onExpandedChange, actions, children, contentState, emptyText, errorText, disabled,
  className = '', style }: SidebarSectionProps) {
  const contentId = useId();
  return <div className={`pl-sidebar-section ${className}`} style={style}>
    <div className="pl-sidebar-section__header" data-disabled={disabled || undefined}>
      <Button className="pl-sidebar-section__toggle" variant="ghost" disabled={disabled} title={label}
        aria-expanded={expanded} aria-controls={contentId} onClick={() => onExpandedChange(!expanded)}>
        <span className="pl-sidebar-section__label">{label}</span>
        <ChevronRight className="pl-sidebar-section__chevron" size={16} aria-hidden="true" />
      </Button>
      {actions ? <div className="pl-sidebar-section__actions">{actions}</div> : null}
    </div>
    {/* 原生 hidden 同时隐藏内容并退出键盘导航；分类内部不创建第二个滚动区域。 */}
    <div id={contentId} className="pl-sidebar-section__content" hidden={!expanded}>
      <SidebarContent contentState={contentState} emptyText={emptyText} errorText={errorText}>{children}</SidebarContent>
    </div>
  </div>;
}
