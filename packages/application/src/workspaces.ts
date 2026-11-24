import { chapterText } from './chapter-text.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter, on } from 'node:events';
import { randomUUID } from 'node:crypto';
import { chapterFromTitle } from '@plotloom/contracts/writing';
import type { ImportedChapter } from './chapter-import.ts';
import { changesFor, checkSelection, checkVersion, documentPath, hash, invalid, manuscriptChanges, missing, proposalStatus, renderProposal, WorkspaceError } from '@plotloom/domain';
import type { DocumentListEntry, DocumentView, ExportRequest, NovelShelfUpdate, PendingCommit, Proposal, ProposalRequest, RecoveryView, Reference, Revision, SaveDocumentRequest, Workspace } from '@plotloom/contracts/workspaces';
import { countManuscriptCharacters, type NovelManuscriptStats } from '@plotloom/contracts/workspaces';

/** 同一工作区队列内的只读视图，用于在正式写入前重新核对作者看过的资料。 */
export interface WorkspaceFileWrite { path: string; operation: 'create' | 'edit'; before: string; after: string }
export interface WorkspaceDocuments {
  listDocuments(): Promise<{ paths: string[] }>;
  readWithCreation(path: string): Promise<DocumentView & { createdAt?: string }>;
}

type CardReminderDecision = 'draft' | 'skipped';
export interface WorkspaceState { cardReminders?: Record<string, CardReminderDecision>; format: 1; workspace: Workspace; history: Record<string, Revision[]>; finalized?: Record<string, Revision[]>; proposals: Proposal[]; pending: (PendingCommit & { writerPid?: number }) | null }
/** 存储负责路径约束、排他提交与恢复；用例负责候选和版本业务规则，HTTP/Pi 共用。 */
export interface WorkspaceStore {
  list(): Promise<Workspace[]>;
  create(title: string, root: string): Promise<Workspace>;
  run<T>(id: string, operation: (state: WorkspaceState) => Promise<T>, recover?: boolean): Promise<T>;
  read(state: WorkspaceState, path: string): Promise<DocumentView>;
  fileLocation(state: WorkspaceState, path: string): Promise<string>;
  listEntries(state: WorkspaceState): Promise<DocumentListEntry[]>;
  files(state: WorkspaceState): Promise<string[]>;
  persist(state: WorkspaceState): Promise<void>;
  snapshot(state: WorkspaceState, revision: Revision): Promise<string>;
  observe(state: WorkspaceState, doc: DocumentView): Promise<void>;
  commit(state: WorkspaceState, doc: DocumentView, content: string, source: Revision['source'], change?: { proposalId: string; changeIds: string[] }, restoredFrom?: string): Promise<Revision>;
  backup(state: WorkspaceState, destination: string): Promise<{ destination: string; files: number }>;
}

