import type { CSSProperties, ReactNode } from 'react';
import { ContextActions } from '../action-menu/action-menu.tsx';
import { Folder, FolderOpen } from 'lucide-react';
import { Button } from '../button/button.tsx';
import './group-header.css';
export interface SidebarGroupHeaderProps {
  label: string;
  /** 业务可传入图标组件或已上传图片的 img；默认使用开合文件夹，null 表示隐藏。 */
  collapsedIcon?: ReactNode;
  expandedIcon?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  contentId?: string;
  actions?: ReactNode;
  /** 右键仅作用于分组标题，聊天子项继续使用自己的操作。 */
  contextMenu?: ReactNode;
  disabled?: boolean;
  rowHeight?: number;
  gap?: number;
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
}
/** 标题只切换展开；操作按钮是同级元素，无选中态且不误触折叠。 */
export function SidebarGroupHeader({ label, collapsedIcon = <Folder />, expandedIcon = <FolderOpen />, expanded, onExpandedChange, contentId, actions, contextMenu, disabled,
  rowHeight = 38, gap = 8, iconSize = 16, className = '', style }: SidebarGroupHeaderProps) {
  // 图标由受控展开状态决定；不使用额外箭头，辅助技术仍通过 aria-expanded 读取状态。
  const icon = expanded ? expandedIcon : collapsedIcon;
  const header = <div className={`pl-sidebar-group-header ${className}`} data-disabled={disabled || undefined} style={{ '--pl-group-height': `${rowHeight}px`, '--pl-group-gap': `${gap}px`, '--pl-group-icon': `${iconSize}px`, ...style } as CSSProperties}>
    <Button className="pl-sidebar-group-header__toggle" variant="ghost" title={label} disabled={disabled}
      aria-expanded={expanded} aria-controls={contentId} onClick={() => onExpandedChange(!expanded)}>
      {icon ? <span className="pl-sidebar-group-header__icon" aria-hidden="true">{icon}</span> : null}
      <span className="pl-sidebar-group-header__label">{label}</span>
    </Button>
    {actions ? <div className="pl-sidebar-group-header__actions">{actions}</div> : null}
  </div>;
  if (!contextMenu || disabled) return header;
  return <ContextActions trigger={header} label={label + '分组操作'}>{contextMenu}</ContextActions>;
}
