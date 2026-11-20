import { useState, type CSSProperties } from 'react';
import { SplitPaneLayout } from '../layouts/split-pane-layout.tsx';
import { Button } from '../button/button.tsx';
import type { PreviewControls } from './controls.ts';

/** 用占位内容验证布局；打开哪份业务文档由页面自己决定。 */
export function SplitPaneExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style?: CSSProperties; onAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(state !== 'closed' && state !== 'narrow');
  const [version, setVersion] = useState(1);
  const changeOpen = (next: boolean) => { setOpen(next); onAction(`onOpenChange(${next})`); };
  const blocks = state === 'overflow' ? 30 : 4;
  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <Button variant="secondary" onClick={() => changeOpen(!open)}>切换右侧面板</Button>
      <Button variant="ghost" onClick={() => { setVersion(value => value + 1); onAction('切换面板内容'); }}>切换内容</Button>
    </div>
    <SplitPaneLayout open={open} onOpenChange={changeOpen} panelTitle={controls.splitPanelTitle}
      minPanelWidth={controls.splitMinWidth} maxPanelWidth={controls.splitMaxWidth} breakpoint={controls.splitBreakpoint}
      onPanelWidthChange={width => onAction(`onPanelWidthChange(${Math.round(width)}px)`)}
      style={{ flex: style?.height ? undefined : 1, minHeight: 0, ...style }}
      panelActions={<Button variant="text" size="sm" onClick={() => onAction('panelActions.onClick')}>操作</Button>}
      panel={state === 'empty' ? null : <div style={{ padding: 24 }}>
        <p>面板内容 {version}</p>
        <input aria-label="面板草稿" placeholder="输入后关闭重开，检查状态保留" style={{ width: '100%', border: 0, padding: 10, background: 'var(--pl-surface-muted)' }} />
        {Array.from({ length: blocks }, (_, index) => <p key={index} style={{ lineHeight: 2, marginBlock: 24 }}>右侧段落 {index + 1}。这里是调用方传入的内容，布局组件只负责可用空间与独立滚动。</p>)}
      </div>}>
      {state === 'empty' ? null : <div style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20 }}>主内容区域</h2>
        <p>拖动分隔条调整右侧宽度，也可以聚焦分隔条后使用方向键。</p>
        {Array.from({ length: blocks }, (_, index) => <p key={index} style={{ lineHeight: 2, marginBlock: 28 }}>主区段落 {index + 1}。右侧内容打开、关闭或切换时，主区保持挂载，两侧可以分别滚动。</p>)}
      </div>}
    </SplitPaneLayout>
  </div>;
}
