import { useId, type CSSProperties } from 'react';
import { SidebarGroupHeader, type SidebarGroupHeaderProps } from './group-header.tsx';
import { SidebarContent, type SidebarContentProps } from './content.tsx';
import './group.css';
export interface SidebarGroupProps extends Omit<SidebarGroupHeaderProps, 'contentId'>, SidebarContentProps {
  indent?: number;
}
/** 分组组合独立标题和内容区域；由调用方控制展开，隐藏内容退出键盘导航。 */
export function SidebarGroup({ children, contentState, emptyText, errorText, indent = 24, className = '', style, ...headerProps }: SidebarGroupProps) {
  const contentId = useId();
  return <div className={`pl-sidebar-group ${className}`} style={style}>
    <SidebarGroupHeader {...headerProps} contentId={contentId} />
    {/* 保留内容以支持双向高度过渡；收起立即阻止子项交互，视觉隐藏由 CSS 在动画结束后完成。 */}
    <div id={contentId} className="pl-sidebar-group__content" data-expanded={headerProps.expanded}
      inert={!headerProps.expanded} aria-hidden={!headerProps.expanded}
      style={{ '--pl-entry-indent': `${indent}px` } as CSSProperties}>
      {/* 内层允许网格轨道收缩至零，缩进仍只作用于条目内容，整行 hover 和点击区域保持满宽。 */}
      <div className="pl-sidebar-group__items"><SidebarContent contentState={contentState} emptyText={emptyText} errorText={errorText}>{children}</SidebarContent></div>
    </div>
  </div>;
}
