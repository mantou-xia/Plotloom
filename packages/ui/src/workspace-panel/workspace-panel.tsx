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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/** 同一标签切换和收起时保留已打开页面；关闭当前标签优先选右邻页。 */
export function WorkspacePanel({ children, features, open, onOpenChange, className = '', style }: WorkspacePanelProps) {
  const [{ tabs, activeId }, setTabs] = useState<{ tabs: PanelTab[]; activeId: string }>({ tabs: [{ id: '1' }], activeId: '1' });
  const serial = useRef(1);
  function add() {
    const id = String(++serial.current);
    setTabs(current => ({ tabs: [...current.tabs, { id }], activeId: id }));
  }
  function close(id: string) {
    setTabs(current => {
      const index = current.tabs.findIndex(tab => tab.id === id);
      const remaining = current.tabs.filter(tab => tab.id !== id);
      return { tabs: remaining, activeId: id === current.activeId
        ? remaining[index]?.id ?? remaining[index - 1]?.id ?? '' : current.activeId };
    });
  }
  const entries: WorkspaceTab[] = tabs.map(tab => {
    const feature = features.find(item => item.id === tab.featureId);
    return feature ? { id: tab.id, title: feature.title, icon: feature.icon, page: feature.page } : {
      id: tab.id, title: '新标签页', icon: <Plus />,
      page: <WorkspaceStart features={features} onOpen={featureId => setTabs(current => ({
        ...current, tabs: current.tabs.map(item => item.id === tab.id ? { ...item, featureId } : item),
      }))} />,
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
