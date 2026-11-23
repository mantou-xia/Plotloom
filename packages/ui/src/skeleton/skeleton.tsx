import type { CSSProperties } from 'react';
import './skeleton.css';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** 提供每一行宽度时按段落排布；默认保留单块占位。 */
  lineWidths?: readonly CSSProperties['width'][];
}

/** 只负责视觉占位；加载状态由所在区域通过 aria-busy 提供。 */
export function Skeleton({ className = '', style, lineWidths }: SkeletonProps) {
  return <span aria-hidden="true" className={`pl-skeleton ${className}`} data-paragraph={lineWidths ? true : undefined} style={style}>
    {lineWidths?.map((width, index) => <span key={index} className="pl-skeleton__line" style={{ width }} />)}
  </span>;
}
