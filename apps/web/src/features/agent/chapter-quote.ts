import type { DocumentReference } from '@plotloom/contracts/sources';
import type { Selection } from '@plotloom/contracts/workspaces';

export interface ChapterQuote {
  reference: DocumentReference & { selection: Selection; editComment: string };
  firstLine: number;
  lastLine: number;
}

type DraftQuote = ChapterQuote & { id: number };

export interface ChapterQuoteDraft {
  items: readonly DraftQuote[];
  remove: (id: number) => void;
  clearSent: (sent: readonly DraftQuote[]) => void;
}

export function quoteLocation(quote: Pick<ChapterQuote, 'firstLine' | 'lastLine'>) {
  return quote.firstLine === quote.lastLine ? `第 ${quote.firstLine} 行` : `第 ${quote.firstLine}–${quote.lastLine} 行`;
}
