import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { ContextMenu } from 'deep-agent-base-ui/context-menu';
import { Menu } from 'deep-agent-base-ui/menu';
import './action-menu.css';

export interface ActionMenuProps {
  trigger: ReactElement;
  children: ReactNode;
  /** 原生模态窗口中的菜单留在同一顶层容器内。 */
  container?: HTMLElement | null;
  side?: 'inline-end' | 'bottom';
}

/** 紧贴触发按钮打开操作列表，复用菜单的键盘导航、关闭和视口避让。 */
export function ActionMenu({ trigger, children, container, side = 'inline-end' }: ActionMenuProps) {
  return <Menu.Root modal={false}>
    <Menu.Trigger render={trigger} />
    {/* 空宿主使用默认 Portal；显式传 null 会让浮层保持未挂载。 */}
    <Menu.Portal container={container ?? undefined}>
      <Menu.Positioner side={side} align={side === 'bottom' ? 'end' : 'start'} sideOffset={4} collisionPadding={8} className="pl-action-menu__positioner">
        <Menu.Popup className="pl-action-menu">{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

/** 共用指针位置、菜单导航和视口避让，仅由外层传入业务操作。 */
export function ContextActions({ trigger, children, label }: Pick<ActionMenuProps, 'trigger' | 'children'> & { label: string }) {
  // 在窄屏原生模态面板中，Portal 必须位于同一 dialog，浏览器才允许点击菜单。
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const bindTrigger = useCallback((element: HTMLElement | null) => setContainer(element?.closest('dialog') ?? null), []);
  return <ContextMenu.Root><ContextMenu.Trigger ref={bindTrigger} render={trigger} /><ContextMenu.Portal container={container ?? undefined}>
    <ContextMenu.Positioner collisionPadding={8} className="pl-action-menu__positioner">
      <ContextMenu.Popup className="pl-action-menu" aria-label={label}>{children}</ContextMenu.Popup>
    </ContextMenu.Positioner>
  </ContextMenu.Portal></ContextMenu.Root>;
}

export interface ActionMenuItemProps {
  children: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** 菜单项由底层处理鼠标与键盘激活，具体操作由使用方提供。 */
export function ActionMenuItem({ children, icon, danger, disabled, onSelect }: ActionMenuItemProps) {
  return <Menu.Item className="pl-action-menu__item" data-danger={danger || undefined} disabled={disabled} onClick={onSelect}>
    {icon ? <span aria-hidden="true">{icon}</span> : null}
    {children}
  </Menu.Item>;
}
