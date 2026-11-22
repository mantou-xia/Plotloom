import { open, mkdir, rmdir, readFile, readdir, realpath, lstat, rename, rm, writeFile, cp } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { WorkspaceState, WorkspaceStore } from '@plotloom/application';
import type { DocumentView, PendingCommit, Revision, Workspace } from '@plotloom/contracts/workspaces';
import { checkVersion, documentPath, hash, invalid, missing, proposalStatus, requireId, WorkspaceError } from '@plotloom/domain';

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT';
const isInside = (parent: string, child: string) => { const r = relative(parent.toLowerCase(), child.toLowerCase()); return r === '' || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r)); };
const overlaps = (a: string, b: string) => isInside(a, b) || isInside(b, a);
const novelFolders = ['大纲', '正文章节', '角色卡'] as const;
const ignored = new Set(['.git', 'node_modules', '.plotloom']);

/** 单作者服务串行管理元数据；正式内容每次读磁盘。快照与候选状态不替代当前文件。 */
export class FileWorkspaceStore implements WorkspaceStore {
  private readonly data: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(dataDir: string) { this.data = resolve(dataDir, 'novels'); }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation); this.queue = next.catch(() => {}); return next;
  }
  private directory(id: string) { requireId(id); return join(this.data, id); }
  private async load(id: string): Promise<WorkspaceState> {
    let raw: string;
    try { raw = await readFile(join(this.directory(id), 'state.json'), 'utf8'); }
    catch (e) { if (isMissing(e)) missing(); throw e; }
    const state: WorkspaceState = JSON.parse(raw);
    if (state.format !== 1 || state.workspace.id !== id) throw new WorkspaceError('ASSET_INVALID', '工作区元数据无效，请检查备份。', 500);
    return state;
  }
  private async all(): Promise<Workspace[]> {
    await mkdir(this.data, { recursive: true });
    const entries = await readdir(this.data, { withFileTypes: true });
    const result: Workspace[] = [];
    for (const entry of entries) if (entry.isDirectory()) result.push((await this.load(entry.name)).workspace);
    return result;
  }
  list() { return this.serial(() => this.all()); }
  /** 两个入口共享串行建书流程，空目录检查包含隐藏文件，失败时仅撤回本次初始化。 */
  create(title: string, root: string) {
    return this.serial(async () => {
      if (!title.trim() || title.length > 200 || !isAbsolute(root)) invalid('名称不能为空，工作区必须是已存在目录的绝对路径。');
      let canonical: string;
      try {
        if ((await lstat(root)).isSymbolicLink() || !(await lstat(root)).isDirectory()) invalid('工作区必须是普通目录。');
        canonical = await realpath(root);
      } catch (e) { if (isMissing(e)) invalid('工作区目录不存在，请先在本机创建。'); throw e; }
      if (overlaps(canonical, await realpath(dirname(this.data)))) invalid('工作区不能与应用内部数据目录重叠。');
      const existing = await this.all();
      if (existing.some((w) => overlaps(w.root, canonical))) throw new WorkspaceError('WORKSPACE_OVERLAP', '目录已登记或与已登记工作区嵌套，请使用独立目录。');
      if ((await readdir(canonical)).length) throw new WorkspaceError('WORKSPACE_NOT_EMPTY', '请选择空文件夹，新建小说需要初始化目录。');
      const workspace: Workspace = { id: randomUUID(), title: title.trim(), root: canonical, createdAt: new Date().toISOString() };
      const created: string[] = [];
      try {
        for (const name of novelFolders) {
          const folder = join(canonical, name);
          await mkdir(folder);
          created.push(folder);
        }
        await mkdir(join(this.directory(workspace.id), 'revisions'), { recursive: true });
        await this.persist({ format: 1, workspace, history: {}, proposals: [], pending: null });
      } catch (error) {
        // rmdir 只移除空目录，保留初始化期间由作者加入的文件。
        await Promise.allSettled(created.map(folder => rmdir(folder)));
        await rm(this.directory(workspace.id), { recursive: true, force: true });
        throw error;
      }
      return workspace;
    });
  }
  run<T>(id: string, operation: (state: WorkspaceState) => Promise<T>, recover = true): Promise<T> {
    return this.serial(async () => {
      const state = await this.load(id);
      // Windows 不会随父进程强退而自动结束写入子进程；先等旧写者退出，不能提前判定未提交。
      if (state.pending?.writerPid) {
        let running = false;
        try { process.kill(state.pending.writerPid, 0); running = true; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e; }
        if (running) throw new WorkspaceError('FILE_BUSY', '上次文件提交进程尚未结束，请稍后重新查询。');
      }
      if (recover && state.pending) await this.recover(state);
      return operation(state);
    });
  }
  /** 检查每层真实目录，不跟随符号链接/联接；同一 Windows 文件只允许磁盘上的规范拼写。 */
  private async target(state: WorkspaceState, path: string, createParents = false): Promise<string> {
    documentPath(path);
    let current = state.workspace.root;
    try {
      if ((await lstat(current)).isSymbolicLink() || (await realpath(current)).toLowerCase() !== current.toLowerCase()) invalid('工作区目录发生重定向，请重新登记。');
      const parts = path.split('/');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (ignored.has(part.toLowerCase())) invalid('不可访问工作区内部管理目录。');
        let siblings: string[] = [];
        try { siblings = await readdir(current); } catch (e) { if (!isMissing(e)) throw e; }
        const alias = siblings.find((name) => name.toLowerCase() === part.toLowerCase());
        if (alias && alias !== part) invalid('文件路径大小写需与磁盘实际名称一致。');
        current = join(current, part);
        try {
          const stat = await lstat(current);
          if (stat.isSymbolicLink()) invalid('不可通过符号链接或目录联接访问资料。');
          if (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) invalid('文档路径不是普通 Markdown 文件。');
        } catch (e) {
          if (!isMissing(e)) throw e;
          if (createParents && i < parts.length - 1) await mkdir(current);
        }
      }
      return current;
    } catch (e) { if (isMissing(e)) throw new WorkspaceError('WORKSPACE_UNAVAILABLE', '工作区目录不可用，请检查本机目录。', 409); throw e; }
  }
  async fileLocation(state: WorkspaceState, path: string) {
    const absolute = await this.target(state, path);
    try { if (!(await lstat(absolute)).isFile()) missing(); }
    catch (error) { if (isMissing(error)) missing(); throw error; }
    return absolute;
  }
  /** 只读文件开头供目录预览，大目录不传整书正文，也不为列表读取创建历史快照。 */
  async listEntries(state: WorkspaceState) {
    const entries = [];
    for (const path of await this.files(state)) {
      const absolute = await this.target(state, path);
      const file = await open(absolute, 'r').catch(e => { if (!isMissing(e)) throw e; });
      if (!file) continue;
      try {
        const info = await file.stat();
        const buffer = Buffer.alloc(2048);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        const excerpt = buffer.subarray(0, bytesRead).toString('utf8').replace(/<!--[^]*?(?:-->|$)/g, '').replace(/^#{1,6}\s+.*$/gm, '').trim().replace(/\s+/g, ' ').slice(0, 160);
        entries.push({ path, modifiedAt: info.mtime.toISOString(), excerpt });
      } finally { await file.close(); }
    }
    return entries;
  }
  async read(state: WorkspaceState, path: string): Promise<DocumentView> {
    const target = await this.target(state, path);
    try {
      const bytes = await readFile(target);
      let content: string;
      try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { throw new WorkspaceError('ENCODING_UNSUPPORTED', '文档不是有效 UTF-8，请在外部编辑器转换编码后重试。', 422); }
      return { path, content, version: hash(content) };
    } catch (e) { if (isMissing(e)) return { path, content: '', version: null }; throw e; }
  }
  async files(state: WorkspaceState): Promise<string[]> {
    await this.target(state, '__probe__.md');
    const result: string[] = [];
    const walk = async (prefix: string) => {
      for (const entry of await readdir(join(state.workspace.root, prefix), { withFileTypes: true })) {
        if (entry.isSymbolicLink() || ignored.has(entry.name.toLowerCase())) continue;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && entry.name.endsWith('.md')) { documentPath(path); result.push(path); }
      }
    };
    await walk(''); return result.sort();
  }
  /** 元数据在同目录落临时文件、flush、rename；异常只清理本次临时文件。 */
  async persist(state: WorkspaceState): Promise<void> {
    const target = join(this.directory(state.workspace.id), 'state.json');
    const temporary = `${target}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(state), { flag: 'wx', flush: true }); await rename(temporary, target); }
    finally { await rm(temporary, { force: true }); }
  }
  async snapshot(state: WorkspaceState, revision: Revision): Promise<string> {
    requireId(revision.id);
    return revision.version === null ? '' : readFile(join(this.directory(state.workspace.id), 'revisions', `${revision.id}.md`), 'utf8');
  }
  private async saveSnapshot(state: WorkspaceState, revision: Revision, content: string) {
    if (revision.version !== null) await writeFile(join(this.directory(state.workspace.id), 'revisions', `${revision.id}.md`), content, { flag: 'wx', encoding: 'utf8', flush: true });
  }
  async observe(state: WorkspaceState, doc: DocumentView): Promise<void> {
    const history = state.history[doc.path] ?? [];
    if ((!history.length && doc.version === null) || history.at(-1)?.version === doc.version) return;
    const revision: Revision = { id: randomUUID(), path: doc.path, version: doc.version, source: 'observed', createdAt: new Date().toISOString() };
    await this.saveSnapshot(state, revision, doc.content);
    state.history[doc.path] = [...history, revision]; await this.persist(state);
  }
  private finalize(state: WorkspaceState) {
    const pending = state.pending!;
    (state.history[pending.path] ??= []).push(pending.revision);
    if (pending.proposalId) {
      const proposal = state.proposals.find((p) => p.id === pending.proposalId)!;
      const change = proposal.changes.find((c) => c.id === pending.changeId)!;
      change.status = 'accepted'; change.revisionId = pending.revision.id; proposalStatus(proposal);
    }
    state.pending = null;
  }
  private async recover(state: WorkspaceState) {
    const pending = state.pending!;
    const current = await this.read(state, pending.path);
    if (current.version === pending.afterVersion) this.finalize(state);
    else if (current.version === pending.beforeVersion) state.pending = null;
    else throw new WorkspaceError('COMMIT_UNCERTAIN', '上次文件提交未确认且磁盘另有变化；请查看工作区恢复信息，核对后显式保留当前磁盘。');
    await this.persist(state);
  }
  async commit(state: WorkspaceState, doc: DocumentView, content: string, source: Revision['source'], change?: { proposalId: string; changeId: string }, restoredFrom?: string): Promise<Revision> {
    if (process.platform !== 'win32') throw new WorkspaceError('PLATFORM_UNSUPPORTED', '当前文件提交仅在 Windows 验证，其他平台暂不启用写入。', 422);
    const target = await this.target(state, doc.path, true);
    // 先保存两边内容及意图，再触碰正式稿；进程中断不会使候选的处理状态丢失依据。
    const revision: Revision = { id: randomUUID(), path: doc.path, version: hash(content), source, createdAt: new Date().toISOString(), ...(restoredFrom ? { restoredFrom } : {}) };
    await this.saveSnapshot(state, revision, content);
    const pending: PendingCommit = { path: doc.path, beforeVersion: doc.version, afterVersion: revision.version!, revision, ...change };
    state.pending = pending; await this.persist(state);
    const status = await this.writeLocked(state, target, doc.version, content);
    if (status !== 'ok') {
      if (status !== 'uncertain') { state.pending = null; await this.persist(state); }
      if (status === 'conflict') checkVersion('changed', doc.version);
      if (status === 'busy') throw new WorkspaceError('FILE_BUSY', '文件已被其他程序写入、替换或占用；请重新读取后重试。');
      if (status === 'denied') throw new WorkspaceError('FILE_UNWRITABLE', '无法打开文件进行写入，请检查文件权限与工作区目录。');
      throw new WorkspaceError('COMMIT_UNCERTAIN', '文件提交未完成确认；请查看工作区恢复信息。');
    }
    this.finalize(state); await this.persist(state); return revision;
  }
  /** 仅传固定脚本路径，业务内容经 stdin JSON 传递，避免文稿被 PowerShell 当成代码。 */
  private writeLocked(state: WorkspaceState, path: string, expected: string | null, content: string): Promise<string> {
    const script = fileURLToPath(new URL('./commit-markdown.ps1', import.meta.url)).replaceAll("'", "''");
    return new Promise((resolveStatus) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & ([ScriptBlock]::Create([IO.File]::ReadAllText('${script}', [Text.Encoding]::UTF8)))`], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = ''; const timer = setTimeout(() => child.kill(), 15000);
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.resume(); child.stdin.on('error', () => {});
      child.once('error', () => { clearTimeout(timer); resolveStatus('uncertain'); });
      child.once('close', () => { clearTimeout(timer); try { resolveStatus(JSON.parse(output.replace(/^\uFEFF/, '').trim()).status); } catch { resolveStatus('uncertain'); } });
      // Windows PowerShell 默认 stdin 编码随主机变化，使用 ASCII JSON Unicode 转义，确保中文和 emoji 原样解码。
      child.once('spawn', () => {
        // 先登记进程，再发送写入指令。此前父进程退出会使 stdin 为空，子进程不会触碰正式稿。
        state.pending!.writerPid = child.pid;
        void this.persist(state).then(() => {
          child.stdin.end(JSON.stringify({ path, expected, content }).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
        }).catch(() => { child.kill(); resolveStatus('uncertain'); });
      });
    });
  }
  async backup(state: WorkspaceState, destination: string) {
    if (!isAbsolute(destination)) invalid('备份目标必须是尚不存在的绝对目录。');
    const parent = await realpath(dirname(destination));
    const target = join(parent, destination.split(/[\\/]/).at(-1)!);
    if (overlaps(target, state.workspace.root) || overlaps(target, dirname(this.data))) invalid('备份目录不能与作品或内部数据目录重叠。');
    try { await mkdir(target); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new WorkspaceError('BACKUP_EXISTS', '备份目标已存在，请指定新目录。'); throw e; }
    for (const name of novelFolders) await mkdir(join(target, 'manuscripts', name), { recursive: true });
    const paths = await this.files(state);
    for (const path of paths) {
      const doc = await this.read(state, path); await this.observe(state, doc);
      if (doc.version === null) throw new WorkspaceError('REVISION_CONFLICT', '备份期间文件已移除，请使用新目标重试。');
      const output = join(target, 'manuscripts', path); await mkdir(dirname(output), { recursive: true }); await writeFile(output, doc.content, { flag: 'wx', encoding: 'utf8' });
    }
    await cp(this.directory(state.workspace.id), join(target, 'metadata'), { recursive: true, force: false, errorOnExist: true });
    await writeFile(join(target, 'README.md'), '# Plotloom 资产备份\n\nmanuscripts 是真实 Markdown，可直接打开。metadata 保存历史快照及候选状态，恢复完整资产时停服，将 metadata 放回服务数据目录 novels/<工作区ID>，并将 state.json 的 workspace.root 改为恢复后的 manuscripts 绝对路径。请先备份现有服务数据。此备份不含 Pi 聊天、模型配置或凭据。\n', 'utf8');
    return { destination: target, files: paths.length };
  }
}
