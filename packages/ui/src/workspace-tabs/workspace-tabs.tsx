import { useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './workspace-tabs.css';

export interface WorkspaceTab {
  id: string;
  title: string;
  icon?: ReactNode;
  toolbar?: ReactNode;
  content?: ReactNode;
  /** 完整页面插槽：提供后由页面管理工具栏与滚动，不再包默认框架。 */
  page?: ReactNode;
  closable?: boolean;
}

export interface WorkspaceTabsProps {
  tabs: readonly WorkspaceTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd?: () => void;
  actions?: ReactNode;
  empty?: ReactNode;
  className?: string;
  /** 默认填满有界父容器；固定尺寸直接作用于框架根元素。 */
  style?: CSSProperties;
}

/** 只管理标签与页面槽位；页面始终挂载，各自负责能力、资源和状态生命周期。 */
export function WorkspaceTabs({ tabs, activeId, onSelect, onClose, onAdd, actions, empty, className = '', style }: WorkspaceTabsProps) {
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  function select(id: string) {
    onSelect(id);
    const button = root.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(id)}"]`);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  /** 关闭选中页后由调用方选择邻页；焦点在提交后回到选中标签或新增按钮。 */
  function close(id: string) {
    onClose(id);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"], [data-add-tab]')?.focus({ preventScroll: true }));
  }
  return <div className={`pl-workspace-tabs ${className}`} style={style} ref={root}>
    <header className="pl-workspace-tabs__header">
      <ScrollBox orientation="horizontal" scrollbarVisibility="hidden" tabIndex={-1} className="pl-workspace-tabs__list" role="tablist" aria-label="工作区标签" onKeyDown={event => {
        if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
        const index = tabs.findIndex(tab => tab.id === activeId);
        if (event.key === 'Delete' && tabs[index]?.closable !== false) { event.preventDefault(); close(activeId); return; }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !tabs.length) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[next].id);
      }}>
        {tabs.map(tab => <div key={tab.id} className="pl-workspace-tabs__item" data-active={tab.id === activeId}>
          <button type="button" role="tab" id={`${prefix}-tab-${tab.id}`} data-tab-id={tab.id}
            aria-selected={tab.id === activeId} aria-controls={`${prefix}-panel-${tab.id}`} tabIndex={tab.id === activeId ? 0 : -1}
            title={tab.title} onClick={() => select(tab.id)}>
            <span aria-hidden="true">{tab.icon}</span><span className="pl-workspace-tabs__title">{tab.title}</span>
          </button>
          {tab.closable !== false ? <Button className="pl-workspace-tabs__close" variant="ghost" size="sm" iconOnly aria-label={`关闭标签：${tab.title}`} onClick={() => close(tab.id)}><X size={12} /></Button> : null}
        </div>)}
      </ScrollBox>
      <div className="pl-workspace-tabs__actions">
        {onAdd ? <Button data-add-tab variant="ghost" size="sm" iconOnly aria-label="新建标签" onClick={onAdd}><Plus /></Button> : null}
        {actions}
      </div>
    </header>
    <div className="pl-workspace-tabs__pages">
      {tabs.map(tab => <section key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`}
        hidden={tab.id !== activeId} className="pl-workspace-tabs__page" tabIndex={0}>
        {tab.page !== undefined ? tab.page : <>
          <div className="pl-workspace-tabs__toolbar">{tab.toolbar}</div>
          <ScrollBox className="pl-workspace-tabs__content" aria-label={`${tab.title}内容`}>{tab.content}</ScrollBox>
        </>}
      </section>)}
      {!tabs.length ? <ScrollBox className="pl-workspace-tabs__empty" aria-label="空工作区">{empty}</ScrollBox> : null}
    </div>
  </div>;
}
