import type { CSSProperties } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import './document-quote-chip.css';

export interface DocumentQuoteChipProps {
  path: string;
  location?: string;
  text: string;
  comment?: string;
  onRemove?: () => void;
  style?: CSSProperties;
}

/** 草稿和历史消息用同一标签预览原文与修改要求；有移除回调时提供独立操作。 */
export function DocumentQuoteChip({ path, location, text, comment, onRemove, style }: DocumentQuoteChipProps) {
  const label = [path.split('/').at(-1), location].filter(Boolean).join(' · ');
  return <div className="plotloom-chapter-quote-chip" style={style}>
    <Tooltip shake={false} className="plotloom-chapter-quote-details" content={<>
      <strong className="plotloom-chapter-quote-source">{[path, location].filter(Boolean).join(' · ')}</strong>
      <ScrollBox className="plotloom-chapter-quote-preview" tabIndex={-1} reserveScrollbarSpace={false}>
        {comment ? <div className="plotloom-chapter-quote-comment"><strong>修改要求</strong><p>{comment}</p></div> : null}
        <div className="plotloom-chapter-quote-original"><strong>选中原文</strong><p>{text}</p></div>
      </ScrollBox>
    </>}>
      <Button size="sm" variant="ghost" className="plotloom-chapter-quote-label">
        <FileText aria-hidden="true" /><span className="plotloom-chapter-quote-caption">{label}</span>
      </Button>
    </Tooltip>
    {onRemove ? <Button size="sm" variant="ghost" iconOnly aria-label={`移除引用 ${label}`} onClick={onRemove}><X /></Button> : null}
  </div>;
}
