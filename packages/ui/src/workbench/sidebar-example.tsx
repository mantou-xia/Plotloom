import { useState, type CSSProperties } from 'react';
import { LayoutGrid, Plus, SquarePen, Settings } from 'lucide-react';
import { SidebarActionButton } from '../sidebar/action-button.tsx';
import { Sidebar } from '../sidebar/sidebar.tsx';
import { SidebarGroup } from '../sidebar/group.tsx';
import { SidebarSection } from '../sidebar/section.tsx';
import { SidebarNavItem } from '../sidebar/nav-item.tsx';
import { SidebarSessionItem } from '../sidebar/session-item.tsx';
import { SidebarSettingsItem } from '../sidebar/settings-item.tsx';

/** 仅用占位内容演示公开组件；选择、新建及折叠都在调用方管理，不模拟产品页面。 */
export function SidebarExample({ state, style, onAction }: { state: string; style: CSSProperties; onAction: (action: string) => void }) {
  const [sections, setSections] = useState({ projects: state !== 'collapsed', novels: state !== 'collapsed', recent: state !== 'collapsed' });
  const [selected, setSelected] = useState(state === 'selected' ? 'item-0' : 'page');
  const [count, setCount] = useState(state === 'empty' ? 0 : state === 'overflow' || state === 'fixed' ? 30 : 3);
  const [pinned, setPinned] = useState<Set<number>>(() => new Set());
  const select = (id: string) => { setSelected(id); onAction(`onClick(${id})`); };
  const toggleSection = (key: keyof typeof sections, expanded: boolean) => {
    setSections((current) => ({ ...current, [key]: expanded }));
    onAction(`onExpandedChange(${key}, ${expanded})`);
  };
  return <Sidebar style={{ ...style, overflow: 'hidden' }} header={<strong>侧栏示例</strong>}
    fixNavItems={<SidebarNavItem label="新聊天（示例）" icon={<SquarePen />} onClick={() => onAction('onNewChat')} />}
    navItems={<SidebarNavItem label="功能页面" icon={<LayoutGrid />} active={selected === 'page'} onClick={() => select('page')} />}
    footer={<SidebarSettingsItem label="设置项" icon={<Settings />} active={selected === 'settings'} onClick={() => select('settings')} />}
    groups={<>
      <SidebarSection label="项目" expanded={sections.projects} onExpandedChange={(next) => toggleSection('projects', next)}>
        <ExampleGroup label="项目 Alpha" id="project-a" state={state} selected={selected} onSelect={select} onAction={onAction} />
        <ExampleGroup label="项目 Beta" id="project-b" state={state} selected={selected} onSelect={select} onAction={onAction} />
      </SidebarSection>
      <SidebarSection label="小说" expanded={sections.novels} onExpandedChange={(next) => toggleSection('novels', next)}>
        <ExampleGroup label="小说示例" id="novel-a" state={state} selected={selected} onSelect={select} onAction={onAction} />
      </SidebarSection>
      <SidebarSection label={state === 'long' ? '最近对话：用于检查窄侧栏的外层分类长标题' : '最近'}
        contentState={state === 'error' ? 'error' : count === 0 ? 'empty' : 'ready'}
        expanded={sections.recent} onExpandedChange={(next) => toggleSection('recent', next)}
        actions={<SidebarActionButton icon={<Plus />} label="新增示例条目" onClick={() => { setCount((value) => value + 1); toggleSection('recent', true); onAction('onCreate'); }} />}>
      {Array.from({ length: count }, (_, index) => <SidebarSessionItem key={index}
        label={state === 'long' ? `条目 ${index + 1}：这是一段较长的标题，用来检查文字省略和操作按钮是否稳定` : `会话条目 ${index + 1}`}
        active={selected === `item-${index}`} onClick={() => select(`item-${index}`)}
        timeLabel={index === 0 ? '3 分钟前' : `${index + 1} 天前`} status={(['running', 'unread', 'failed'] as const)[index % 3]}
        pinned={pinned.has(index)} onPinnedChange={(next) => { setPinned((current) => { const updated = new Set(current); if (next) updated.add(index); else updated.delete(index); return updated; }); onAction(`onPinnedChange(item-${index}, ${next})`); }}
        onArchive={() => onAction(`onArchive(item-${index})（仅示例回调）`)} />)}
      </SidebarSection>
    </>} />;
}

/** 内层分组单独管理展开状态，用来验证收起外层分类后再次展开仍保留各项目的状态。 */
function ExampleGroup({ label, id, state, selected, onSelect, onAction }: {
  label: string; id: string; state: string; selected: string; onSelect: (id: string) => void; onAction: (action: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  // 项目、小说与最近使用相同会话能力；各分组独立保存置顶状态，操作不改变选中项。
  const [pinned, setPinned] = useState(false);
  return <SidebarGroup label={label} expanded={expanded} onExpandedChange={setExpanded}
    contentState={state === 'empty' || state === 'error' ? state : 'ready'}>
    <SidebarSessionItem label={`${label}的对话`} active={selected === id} onClick={() => onSelect(id)}
      timeLabel="3 分钟前" status="running" pinned={pinned}
      onPinnedChange={(next) => { setPinned(next); onAction(`onPinnedChange(${id}, ${next})`); }}
      onArchive={() => onAction(`onArchive(${id})（仅示例回调）`)} />
  </SidebarGroup>;
}