/** 无模型、无前端也能完成 Markdown 编辑、候选审阅和历史恢复。 */
export class WorkspaceService {
  private readonly store: WorkspaceStore;
  private readonly chapterReviews = new EventEmitter();
  private readonly writeObserver = new AsyncLocalStorage<(change: WorkspaceFileWrite) => Promise<void>>();
  /** 只有指定聊天工具的异步调用携带观察器，并行的作者保存不会串入聊天记录。 */
  withWriteObserver<T>(observer: (change: WorkspaceFileWrite) => Promise<void>, operation: () => Promise<T>) {
    return this.writeObserver.run(observer, operation);
  }
  private async commit(...args: Parameters<WorkspaceStore['commit']>) {
    const revision = await this.store.commit(...args);
    const [, doc, after] = args;
    await this.writeObserver.getStore()?.({ path: doc.path, operation: doc.version ? 'edit' : 'create', before: doc.content, after });
    return revision;
  }
  private readonly onAcceptedWrite?: (origin: NonNullable<Proposal['origin']>, change: WorkspaceFileWrite) => Promise<void>;
  constructor(store: WorkspaceStore, onAcceptedWrite?: WorkspaceService['onAcceptedWrite']) {
    this.store = store;
    this.onAcceptedWrite = onAcceptedWrite;
  }
  list() { return this.store.list(); }
  /** 逐卷读取本机已记录的版本和采纳决定。只读取存储层快照，不扫描作者磁盘。 */
  async *usageRecords() {
    for (const workspace of await this.list()) {
      const workspaceId = workspace.id;
      const { revisions, proposals } = await this.store.run(workspaceId, async state => ({
        revisions: Object.values(state.history).flat(),
        proposals: state.proposals.map(({ id, path, origin, status, changes }) => ({
          id, path, origin, status, changes: changes.map(({ id, status, revisionId }) => ({ id, status, revisionId })),
        })),
      }));
      yield { type: 'workspace', workspaceId, title: workspace.title };
      for (const proposal of proposals) yield { type: 'proposal', workspaceId, ...proposal };
      for (const revision of revisions) {
        const content = await this.store.run(workspaceId, state => this.store.snapshot(state, revision));
        yield { type: 'document-revision', workspaceId, ...revision, content };
      }
    }
  }
  create(input: { title: string; root: string }) { return this.store.create(input.title, input.root); }
  get(id: string) { return this.store.run(id, async (s) => s.workspace); }
  /** 串行合并此次提交的登记属性。侧栏隐藏只影响分组展示，仍可经书架访问原工作区。 */
  updateShelf(id: string, update: NovelShelfUpdate) {
    return this.store.run(id, async state => {
      const title = update.title === undefined ? state.workspace.title : update.title.trim();
      if (!title || title.length > 200) invalid('小说名称需要 1 至 200 个字符。');
      state.workspace = { ...state.workspace, ...update, title };
      await this.store.persist(state);
      return state.workspace;
    });
  }
  /** 每本书按人物和证据段记住建卡意愿，刷新、换会话及更换摘录都不会重复提醒。 */
  cardReminder(id: string, key: string, decision?: CardReminderDecision) {
    return this.store.run(id, async state => {
      if (decision) {
        (state.cardReminders ??= {})[key] = decision;
        await this.store.persist(state);
      }
      return state.cardReminders?.[key];
    });
  }
  listDocuments(id: string) { return this.store.run(id, async (s) => ({ paths: await this.store.files(s) })); }
  listEntries(id: string) { return this.store.run(id, async state => ({ entries: await this.store.listEntries(state) })); }
  /** 系统操作只接收后端解析后的普通文件，回收前在工作区队列内核对作者选中的版本。 */
  revealDocument(id: string, path: string, reveal: (absolute: string) => Promise<void>) {
    return this.store.run(id, async state => { await reveal(await this.store.fileLocation(state, path)); return { revealed: true }; });
  }
  recycleChapter(id: string, path: string, version: string, recycle: (absolute: string, version: string) => Promise<void>) {
    if (!path.startsWith('正文章节/')) invalid('只能删除正文章节。');
    return this.store.run(id, async state => {
      const absolute = await this.store.fileLocation(state, path);
      const doc = await this.readObserved(state, path);
      checkVersion(doc.version, version);
      await recycle(absolute, version);
      return { recycled: true };
    });
  }
  /** 只统计已落盘的正文，普通刷新不会为读取创建版本快照。 */
  manuscriptStats(id: string): Promise<NovelManuscriptStats> {
    return this.store.run(id, async state => {
      const stats = { chapters: 0, characters: 0 };
      const paths = (await this.store.files(state)).filter(path => path.startsWith('正文章节/'));
      for (const path of paths) {
        const doc = await this.store.read(state, path);
        if (doc.version === null) continue;
        stats.chapters += 1;
        stats.characters += countManuscriptCharacters(doc.content);
      }
      return stats;
    });
  }

