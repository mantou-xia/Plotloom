import { SidebarEntry, type SidebarEntryProps } from './item-base.tsx';
import './nav-item.css';
export type SidebarNavItemProps = SidebarEntryProps;
/** 功能入口独立维护；页面跳转或新建动作由调用方提供。 */
export function SidebarNavItem({ className = '', ...props }: SidebarNavItemProps) {
  return <SidebarEntry {...props} className={`pl-sidebar-nav-item ${className}`} />;
}
