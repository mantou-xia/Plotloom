import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '../button/button.tsx';
import './action-button.css';
export interface SidebarActionButtonProps extends Omit<ButtonProps, 'children' | 'iconOnly' | 'variant' | 'startIcon' | 'endIcon'> {
  label: string;
  icon: ReactNode;
}
/** 新增和更多等操作统一复用 Button 的透明反馈、禁用及键盘语义。 */
export function SidebarActionButton({ label, icon, size = 'sm', className = '', ...props }: SidebarActionButtonProps) {
  return <Button {...props} className={`pl-sidebar-action-button ${className}`} variant="ghost" size={size} iconOnly aria-label={label} title={label}>{icon}</Button>;
}
