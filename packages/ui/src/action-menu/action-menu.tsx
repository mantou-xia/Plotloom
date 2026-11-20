import type { ReactElement, ReactNode } from 'react';
import { Menu } from 'deep-agent-base-ui/menu';
import './action-menu.css';

export interface ActionMenuProps {
  trigger: ReactElement;
  children: ReactNode;
}

/** 紧贴触发按钮打开操作列表，复用菜单的键盘导航、关闭和视口避让。 */
export function ActionMenu({ trigger, children }: ActionMenuProps) {
  return <Menu.Root modal={false}>
    <Menu.Trigger render={trigger} />
    <Menu.Portal>
      <Menu.Positioner side="inline-end" align="start" sideOffset={4} collisionPadding={8} className="pl-action-menu__positioner">
        <Menu.Popup className="pl-action-menu">{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

export interface ActionMenuItemProps {
  children: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

/** 菜单项由底层处理鼠标与键盘激活，具体操作由使用方提供。 */
export function ActionMenuItem({ children, icon, danger, onSelect }: ActionMenuItemProps) {
  return <Menu.Item className="pl-action-menu__item" data-danger={danger || undefined} onClick={onSelect}>
    {icon ? <span aria-hidden="true">{icon}</span> : null}
    {children}
  </Menu.Item>;
}