  /** 沿用初次存档时间，使编辑或定稿不会改变管理页的阶段创建顺序。 */
  readWithCreation(id: string, path: string) {
    return this.store.run(id, state => this.documentWithCreation(state, path));
  }
  private async documentWithCreation(state: WorkspaceState, path: string) {
    const document = await this.readObserved(state, path);
    const createdAt = state.history[path]?.find(revision => revision.version !== null)?.createdAt;
    return { ...document, createdAt };
  }
  read(id: string, path: string) { return this.store.run(id, (s) => this.readObserved(s, path)); }
  peek(id: string, path: string) { return this.store.run(id, state => this.store.read(state, path)); }
  /** 新章交稿时重查章号、目标和引用，在同一工作区队列内提交。 */
  createWrittenChapter(id: string, number: number, path: string, content: string, references: Reference[], signal?: AbortSignal) {
    return this.store.run(id, async state => {
      const sibling = (await this.store.files(state)).find(file => file.startsWith('正文章节/') &&
        chapterFromTitle(file.split('/').at(-1)!) === number);
      if (sibling) checkVersion('exists', null);
      const current = await this.store.read(state, path);
      checkVersion(current.version, null);
      for (const ref of references) checkVersion((await this.store.read(state, ref.path)).version, ref.version);
      signal?.throwIfAborted();
      await this.commit(state, current, content, 'manual');
      return this.store.read(state, path);
    });
  }
  /** 批量预检和提交共享工作区队列。已导入且内容相同的章节可安全重试。 */
  importChapters(id: string, chapters: readonly ImportedChapter[], signal?: AbortSignal) {
    return this.store.run(id, async state => {
      const paths = (await this.store.files(state)).filter(path => path.startsWith('正文章节/'));
      const toWrite: ImportedChapter[] = [];
      const resolvedPaths: string[] = [];
      for (const chapter of chapters) {
        signal?.throwIfAborted();
        const matches = paths.filter(path => chapterFromTitle(path.split('/').at(-1)!) === chapter.number);
        if (matches.length > 1)
          throw new WorkspaceError('CHAPTER_IMPORT_CONFLICT', `第 ${chapter.number} 章存在多份正文，请先整理文件。`);
        // 重试已按旧格式导入的原稿时，返回原路径供预览，避免生成第二份正文。
        const path = matches[0] ?? chapter.path;
        const current = await this.store.read(state, path);
        if (current.version === null) toWrite.push(chapter);
        else if (current.content !== chapter.content)
          throw new WorkspaceError('CHAPTER_IMPORT_CONFLICT', `${path} 已有不同正文，本次导入未覆盖原稿。`);
        resolvedPaths.push(current.version === null ? chapter.path : path);
      }
      for (const chapter of toWrite) {
        signal?.throwIfAborted();
        await this.commit(state, { path: chapter.path, version: null, content: '' }, chapter.content, 'manual');
      }
      return { imported: toWrite.length, unchanged: chapters.length - toWrite.length, paths: resolvedPaths };
    });
  }
  /** 聊天引用固定版本；使用既有原稿快照，不以最新稿替换用户选中的历史。 */
  readVersion(id: string, path: string, version: string): Promise<DocumentView> {
    return this.store.run(id, async (state) => {
      const current = await this.readObserved(state, path);
      if (current.version === version) return current;
      const revision = state.history[path]?.find(item => item.version === version);
      if (!revision) throw new WorkspaceError('REFERENCE_NOT_FOUND', '指定文档版本不存在，请重新查询文档或历史。', 404);
      return { path, version, content: await this.store.snapshot(state, revision) };
    });
  }
  private async readObserved(state: WorkspaceState, path: string) {
    documentPath(path);
    const doc = await this.store.read(state, path);
    await this.store.observe(state, doc);
    return doc;
  }
  save(id: string, input: SaveDocumentRequest, validate?: (documents: WorkspaceDocuments) => Promise<void>,
    options?: { archivePrevious: boolean; signal?: AbortSignal }) {
    if (!input.content.isWellFormed()) invalid('Markdown 不能含有未配对的 UTF-16 代理字符。');
    return this.store.run(id, async (s) => {
      const current = await this.readObserved(s, input.path);
      checkVersion(current.version, input.baseVersion);
      if (validate) await validate({ listDocuments: async () => ({ paths: await this.store.files(s) }),
        readWithCreation: path => this.documentWithCreation(s, path) });
      if (current.version !== hash(input.content)) {
        options?.signal?.throwIfAborted();
        // 留档和覆盖共用工作区队列，历史先落盘，避免中断时丢失被替换的大纲。
        if (options?.archivePrevious && current.version) await this.archiveRevision(s, current);
        options?.signal?.throwIfAborted();
        await this.commit(s, current, input.content, 'manual');
      }
      return this.store.read(s, input.path);
    });
  }
  history(id: string, path: string) {
    documentPath(path);
    return this.store.run(id, async s => ({ revisions: s.finalized?.[path] ?? [] }));
  }
  /** 复用已观察到的快照；重复归档同一内容不会增加记录。 */
  private async archiveRevision(state: WorkspaceState, current: DocumentView) {
    const records = (state.finalized ??= {})[current.path] ??= [];
    const existing = records.find(item => item.version === current.version);
    if (existing) return existing;
    const snapshot = state.history[current.path].at(-1)!;
    const revision = { ...snapshot, createdAt: new Date().toISOString() };
    records.push(revision);
    await this.store.persist(state);
    return revision;
  }
  /** 只留档经作者确认的当前版本，防止确认期间的手改一并被归档。 */
  finalize(id: string, input: { path: string; baseVersion: string | null }) {
    return this.store.run(id, async s => {
      const current = await this.readObserved(s, input.path);
      checkVersion(current.version, input.baseVersion);
      if (!current.version) missing();
      return this.archiveRevision(s, current);
    });
  }
  restore(id: string, input: { path: string; revisionId: string; baseVersion: string | null }) {
    return this.store.run(id, async (s) => {
      const current = await this.readObserved(s, input.path);
      checkVersion(current.version, input.baseVersion);
      const revision = s.finalized?.[input.path]?.find((r) => r.id === input.revisionId) ?? missing();
      if (revision.version === null) invalid('不存在的文件记录不可作为恢复来源。');
      if (current.version !== revision.version)
        await this.commit(s, current, await this.store.snapshot(s, revision), 'restored', undefined, revision.id);
      return this.store.read(s, input.path);
    });
  }
  proposals(id: string) { return this.store.run(id, async (s) => ({ proposals: s.proposals })); }
  proposal(id: string, proposalId: string) { return this.store.run(id, async (s) => s.proposals.find((p) => p.id === proposalId) ?? missing()); }
  createProposal(id: string, input: ProposalRequest, options?: { origin: Proposal['origin']; signal?: AbortSignal; chapterProposalId?: string }) {
    if (!input.content.isWellFormed()) invalid('Markdown 不能含有未配对的 UTF-16 代理字符。');
    return this.store.run(id, async (s) => {
      options?.signal?.throwIfAborted();
      const base = await this.readObserved(s, input.path);
      checkVersion(base.version, input.baseVersion);
      if (input.selection) checkSelection(base.content, input.selection);
      const references = input.references ?? [];
      if (new Set(references.map((r) => r.path)).size !== references.length || references.some((r) => r.path === input.path)) invalid('参考资料不可重复或包含候选目标文件。');
      for (const ref of references) checkVersion((await this.readObserved(s, ref.path)).version, ref.version);
      // 交稿时可以先展示设定建议。采纳时仍要求对应章节候选已成为同版本正式稿。
      if (options?.chapterProposalId) {
        const chapter = s.proposals.find(p => p.id === options.chapterProposalId && p.status === 'pending') ?? missing();
        checkVersion((await this.readObserved(s, chapter.path)).version, chapter.baseVersion);
        references.push({ path: chapter.path, version: hash(chapter.content) });
      }
      const selection = input.selection;
      const before = selection?.text ?? base.content;
      const changes = /^(正文章节|大纲)\//u.test(input.path) ? manuscriptChanges(before, input.content, selection?.start)
        : changesFor(before, input.content, selection?.start ?? 0);
      if (!changes.length) invalid('候选没有实际修改。');
      const proposal: Proposal = { id: randomUUID(), path: input.path, baseVersion: base.version, baseContent: base.content,
        content: selection ? base.content.slice(0, selection.start) + input.content + base.content.slice(selection.end) : input.content,
        changes, references, createdAt: new Date().toISOString(), status: 'pending', ...(options?.origin ? { origin: options.origin } : {}) };
      // 工具可能在工作区队列等待期间被停止；落候选前再次检查，不写入迟到产物。
      options?.signal?.throwIfAborted();
      s.proposals.push(proposal); await this.store.persist(s); return proposal;
    });
  }
  /** 正式提交只在显式采纳用例执行；模型适配只能调用 createProposal。 */
  /** 先订阅再读快照，连点采纳也不会错过最后一次决定。停止聊天即解除等待。 */
  async waitForChapterReview(id: string, proposalId: string, signal?: AbortSignal): Promise<Proposal> {
    signal?.throwIfAborted();
    const decisions = on(this.chapterReviews, proposalId, { signal });
    try {
      const proposal = await this.proposal(id, proposalId);
      if (proposal.status !== 'pending' && proposal.status !== 'partial') return proposal;
      const { value } = await decisions.next();
      return value![0] as Proposal;
    } finally { await decisions.return!(); }
  }
  decide(id: string, proposalId: string, changeId: string, action: 'accept' | 'reject') {
    return this.decideProposal(id, proposalId, action, changeId);
  }

