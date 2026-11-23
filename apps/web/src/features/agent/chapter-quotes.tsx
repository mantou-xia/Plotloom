import { useLayoutEffect, useRef } from 'react';
import type { DocumentReferenceContent } from '@plotloom/contracts/sources';
import { DocumentQuoteChip } from '@plotloom/ui/document-quote-chip';
import { ScrollBox } from '@plotloom/ui/scroll-box';
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
      <li key={id}><DocumentQuoteChip path={reference.path} location={quoteLocation({ firstLine, lastLine })}
        text={reference.selection.text} comment={reference.editComment} onRemove={() => draft.remove(id)} /></li>)}</ul>
  </ScrollBox>;
}

export function SentChapterQuotes({ references }: { references: readonly DocumentReferenceContent[] }) {
  return <ul className="plotloom-chapter-quotes plotloom-chapter-quotes--sent" aria-label="已发送的文稿引用">{references.map((reference, index) =>
    <li key={index}><DocumentQuoteChip path={reference.path} location={reference.lineRange ? quoteLocation(reference.lineRange) : undefined}
      comment={reference.editComment} text={reference.content} /></li>)}</ul>;
}
