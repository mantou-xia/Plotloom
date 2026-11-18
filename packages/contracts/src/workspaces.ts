/** Markdown 工作区公开协议；偏移为 UTF-16 半开区间，不含编辑器或 Pi 类型。 */
export interface Workspace { id: string; title: string; root: string; createdAt: string }
export interface DocumentView { path: string; content: string; version: string | null }
export interface Revision { id: string; path: string; version: string | null; source: 'observed' | 'manual' | 'accepted' | 'restored'; createdAt: string; restoredFrom?: string }
export interface Selection { start: number; end: number; text: string }
export interface Reference { path: string; version: string }
export interface ProposalRequest { path: string; baseVersion: string | null; content: string; selection?: Selection; references?: Reference[] }
export interface Change { id: string; start: number; end: number; before: string; after: string; status: 'pending' | 'accepted' | 'rejected'; revisionId?: string }
export interface Proposal {
  id: string; path: string; baseVersion: string | null; baseContent: string; content: string;
  changes: Change[]; references: Reference[]; createdAt: string;
  status: 'pending' | 'partial' | 'accepted' | 'rejected' | 'resolved';
}
export interface SaveDocumentRequest { path: string; baseVersion: string | null; content: string }
export interface ExportRequest { files: Array<{ path: string; revisionId?: string }> }
export interface ExportResult { files: DocumentView[] }
export interface PendingCommit { path: string; beforeVersion: string | null; afterVersion: string; revision: Revision; proposalId?: string; changeId?: string }
export interface RecoveryView { pending: PendingCommit | null; current?: DocumentView; intendedContent?: string }
