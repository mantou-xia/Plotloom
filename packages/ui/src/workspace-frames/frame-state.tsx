import type { ReactNode } from 'react';

/** 阅读器与浏览器的状态都在既定内容区居中，切换不改变工具栏和底栏尺寸。 */
export function FrameState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return <div className="pl-content-frame__state">
    <span className="pl-content-frame__state-icon" aria-hidden="true">{icon}</span>
    <h2>{title}</h2>
    {children ? <div className="pl-content-frame__state-detail">{children}</div> : null}
  </div>;
}
