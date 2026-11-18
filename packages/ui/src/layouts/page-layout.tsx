import type { CSSProperties, ReactNode } from 'react';
import { ScrollBox } from '../scroll-box/scroll-box';
import './page-layout.css';

export interface PageLayoutProps {
  title?: string;
  /** 由调用方组合按钮并提供操作，布局本身不管理业务状态。 */
  actions?: ReactNode;
  children?: ReactNode;
  /** 默认占满视口高度；嵌入有界容器时可设置 height: '100%' 或具体高度。 */
  style?: CSSProperties;
  /** 页头和正文的内边距，单位 px。 */
  padding?: number;
  /** 正文直接子项的纵向间距，单位 px。 */
  gap?: number;
  /** 正文最大宽度，单位 px；可用宽度不足时自动收缩。 */
  maxWidth?: number;
}

/** 一级页面布局：页头位于滚动容器外，正文独立滚动；不增加 main，避免与全局布局重复。 */
export function PageLayout({ title, actions, children, style, padding = 24, gap = 24, maxWidth = 1200 }: PageLayoutProps) {
  return (
    <div className="plotloom-page-layout" data-layout="page" style={style}>
      {title || actions ? <header className="plotloom-page-layout__header" style={{ padding }}>
        {title ? <h1 className="plotloom-page-layout__title">{title}</h1> : null}
        {actions ? <div className="plotloom-page-layout__actions">{actions}</div> : null}
      </header> : null}
      <ScrollBox className="plotloom-page-layout__body" role="region" aria-label={title ? `${title}正文` : '页面正文'} style={{ padding }}>
        <div className="plotloom-page-layout__content" style={{ maxWidth, gap }}>{children}</div>
      </ScrollBox>
    </div>
  );
}
