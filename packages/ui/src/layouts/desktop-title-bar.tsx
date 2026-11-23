import type { CSSProperties, Ref } from 'react';
import './desktop-title-bar.css';

export interface DesktopTitleBarProps {
  title: string;
  ref?: Ref<HTMLElement>;
  style?: CSSProperties;
}

/** 展示窗口标题与可拖动区，控件区域由宿主的原生窗口覆盖层保留。 */
export function DesktopTitleBar({ title, ref, style }: DesktopTitleBarProps) {
  return <header ref={ref} className="plotloom-desktop-titlebar" style={style}>
    <div className="plotloom-desktop-titlebar__drag">{title}</div>
  </header>;
}