  /** 批量处理只影响待决定差异，在同一工作区锁内取范围、校验版本并一次提交。 */
  decideProposal(id: string, proposalId: string, action: 'accept' | 'reject', changeId?: string) {
    return this.store.run(id, async (s) => {
      const proposal = s.proposals.find((p) => p.id === proposalId) ?? missing();
      const change = changeId === undefined ? undefined : proposal.changes.find(c => c.id === changeId) ?? missing();
      if (change && change.status !== 'pending') {
        if (change.status === (action === 'accept' ? 'accepted' : 'rejected')) return proposal;
        throw new WorkspaceError('CHANGE_RESOLVED', '该处已处理；如需撤回已采纳内容，请恢复历史版本。');
      }
      const targets = change ? [change] : proposal.changes.filter(c => c.status === 'pending');
      if (!targets.length) return proposal;
      if (action === 'reject') {
        for (const target of targets) target.status = 'rejected';
        proposalStatus(proposal); await this.store.persist(s); return proposal;
      }
      for (const ref of proposal.references) {
        if ((await this.readObserved(s, ref.path)).version !== ref.version) throw new WorkspaceError('REFERENCE_CONFLICT', '候选引用的资料已变化，请核对后重新生成候选。');
      }
      const current = await this.readObserved(s, proposal.path);
      const anyAccepted = proposal.changes.some((c) => c.status === 'accepted');
      checkVersion(current.version, !anyAccepted && proposal.baseVersion === null ? null : hash(renderProposal(proposal)));
      const changeIds = targets.map(target => target.id);
      const after = renderProposal(proposal, new Set(changeIds));
      await this.commit(s, current, after, 'accepted', { proposalId, changeIds });
      // 工作台可跨轮次或重启后采纳。工具内采纳由当前工具记录，作者手动采纳归回候选来源。
      if (proposal.origin && !this.writeObserver.getStore())
        await this.onAcceptedWrite?.(proposal.origin, { path: current.path, operation: current.version ? 'edit' : 'create', before: current.content, after });
      return proposal;
    }).then(proposal => {
      if (proposal.status !== 'pending' && proposal.status !== 'partial') this.chapterReviews.emit(proposalId, proposal);
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
  /** 两个入口共用这一用例，导出只读本书正文章节，候选和浏览器草稿不参与转换。 */
  async exportChapterText(id: string, path: string) {
    documentPath(path);
    if (!path.startsWith('正文章节/')) invalid('TXT 导出需要本书正文章节目录内的文稿。');
    const doc = await this.peek(id, path);
    if (doc.version === null) missing();
    return { filename: path.split('/').at(-1)!.replace(/\.md$/, '.txt'), content: chapterText(doc.content), version: doc.version };
  }
  export(id: string, input: ExportRequest) {
    return this.store.run(id, async (s) => {
      const files: DocumentView[] = [];
      for (const file of input.files) {
        documentPath(file.path);
        if (!file.revisionId) files.push(await this.readObserved(s, file.path));
        else {
          const revision = s.finalized?.[file.path]?.find((r) => r.id === file.revisionId) ?? missing();
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
