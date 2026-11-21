import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '../button/button.tsx';
import './action-button.css';
export interface SidebarActionButtonProps extends Omit<ButtonProps, 'children' | 'iconOnly' | 'variant' | 'startIcon' | 'endIcon'> {
  label: string;
  icon: ReactNode;
}
/** 图标按钮共用可访问名称和提示，名称随置顶状态等动态文案更新。 */
export function SidebarActionButton({ label, icon, size = 'sm', className = '', tooltip = true, ...props }: SidebarActionButtonProps) {
  return <Button {...props} className={`pl-sidebar-action-button ${className}`} variant="ghost" size={size} iconOnly
    aria-label={label} tooltip={tooltip}>{icon}</Button>;
}
