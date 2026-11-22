/** Markdown 工作区公开协议；偏移为 UTF-16 半开区间，不含编辑器或 Pi 类型。 */
export const NOVEL_COVER_IDS = ['forest', 'dunes', 'ocean', 'stars'] as const;
export type NovelCoverId = typeof NOVEL_COVER_IDS[number];

export interface NovelShelfUpdate { pinned?: boolean; coverId?: NovelCoverId }
export interface Workspace extends NovelShelfUpdate { id: string; title: string; root: string; createdAt: string }
export interface DocumentView { path: string; content: string; version: string | null }
export interface NovelManuscriptStats { chapters: number; characters: number }
/** 与稿纸计数一致，按 Unicode 字符计入 Markdown 标记并忽略空白。 */
export function countManuscriptCharacters(content: string): number {
  return Array.from(content.replace(/\s/g, '')).length;
}
export interface ManuscriptView { workspaceId: string; path: string; mode: 'edit' | 'preview' | 'history' | 'refresh' | 'discard' | 'export_txt'; downloadId?: string; revisionId?: string; proposalId?: string }
export interface Revision { id: string; path: string; version: string | null; source: 'observed' | 'manual' | 'accepted' | 'restored'; createdAt: string; restoredFrom?: string }
export interface Selection { start: number; end: number; text: string }
export interface Reference { path: string; version: string }
export interface ProposalRequest { path: string; baseVersion: string | null; content: string; selection?: Selection; references?: Reference[] }
export interface Change { id: string; start: number; end: number; before: string; after: string; status: 'pending' | 'accepted' | 'rejected'; revisionId?: string }
export interface Proposal {
  id: string; path: string; baseVersion: string | null; baseContent: string; content: string;
  changes: Change[]; references: Reference[]; createdAt: string;
  status: 'pending' | 'partial' | 'accepted' | 'rejected' | 'resolved';
  origin?: { sessionId: string; requestId: string; reason: string };
}
export interface SaveDocumentRequest { path: string; baseVersion: string | null; content: string }
/** 单章导出直接取最近保存的磁盘稿，version 标识该 Markdown 原文。 */
export interface ChapterTextExport { filename: string; content: string; version: string }
export interface ExportRequest { files: Array<{ path: string; revisionId?: string }> }
export interface ExportResult { files: DocumentView[] }
export interface PendingCommit { path: string; beforeVersion: string | null; afterVersion: string; revision: Revision; proposalId?: string; changeId?: string }
export interface RecoveryView { pending: PendingCommit | null; current?: DocumentView; intendedContent?: string }
