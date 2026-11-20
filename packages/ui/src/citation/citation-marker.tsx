import type { CSSProperties } from 'react';
import { Button } from '../button/button.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import './citation-marker.css';

export interface CitationMarkerProps {
  /** 从 1 开始的显示编号，由调用方维护与来源的对应关系；组件不自动排序。 */
  index: number;
  sourceTitle: string;
  /** 交由调用方打开来源详情或定位来源；组件不推断 URL，也不请求来源内容。 */
  onActivate: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 正文中的引用入口。复用按钮与提示层，来源标题不进入文档流，选中/聚焦不会改变行高。 */
export function CitationMarker({ index, sourceTitle, onActivate, active = false, disabled = false,
  className = '', style }: CitationMarkerProps) {
  const label = `查看来源 ${index}：${sourceTitle}`;
  return <Tooltip content={sourceTitle} shake={false} disabled={disabled}>
    <Button variant="secondary" size="sm" className={`pl-citation-marker ${className}`} style={style}
      aria-label={label} aria-current={active ? 'true' : undefined} data-active={active || undefined}
      disabled={disabled} onClick={onActivate}>{index}</Button>
  </Tooltip>;
}
