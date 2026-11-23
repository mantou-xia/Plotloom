import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, PanelRightClose, PanelRightOpen, Plus, Search } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Input } from '../form/input.tsx';
import { SplitPaneLayout } from '../layouts/split-pane-layout.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { WorkspaceTabs, type WorkspaceTab } from '../workspace-tabs/workspace-tabs.tsx';
import './workspace-panel.css';

/** 应用注册功能和内容，面板负责标签生命周期及分屏交互。 */
export interface WorkspaceFeature {
  id: string;
  title: string;
  icon: ReactNode;
  keywords?: readonly string[];
  /** 单实例功能可在手动打开和程序定位时复用同一标签。 */
  singleton?: boolean;
  page: ReactNode;
}

export function WorkspaceFeatureCard({ title, icon, onOpen }: { title: string; icon: ReactNode; onOpen: () => void }) {
  return <Button variant="subtle" className="pl-workspace-feature" onClick={onOpen}>
    <span className="pl-workspace-feature__icons" aria-hidden="true">{icon}<ArrowUpRight size={14} /></span>
    <span>{title}</span>
  </Button>;
}

/** 仅筛选当前配置的入口；卡片顺序由调用方负责。 */
function WorkspaceStart({ features, onOpen }: { features: readonly WorkspaceFeature[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const visible = features.filter(feature => [feature.title, ...feature.keywords ?? []].some(label => label.toLocaleLowerCase().includes(term)));
  return <ScrollBox className="pl-workspace-start" aria-label="新标签页内容">
    <div className="pl-workspace-start__content">
      <Input className="pl-workspace-start__search" size="lg" type="search" aria-label="搜索工作区功能"
        placeholder="搜索工作区功能" startIcon={<Search />} clearable value={query} onValueChange={setQuery} />
      <h2>打开功能</h2>
      <div className="pl-workspace-start__grid">
        {visible.map(feature => <WorkspaceFeatureCard key={feature.id} title={feature.title} icon={feature.icon} onOpen={() => onOpen(feature.id)} />)}
        {visible.length ? null : <p role="status">{features.length ? '未找到匹配的功能' : '暂无可打开的功能'}</p>}
      </div>
    </div>
  </ScrollBox>;
}

interface PanelTab { id: string; featureId?: string }

export interface WorkspacePanelProps {
  children: ReactNode;
  features: readonly WorkspaceFeature[];
  /** 首个标签随当前上下文展示的功能；新标签仍从功能列表开始。 */
  primaryFeatureId?: string;
  primaryRequest?: object;
  /** 新对象用于定位已注册的功能，标签关闭后仍可再次请求打开。 */
  featureRequest?: { featureId: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 每次提供新的对象时打开或选中同 ID 的页面；清除请求时移除该页。 */
  requestedTab?: WorkspaceTab;
  className?: string;
  style?: CSSProperties;
}

/** 同一标签切换和收起时保留已打开页面；关闭当前标签优先选右邻页。 */
export function WorkspacePanel({ children, features, primaryFeatureId, primaryRequest, featureRequest, open, onOpenChange, requestedTab, className = '', style }: WorkspacePanelProps) {
  const [{ tabs, activeId, previousRequest, previousPrimary, previousFeature }, setTabs] = useState<{
    tabs: PanelTab[]; activeId: string; previousRequest?: WorkspaceTab;
    previousPrimary?: object; previousFeature?: WorkspacePanelProps['featureRequest'];
  }>({ tabs: [{ id: '1' }], activeId: '1' });
  const serial = useRef(1);
  // 从主区打开的内容与手动打开的标签共享生命周期，重复请求只更新该页并选中它。
  if (previousRequest !== requestedTab) {
    const remaining = tabs.filter(tab => tab.id !== previousRequest?.id || tab.id === requestedTab?.id);
    const next = requestedTab && !remaining.some(tab => tab.id === requestedTab.id)
      ? [...remaining, { id: requestedTab.id }] : remaining;
    setTabs(current => ({ ...current, tabs: next, activeId: requestedTab?.id ?? (activeId === previousRequest?.id ? next.at(-1)?.id ?? '' : activeId),
      previousRequest: requestedTab }));
  }
  if (primaryRequest && primaryRequest !== previousPrimary) {
    const primary = tabs.find(tab => tab.featureId === primaryFeatureId || (tab.id === '1' && !tab.featureId));
    setTabs(current => ({ ...current, previousPrimary: primaryRequest, activeId: primary?.id ?? '1',
      tabs: primary ? current.tabs : [...current.tabs, { id: '1', featureId: primaryFeatureId }] }));
  }
  if (featureRequest !== previousFeature) {
    const feature = features.find(item => item.id === featureRequest?.featureId);
    const id = feature && `feature:${feature.id}`;
    setTabs(current => {
      if (!feature || !id) return { ...current, previousFeature: featureRequest };
      const existing = current.tabs.find(tab => tab.featureId === feature.id || (tab.id === '1' && !tab.featureId && feature.id === primaryFeatureId));
      return { ...current, previousFeature: featureRequest, activeId: existing?.id ?? id,
        tabs: existing ? current.tabs : [...current.tabs, { id, featureId: feature.id }] };
    });
  }
  function add() {
    const id = String(++serial.current);
    setTabs(current => ({ ...current, tabs: [...current.tabs, { id }], activeId: id }));
  }
  function close(id: string) {
    setTabs(current => {
      const index = current.tabs.findIndex(tab => tab.id === id);
      const remaining = current.tabs.filter(tab => tab.id !== id);
      return { ...current, tabs: remaining, activeId: id === current.activeId
        ? remaining[index]?.id ?? remaining[index - 1]?.id ?? '' : current.activeId };
    });
  }
  const entries: WorkspaceTab[] = tabs.map(tab => {
    if (requestedTab && tab.id === requestedTab.id) return requestedTab;
    const featureId = tab.featureId ?? (tab.id === '1' ? primaryFeatureId : undefined);
    const feature = features.find(item => item.id === featureId);
    return feature ? { id: tab.id, title: feature.title, icon: feature.icon, page: feature.page } : {
      id: tab.id, title: '新标签页', icon: <Plus />,
      page: <WorkspaceStart features={features} onOpen={id => setTabs(current => {
        // 单实例功能和主功能已打开时复用标签，并移除本次使用的空标签。
        const single = features.some(item => item.id === id && item.singleton);
        const reuse = id === primaryFeatureId || single;
        const existing = reuse && current.tabs.find(item => item.featureId === id || (id === primaryFeatureId && item.id === '1' && !item.featureId));
        if (existing) return { ...current, activeId: existing.id,
          tabs: single ? current.tabs.filter(item => item.id !== tab.id || item.id === existing.id) : current.tabs };
        return { ...current, tabs: current.tabs.map(item => item.id === tab.id ? { ...item, featureId: id } : item) };
      })} />,
    };
  });
  return <div className={`pl-workspace-panel ${className}`} style={style}>
    <SplitPaneLayout open={open} onOpenChange={onOpenChange} panelTitle="内容工作区" panelHeader={null}
      defaultPanelWidth={560} minPanelWidth={340} maxPanelWidth={1100} minMainWidth={380} breakpoint={820}
      panel={<WorkspaceTabs tabs={entries} activeId={activeId} onSelect={id => setTabs(current => ({ ...current, activeId: id }))}
        onClose={close} onAdd={add}
        actions={<Button variant="ghost" size="sm" iconOnly aria-label="收起工作区" onClick={() => onOpenChange(false)}><PanelRightClose /></Button>}
        empty={<div className="pl-workspace-panel__empty"><h2>没有打开的标签</h2><Button variant="subtle" startIcon={<Plus />} onClick={add}>新建标签</Button></div>} />}>
      <div className="pl-workspace-panel__main">{children}</div>
    </SplitPaneLayout>
    {open ? null : <Button className="pl-workspace-panel__reopen" variant="subtle" size="sm" startIcon={<PanelRightOpen />}
      onClick={() => onOpenChange(true)}>打开工作区</Button>}
  </div>;
}
