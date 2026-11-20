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
  /** inset 为主界面卡片外壳；flat 为贴边双栏，以背景和单侧分隔线区分区域。 */
  variant?: 'inset' | 'flat';
}

/** 主题外壳融合左侧栏并包裹右正文卡片；弹性把手调宽，两侧独立滚动，不感知业务状态。 */
export function GlobalLayout({ sidebar, children, style, sidebarWidth = 256, minSidebarWidth = 180,
  maxSidebarWidth = 440, gap = 20, contentPadding = 0, variant = 'inset' }: GlobalLayoutProps) {
  const sidebarId = useId();
  // 平铺布局的把手覆盖分界线，不额外留缝；窄屏宽度仍由同一套弹性约束处理。
  const panelGap = variant === 'flat' ? 0 : Math.max(16, gap);
  const { rootRef, handleRef, pathRef } = useElasticSidebar(sidebarWidth, minSidebarWidth, maxSidebarWidth, panelGap);
  return (
    <div ref={rootRef} className="plotloom-global-layout" data-variant={variant} style={{ ...style, columnGap: panelGap, overflow: 'hidden' }}>
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
