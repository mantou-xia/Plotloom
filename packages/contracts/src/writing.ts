import type { Outcome } from './index.ts';
import type { DocumentView, Proposal, Reference, Selection } from './workspaces.ts';

/** 创作输入完全通过公开协议描述，不包含 SDK 配置或本机绝对路径。 */
export type WritingTask = 'chapter' | 'continue' | 'rewrite' | 'enrich_outline' | 'discuss';
export const WORLDVIEW_PATH = '世界观.md';

/** 新建正文以章号确定文件路径，章标题可以独立编辑。 */
export function newChapterPath(chapterNumber: number): string {
  return `正文章节/第${chapterNumber}章.md`;
}

/** 优先使用文稿标题中的“第十章”等明确章号，也接受 0004.md 这样的章节文件名。 */
export function chapterFromTitle(title: string): number | undefined {
  const number = /第\s*([0-9零〇一二两三四五六七八九十百千]+)\s*章/.exec(title)?.[1]
    ?? /^(\d+)(?:\.md$|[-_ ])/i.exec(title)?.[1];
  if (!number) return;
  if (/^\d+$/.test(number)) return Number(number) || undefined;
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0, digit = 0;
  for (const char of number.replaceAll('两', '二').replaceAll('〇', '零')) {
    if (units[char]) { total += (digit || 1) * units[char]; digit = 0; }
    else digit = '零一二三四五六七八九'.indexOf(char);
  }
  return total + digit || undefined;
}
export type SourceRole = 'outline' | 'character' | 'requirements' | 'sample' | 'history' | 'other' | 'target';
export interface WritingReference extends Reference { role: Exclude<SourceRole, 'target'>; selection?: Selection }
export interface WritingRequest {
  chapterNumber?: number;
  task: WritingTask; instructions: string;
  target?: { path: string; baseVersion: string | null; selection?: Selection };
  outline?: Reference; references?: WritingReference[]; maxOutputChars?: number; skillIds?: string[];
}
export interface WritingSource extends DocumentView { role: SourceRole; selection?: Selection }
export interface WritingContext {
  chapterNumber?: number;
  workspaceId: string; task: WritingTask; instructions: string; target?: WritingRequest['target'];
  sources: WritingSource[]; maxOutputChars: number; inputChars: number; inputLimit: number;
}
export interface ReviewIssue {
  kind: 'setting' | 'viewpoint' | 'missing_material'; message: string;
  evidence: Array<{ path: string; quote: string }>;
}
export interface WritingReview { status: 'clear' | 'needs_input'; issues: ReviewIssue[] }
export interface WritingRecord {
  id: string; sessionId: string; createdAt: string; context: WritingContext;
  outcome: Outcome | 'running'; review: WritingReview | null;
}
export interface WritingResult extends WritingRecord { proposals: Proposal[] }
