import type { Outcome } from './index.ts';
import type { DocumentView, Proposal, Reference, Selection } from './workspaces.ts';

/** 创作输入完全通过公开协议描述，不包含 SDK 配置或本机绝对路径。 */
export type WritingTask = 'chapter' | 'continue' | 'rewrite' | 'enrich_outline' | 'discuss';
export type SourceRole = 'outline' | 'character' | 'requirements' | 'sample' | 'history' | 'other' | 'target';
export interface WritingReference extends Reference { role: Exclude<SourceRole, 'target'>; selection?: Selection }
export interface WritingRequest {
  task: WritingTask; instructions: string;
  target?: { path: string; baseVersion: string | null; selection?: Selection };
  outline?: Reference; references?: WritingReference[]; maxOutputChars?: number; skillIds?: string[];
}
export interface WritingSource extends DocumentView { role: SourceRole; selection?: Selection }
export interface WritingContext {
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
