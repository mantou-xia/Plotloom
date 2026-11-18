import { randomUUID } from 'node:crypto';
import { changesFor, checkSelection, checkVersion, documentPath, hash, invalid, missing, proposalStatus, renderProposal, WorkspaceError } from '@plotloom/domain';
import type { DocumentView, ExportRequest, PendingCommit, Proposal, ProposalRequest, RecoveryView, Revision, SaveDocumentRequest, Workspace } from '@plotloom/contracts/workspaces';

export interface WorkspaceState { format: 1; workspace: Workspace; history: Record<string, Revision[]>; proposals: Proposal[]; pending: (PendingCommit & { writerPid?: number }) | null }
/** 存储负责路径约束、排他提交与恢复；用例负责候选和版本业务规则，HTTP/Pi 共用。 */
export interface WorkspaceStore {
  list(): Promise<Workspace[]>;
  register(title: string, root: string): Promise<Workspace>;
  run<T>(id: string, operation: (state: WorkspaceState) => Promise<T>, recover?: boolean): Promise<T>;
  read(state: WorkspaceState, path: string): Promise<DocumentView>;
  files(state: WorkspaceState): Promise<string[]>;
  persist(state: WorkspaceState): Promise<void>;
  snapshot(state: WorkspaceState, revision: Revision): Promise<string>;
  observe(state: WorkspaceState, doc: DocumentView): Promise<void>;
  commit(state: WorkspaceState, doc: DocumentView, content: string, source: Revision['source'], change?: { proposalId: string; changeId: string }, restoredFrom?: string): Promise<Revision>;
  backup(state: WorkspaceState, destination: string): Promise<{ destination: string; files: number }>;
}

