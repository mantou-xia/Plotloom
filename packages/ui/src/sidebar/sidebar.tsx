import { useState, type CSSProperties, type ReactNode } from 'react';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './sidebar.css';

export interface SidebarProps {
  header?: ReactNode;
  /** 固定导航入口，不随内容区滚动。 */
  fixNavItems?: ReactNode;
  /** 滚动区顶部的普通导航入口。 */
  navItems?: ReactNode;
  /** 外层分类集合，由调用方按需组合 SidebarSection 及其内部的分组或对话。 */
  groups?: ReactNode;
  footer?: ReactNode;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** 头尾与固定导航保持可见；普通导航和外层分类共用一个滚动区，避免嵌套滚动。 */
export function Sidebar({ header, fixNavItems, navItems, groups, footer, label = '侧栏导航', className = '', style }: SidebarProps) {
  // 只记录是否离开顶部，避免随着每个滚动像素更新状态；回到顶部时撤去分界线。
  const [isScrolled, setIsScrolled] = useState(false);
  return <nav className={`plotloom-sidebar ${className}`} style={style} aria-label={label}>
    {header ? <div className="plotloom-sidebar__header">{header}</div> : null}
    {fixNavItems ? <div className="plotloom-sidebar__fixed" data-scrolled={isScrolled}>{fixNavItems}</div> : null}
    <ScrollBox className="plotloom-sidebar__body" tabIndex={-1}
      onScroll={event => setIsScrolled(event.currentTarget.scrollTop > 0)}>
      {navItems ? <div className="plotloom-sidebar__nav-items">{navItems}</div> : null}
      {groups ? <div className="plotloom-sidebar__groups">{groups}</div> : null}
    </ScrollBox>
    {footer ? <div className="plotloom-sidebar__footer">{footer}</div> : null}
  </nav>;
}
