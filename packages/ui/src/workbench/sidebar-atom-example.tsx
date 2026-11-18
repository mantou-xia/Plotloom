import { useState, type CSSProperties } from 'react';
import { Book, BookOpen, Ellipsis, LayoutGrid, Plus, Settings } from 'lucide-react';
import { SidebarNavItem } from '../sidebar/nav-item.tsx';
import { SidebarSessionItem } from '../sidebar/session-item.tsx';
import { SidebarSettingsItem } from '../sidebar/settings-item.tsx';
import { SidebarGroupHeader } from '../sidebar/group-header.tsx';
import { SidebarGroup } from '../sidebar/group.tsx';
import { SidebarSection } from '../sidebar/section.tsx';
import { SidebarActionButton } from '../sidebar/action-button.tsx';
import type { PreviewControls } from './controls.ts';

/** 单个组件直接挂载，参数传至真实根节点；不借完整侧栏包裹伪造原子预览。 */
export function SidebarAtomExample({ component, controls: c, style, onAction }: {
  component: string; state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  // 本地点击状态覆盖初始参数；当面板参数变化时重建交互样例，使面板成为明确的控制来源。
  return <AtomInteraction key={`${c.sidebarActive}:${c.sidebarExpanded}:${c.sessionPinned}`} component={component} controls={c} style={style} onAction={onAction} />;
}

function AtomInteraction({ component, controls: c, style, onAction }: Omit<Parameters<typeof SidebarAtomExample>[0], 'state'>) {
  const [active, setActive] = useState(c.sidebarActive);
  const [expanded, setExpanded] = useState(c.sidebarExpanded);
  const [pinned, setPinned] = useState(c.sessionPinned);
  const content = { contentState: c.sidebarContentState, emptyText: c.sidebarEmptyText, errorText: c.sidebarErrorText };
  const actions = c.sidebarActions ? <SidebarActionButton label="示例操作" icon={component.includes('group') ? <Plus /> : <Ellipsis />} onClick={() => onAction('actions.onClick')} /> : undefined;
  const shared = { label: c.text, disabled: c.disabled, rowHeight: c.sidebarRowHeight, gap: c.sidebarGap, iconSize: c.sidebarIconSize, style, actions };
  const item = { ...shared, active, indicatorWidth: c.sidebarIndicatorWidth, indicatorHeight: c.sidebarIndicatorHeight,
    onClick: () => { setActive((value) => !value); onAction('onClick'); } };
  if (component === 'sidebar-action-button') return <SidebarActionButton label={c.text || '示例操作'} icon={<Ellipsis />} size={c.buttonSize}
    disabled={c.disabled} loading={c.loading} danger={c.danger} style={style} onClick={() => onAction('onClick')} />;
  if (component === 'sidebar-nav-item') return <SidebarNavItem {...item} icon={c.sidebarIcon ? <LayoutGrid /> : undefined} />;
  if (component === 'sidebar-session-item') return <SidebarSessionItem label={c.text} disabled={c.disabled} rowHeight={c.sidebarRowHeight}
    active={active} style={style} indicatorWidth={c.sidebarIndicatorWidth} indicatorHeight={c.sidebarIndicatorHeight} onClick={item.onClick}
    timeLabel={c.sessionTimeLabel} status={c.sessionStatus === 'none' ? undefined : c.sessionStatus} pinned={pinned}
    onPinnedChange={c.sidebarActions ? (next) => { setPinned(next); onAction(`onPinnedChange(${next})`); } : undefined}
    onArchive={c.sidebarActions ? () => onAction('onArchive（仅示例回调）') : undefined} />;
  if (component === 'sidebar-settings-item') return <SidebarSettingsItem {...item} icon={c.sidebarIcon ? <Settings /> : undefined} />;
  // 分类与分组预览也展示完整会话操作，避免只有独立会话预览具备元数据。
  const childSession = <SidebarSessionItem label="分类中的对话示例" active={active} disabled={c.disabled}
    onClick={() => { setActive((value) => !value); onAction('child.onClick'); }}
    timeLabel="3 分钟前" status="running" pinned={pinned}
    onPinnedChange={(next) => { setPinned(next); onAction(`child.onPinnedChange(${next})`); }}
    onArchive={() => onAction('child.onArchive（仅示例回调）')} />;
  if (component === 'sidebar-section') return <SidebarSection {...content} label={c.text} expanded={expanded} disabled={c.disabled} style={style} actions={actions}
    onExpandedChange={(next) => { setExpanded(next); onAction(`onExpandedChange(${next})`); }}>
    {childSession}
  </SidebarSection>;
  const header = { ...shared, expanded,
    collapsedIcon: !c.sidebarIcon ? null : c.sidebarGroupIcon === 'book' ? <Book /> : undefined,
    expandedIcon: !c.sidebarIcon ? null : c.sidebarGroupIcon === 'book' ? <BookOpen /> : undefined,
    onExpandedChange: (next: boolean) => { setExpanded(next); onAction(`onExpandedChange(${next})`); } };
  if (component === 'sidebar-group-header') return <SidebarGroupHeader {...header} />;
  return <SidebarGroup {...header} {...content} indent={c.sidebarIndent}>
    {childSession}
  </SidebarGroup>;
}