/** 无模型、无前端也能完成 Markdown 编辑、候选审阅和历史恢复。 */
export class WorkspaceService {
  private readonly store: WorkspaceStore;
  constructor(store: WorkspaceStore) { this.store = store; }
  list() { return this.store.list(); }
  register(input: { title: string; root: string }) { return this.store.register(input.title, input.root); }
  get(id: string) { return this.store.run(id, async (s) => s.workspace); }
  listDocuments(id: string) { return this.store.run(id, async (s) => ({ paths: await this.store.files(s) })); }
  read(id: string, path: string) { return this.store.run(id, (s) => this.readObserved(s, path)); }
  private async readObserved(state: WorkspaceState, path: string) {
    documentPath(path);
    const doc = await this.store.read(state, path);
    await this.store.observe(state, doc);
    return doc;
  }
  save(id: string, input: SaveDocumentRequest) {
    if (!input.content.isWellFormed()) invalid('Markdown 不能含有未配对的 UTF-16 代理字符。');
    return this.store.run(id, async (s) => {
      const current = await this.readObserved(s, input.path);
      checkVersion(current.version, input.baseVersion);
      if (current.version !== hash(input.content)) await this.store.commit(s, current, input.content, 'manual');
      return this.store.read(s, input.path);
    });
  }
  history(id: string, path: string) {
    return this.store.run(id, async (s) => { await this.readObserved(s, path); return { revisions: s.history[path] ?? [] }; });
  }
  restore(id: string, input: { path: string; revisionId: string; baseVersion: string | null }) {
    return this.store.run(id, async (s) => {
      const current = await this.readObserved(s, input.path);
      checkVersion(current.version, input.baseVersion);
      const revision = s.history[input.path]?.find((r) => r.id === input.revisionId) ?? missing();
      if (revision.version === null) invalid('不存在的文件记录不可作为恢复来源。');
      await this.store.commit(s, current, await this.store.snapshot(s, revision), 'restored', undefined, revision.id);
      return this.store.read(s, input.path);
    });
  }
  proposals(id: string) { return this.store.run(id, async (s) => ({ proposals: s.proposals })); }
  proposal(id: string, proposalId: string) { return this.store.run(id, async (s) => s.proposals.find((p) => p.id === proposalId) ?? missing()); }
  createProposal(id: string, input: ProposalRequest) {
    if (!input.content.isWellFormed()) invalid('Markdown 不能含有未配对的 UTF-16 代理字符。');
    return this.store.run(id, async (s) => {
      const base = await this.readObserved(s, input.path);
      checkVersion(base.version, input.baseVersion);
      if (input.selection) checkSelection(base.content, input.selection);
      const references = input.references ?? [];
      if (new Set(references.map((r) => r.path)).size !== references.length || references.some((r) => r.path === input.path)) invalid('参考资料不可重复或包含候选目标文件。');
      for (const ref of references) checkVersion((await this.readObserved(s, ref.path)).version, ref.version);
      const selection = input.selection;
      const changes = changesFor(selection ? selection.text : base.content, input.content, selection?.start ?? 0);
      if (!changes.length) invalid('候选没有实际修改。');
      const proposal: Proposal = { id: randomUUID(), path: input.path, baseVersion: base.version, baseContent: base.content,
        content: selection ? base.content.slice(0, selection.start) + input.content + base.content.slice(selection.end) : input.content,
        changes, references, createdAt: new Date().toISOString(), status: 'pending' };
      s.proposals.push(proposal); await this.store.persist(s); return proposal;
    });
  }
  /** 正式提交只在显式采纳用例执行；模型适配只能调用 createProposal。 */
  decide(id: string, proposalId: string, changeId: string, action: 'accept' | 'reject') {
    return this.store.run(id, async (s) => {
      const proposal = s.proposals.find((p) => p.id === proposalId) ?? missing();
      const change = proposal.changes.find((c) => c.id === changeId) ?? missing();
      const expectedStatus = action === 'accept' ? 'accepted' : 'rejected';
      if (change.status === expectedStatus) return proposal;
      if (change.status !== 'pending') throw new WorkspaceError('CHANGE_RESOLVED', '该处已处理；如需撤回已采纳内容，请恢复历史版本。');
      if (action === 'reject') { change.status = 'rejected'; proposalStatus(proposal); await this.store.persist(s); return proposal; }
      for (const ref of proposal.references) {
        if ((await this.readObserved(s, ref.path)).version !== ref.version) throw new WorkspaceError('REFERENCE_CONFLICT', '候选引用的资料已变化，请核对后重新生成候选。');
      }
      const current = await this.readObserved(s, proposal.path);
      const anyAccepted = proposal.changes.some((c) => c.status === 'accepted');
      checkVersion(current.version, !anyAccepted && proposal.baseVersion === null ? null : hash(renderProposal(proposal)));
      await this.store.commit(s, current, renderProposal(proposal, changeId), 'accepted', { proposalId, changeId });
      return proposal;
    });
  }
  search(id: string, input: { query: string; paths?: string[] }) {
    return this.store.run(id, async (s) => {
      const matches: Array<{ path: string; version: string; start: number; end: number; text: string }> = [];
      for (const path of input.paths ?? await this.store.files(s)) {
        const doc = await this.readObserved(s, path);
        if (doc.version === null) continue;
        let from = 0; let start: number;
        while ((start = doc.content.indexOf(input.query, from)) >= 0 && matches.length < 100) {
          const left = doc.content.lastIndexOf('\n', start - 1) + 1;
          const next = doc.content.indexOf('\n', start + input.query.length);
          matches.push({ path, version: doc.version, start, end: start + input.query.length, text: doc.content.slice(left, next < 0 ? undefined : next) });
          from = start + input.query.length;
        }
        if (matches.length >= 100) break;
      }
      return { matches, limit: 100 };
    });
  }
  export(id: string, input: ExportRequest) {
    return this.store.run(id, async (s) => {
      const files: DocumentView[] = [];
      for (const file of input.files) {
        documentPath(file.path);
        if (!file.revisionId) files.push(await this.readObserved(s, file.path));
        else {
          const revision = s.history[file.path]?.find((r) => r.id === file.revisionId) ?? missing();
          files.push({ path: file.path, version: revision.version, content: await this.store.snapshot(s, revision) });
        }
      }
      return { files };
    });
  }
  backup(id: string, destination: string) { return this.store.run(id, (s) => this.store.backup(s, destination)); }
  /** 未决提交只可查看或明确保留当前磁盘，绝不自动重放可能覆盖外部内容的写入。 */
  recovery(id: string): Promise<RecoveryView> {
    return this.store.run(id, async (s) => {
      if (!s.pending) return { pending: null };
      const { writerPid: _internalPid, ...pending } = s.pending;
      return { pending, current: await this.store.read(s, pending.path), intendedContent: await this.store.snapshot(s, pending.revision) };
    }, false);
  }
  keepCurrent(id: string, version: string | null) {
    return this.store.run(id, async (s) => {
      if (!s.pending) return { pending: null };
      const current = await this.store.read(s, s.pending.path);
      checkVersion(current.version, version);
      await this.store.observe(s, current);
      s.pending = null; await this.store.persist(s); return { pending: null };
    }, false);
  }
}
