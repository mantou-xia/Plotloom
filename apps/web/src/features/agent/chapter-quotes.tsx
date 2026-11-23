import { useLayoutEffect, useRef } from 'react';
import { FileText, X } from 'lucide-react';
import type { DocumentReferenceContent } from '@plotloom/contracts/sources';
import { Button } from '@plotloom/ui/button';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { Tooltip } from '@plotloom/ui/tooltip';
import { quoteLocation, type ChapterQuoteDraft } from './chapter-quote';
import './chapter-quotes.css';

/** 固定高度的单行引用列表允许横向滚动，连续添加或移除时输入区保持原位。 */
export function ChapterQuoteList({ draft }: { draft: ChapterQuoteDraft }) {
  const list = useRef<HTMLDivElement>(null);
  const lastAdded = useRef(0);
  const lastId = draft.items.at(-1)?.id ?? 0;
  useLayoutEffect(() => {
    if (lastId > lastAdded.current && list.current) list.current.scrollLeft = list.current.scrollWidth;
    lastAdded.current = lastId;
  }, [lastId]);

  return <ScrollBox ref={list} className="plotloom-chapter-quotes-scroll" orientation="horizontal" scrollbarVisibility="hidden"
    tabIndex={-1} reserveScrollbarSpace={false}>
    <ul className="plotloom-chapter-quotes" aria-label="文稿引用">{draft.items.map(({ id, firstLine, lastLine, reference }) =>
      <ChapterQuoteChip key={id} path={reference.path} location={quoteLocation({ firstLine, lastLine })}
        text={reference.selection.text} comment={reference.editComment} onRemove={() => draft.remove(id)} />)}</ul>
  </ScrollBox>;
}

export function SentChapterQuotes({ references }: { references: readonly DocumentReferenceContent[] }) {
  return <ul className="plotloom-chapter-quotes plotloom-chapter-quotes--sent" aria-label="已发送的文稿引用">{references.map((reference, index) =>
    <ChapterQuoteChip key={index} path={reference.path} location={reference.lineRange ? quoteLocation(reference.lineRange) : ''}
      comment={reference.editComment ?? ''} text={reference.content} />)}</ul>;
}

/** 标签只给出定位。悬停内容分开显示作者要求与当时选中的原文。 */
function ChapterQuoteChip({ path, location, text, comment, onRemove }: {
  path: string; location: string; text: string; comment: string; onRemove?: () => void;
}) {
  const label = [path.split('/').at(-1), location].filter(Boolean).join(' · ');
  return <li>
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
  </li>;
}
