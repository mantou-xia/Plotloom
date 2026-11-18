import { SidebarEntry, type SidebarEntryProps } from './item-base.tsx';
import './settings-item.css';
export type SidebarSettingsItemProps = SidebarEntryProps;
/** 设置入口可独立展示，固定位置由 Sidebar 的 footer 插槽决定。 */
export function SidebarSettingsItem({ className = '', ...props }: SidebarSettingsItemProps) {
  return <SidebarEntry {...props} className={`pl-sidebar-settings-item ${className}`} />;
}
