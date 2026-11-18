import { useId, type CSSProperties, type ReactNode } from 'react';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { useElasticSidebar } from './use-elastic-sidebar.ts';
import './global-layout.css';

export interface GlobalLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  sidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  gap?: number;
  contentPadding?: number;
}

/** 主题外壳融合左侧栏并包裹右正文卡片；弹性把手调宽，两侧独立滚动，不感知业务状态。 */
export function GlobalLayout({ sidebar, children, style, sidebarWidth = 256, minSidebarWidth = 180,
  maxSidebarWidth = 440, gap = 20, contentPadding = 0 }: GlobalLayoutProps) {
  const sidebarId = useId();
  // 保留把手可命中的间距；窄屏下实际宽度边界由容器尺寸决定。
  const panelGap = Math.max(16, gap);
  const { rootRef, handleRef, pathRef } = useElasticSidebar(sidebarWidth, minSidebarWidth, maxSidebarWidth, panelGap);
  return (
    <div ref={rootRef} className="plotloom-global-layout" style={{ ...style, columnGap: panelGap, overflow: 'hidden' }}>
      <aside id={sidebarId} className="plotloom-global-layout__sidebar" aria-label="侧边栏">
        <ScrollBox className="plotloom-global-layout__scroll" aria-label="侧边栏内容">{sidebar}</ScrollBox>
      </aside>
      <div ref={handleRef} className="plotloom-global-layout__handle" role="separator" tabIndex={0}
        aria-label="调整侧边栏宽度" aria-orientation="vertical" aria-controls={sidebarId}
        aria-valuemin={minSidebarWidth} aria-valuemax={maxSidebarWidth} aria-valuenow={sidebarWidth}
        style={{ left: `calc(var(--pl-layout-padding) + var(--pl-sidebar-width) + ${panelGap / 2}px)` }}>
        {/* 动态路径用于把手变形，不替代图标库中的静态图标。 */}
        <svg viewBox="0 0 40 100" aria-hidden="true"><path ref={pathRef} d="M20 20 Q20 50 20 80" /></svg>
      </div>
      <main className="plotloom-global-layout__main">
        <ScrollBox className="plotloom-global-layout__scroll" aria-label="主内容" style={{ padding: contentPadding }}>{children}</ScrollBox>
      </main>
    </div>
  );
}
