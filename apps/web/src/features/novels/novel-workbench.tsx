import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentView, Proposal, Selection, Workspace } from '@plotloom/contracts/workspaces';
import { ArrowLeft, FilePlus2, RefreshCw } from 'lucide-react';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { Textarea } from '@plotloom/ui/textarea';
import { Select } from '@plotloom/ui/select';
import { Dialog } from '@plotloom/ui/dialog';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import { NovelWriting } from './novel-writing';
import { NovelHistory, NovelProposals, exportManuscript } from './novel-review';
import { readManuscript } from './novel-api';

interface Draft { baseVersion: string | null; content: string }
const draftKey = (workspaceId: string, path: string) => 'plotloom:novel-draft:v1:' + JSON.stringify([workspaceId, path]);
const pathKey = (workspaceId: string) => 'plotloom:novel-path:v1:' + workspaceId;
const editorText = (content: string) => content.replace(/\r\n?/g, '\n');

/** 文本框将 CRLF 折成一字符；服务端选区与原文版本使用磁盘 UTF-16 偏移。 */
function manuscriptOffset(content: string, offset: number) {
  let result = offset;
  for (const match of content.matchAll(/\r\n/g)) {
    if (match.index >= result) break;
    result += 1;
  }
  return result;
}

/** 只替换文本框此次编辑的区间，避免读取或编辑时改写未触及的行尾。 */
function editContent(previous: string, next: string) {
  const before = editorText(previous);
  let start = 0;
  while (start < before.length && start < next.length && before[start] === next[start]) start += 1;
  let end = 0;
  while (end < before.length - start && end < next.length - start && before.at(-1 - end) === next.at(-1 - end)) end += 1;
  const newline = previous.match(/\r\n|\n|\r/)?.[0] ?? '\n';
  return previous.slice(0, manuscriptOffset(previous, start))
    + next.slice(start, next.length - end).replaceAll('\n', newline)
    + previous.slice(manuscriptOffset(previous, before.length - end));
}

interface WorkbenchProps {
  workspace: Workspace;
  onBack: () => void;
  onSessionsChange: () => Promise<void>;
  onOpenChat: (id: string) => void;
}

/** 文稿和候选以公开接口为真源，工作台只保留当前路径和手工草稿。 */
export function NovelWorkbench({ workspace, onBack, onSessionsChange, onOpenChat }: WorkbenchProps) {
  const base = '/api/workspaces/' + encodeURIComponent(workspace.id);
  const [paths, setPaths] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [path, setPath] = useState(() => localStorage.getItem(pathKey(workspace.id)) ?? '');
  const [newPath, setNewPath] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const refreshId = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const id = ++refreshId.current;
    const [files, candidates] = await Promise.all([
      requestJson<{ paths: string[] }>(base + '/documents', 'GET', undefined, signal),
      requestJson<{ proposals: Proposal[] }>(base + '/proposals', 'GET', undefined, signal),
    ]);
    if (id !== refreshId.current || signal?.aborted) return;
    setPaths(files.paths);
    setProposals(candidates.proposals);
    setPath(current => current || files.paths[0] || '');
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(cause => notifyRequestError(cause, 'novel-list'));
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => { if (path) localStorage.setItem(pathKey(workspace.id), path); }, [path, workspace.id]);

  return <PageLayout title={workspace.title} style={{ height: '100%' }} actions={<>
    <Button variant="ghost" startIcon={<ArrowLeft />} onClick={onBack}>全部小说</Button>
    <Button variant="secondary" startIcon={<RefreshCw />} onClick={() => {
      setReload(value => value + 1);
      void refresh().catch(cause => notifyRequestError(cause, 'novel-list'));
    }}>刷新</Button>
    <Button startIcon={<FilePlus2 />} onClick={() => setNewPath('')}>新建文稿</Button>
  </>}>
    <div className="plotloom-novel-columns">
      <aside aria-label="小说文稿" className="plotloom-novel-files">
        <h2>文稿</h2>
        {paths.length ? <ul>{paths.map(file => <li key={file}>
          <Button variant="ghost" size="sm" aria-current={file === path ? 'true' : undefined} onClick={() => setPath(file)}>{file}</Button>
        </li>)}</ul> : <p className="plotloom-novel-muted">暂无已保存文稿</p>}
        <NovelProposals base={base} proposals={proposals} onDecision={(updated, action) => {
          setProposals(current => current.map(proposal => proposal.id === updated.id ? updated : proposal));
          if (action === 'accept' && updated.path === path) setReload(value => value + 1);
          void refresh().catch(cause => notifyRequestError(cause, 'novel-list'));
        }} />
      </aside>
      {path ? <ManuscriptEditor key={path} workspaceId={workspace.id} base={base} path={path} paths={paths} reload={reload}
        onSaved={() => void refresh().catch(cause => notifyRequestError(cause, 'novel-list'))}
        onSessionsChange={onSessionsChange} onOpenChat={onOpenChat} /> :
        <p className="plotloom-novel-muted">打开一篇文稿，或新建章节、角色卡及大纲。</p>}
    </div>
    {newPath !== null ? <Dialog open title="新建 Markdown 文稿" onOpenChange={open => { if (!open) setNewPath(null); }}
      footer={<><Button variant="ghost" onClick={() => setNewPath(null)}>取消</Button>
        <Button disabled={!/\.md$/i.test(newPath.trim())} onClick={() => {
          setPath(newPath.trim());
          setNewPath(null);
        }}>打开文稿</Button></>}>
      <Input autoFocus aria-label="文稿相对路径" value={newPath} onValueChange={setNewPath} placeholder="例如 章节/第一章.md" />
    </Dialog> : null}
  </PageLayout>;
}

interface EditorProps {
  workspaceId: string;
  base: string;
  path: string;
  paths: string[];
  reload: number;
  onSaved: () => void;
  onSessionsChange: () => Promise<void>;
  onOpenChat: (id: string) => void;
}

/** 草稿携带原始版本。重开时遇到外部改稿，仍保留草稿供复制或核对。 */
function ManuscriptEditor({ workspaceId, base, path, paths, reload, onSaved, onSessionsChange, onOpenChat }: EditorProps) {
  const key = draftKey(workspaceId, path);
  const [document, setDocument] = useState<DocumentView>();
  const [draft, setDraft] = useState<Draft | null>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) as Draft : null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(true);
  const [history, setHistory] = useState(false);
  const [saveAs, setSaveAs] = useState('document');
  const [selection, setSelection] = useState<Selection>();
  const input = useRef<HTMLTextAreaElement>(null);
  const reader = useRef<AbortController | null>(null);
  const content = draft?.content ?? document?.content ?? '';
  const conflict = !!(draft && document && draft.baseVersion !== document.version);
  const locked = busy || reading || !document;

  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
    setReading(true);
    void readManuscript(base, path, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setDocument(value);
        setSelection(undefined);
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setDocument(undefined);
      notifyRequestError(cause, 'novel-document');
    }).finally(() => {
      if (!controller.signal.aborted) setReading(false);
    });
    return () => controller.abort();
  }, [base, path, reload]);

  function storeDraft(next: Draft | null) {
    setDraft(next);
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch (cause) { notifyRequestError(cause, 'novel-draft-storage'); }
  }

  /** 服务端提交结果比此前发起的刷新更新，避免旧读取回填到编辑器。 */
  function applyCommittedDocument(value: DocumentView) {
    reader.current?.abort();
    setReading(false);
    setDocument(value);
    setSelection(undefined);
    onSaved();
  }

  /** 用服务器返回的新版本更新底稿；提交失败时继续保留原草稿。 */
  async function save() {
    if (!document || locked || conflict) return;
    setBusy(true);
    const result = await runWithToast(() => requestJson<DocumentView>(base + (saveAs === 'outline' ? '/outlines' : '/document'),
      saveAs === 'outline' ? 'POST' : 'PUT', { path, content, baseVersion: document.version }),
    { loading: '正在保存文稿…', success: '已保存文稿' });
    setBusy(false);
    if (!result.ok) return;
    storeDraft(null);
    applyCommittedDocument(result.value);
  }

  function selectText() {
    const node = input.current;
    if (!node || node.selectionStart === node.selectionEnd) {
      setSelection(undefined);
      return;
    }
    const start = manuscriptOffset(content, node.selectionStart);
    const end = manuscriptOffset(content, node.selectionEnd);
    setSelection({ start, end, text: content.slice(start, end) });
  }

  return <section className="plotloom-novel-editor" aria-label="小说编辑器">
    <h2>{path}</h2>
    <div className="plotloom-novel-actions">
      <Select aria-label="保存类型" searchable={false} clearable={false} size="sm" value={saveAs}
        options={[{ value: 'document', label: 'Markdown 文稿' }, { value: 'outline', label: '正式大纲' }]}
        onValueChange={value => setSaveAs(value ?? 'document')} disabled={locked} />
      <Button size="sm" disabled={locked || conflict || (!draft && document.version !== null)}
        loading={busy} onClick={() => void save()}>保存</Button>
      <Button size="sm" variant="secondary" disabled={locked || !!draft || !document.version} onClick={() => setHistory(true)}>历史版本</Button>
      <Button size="sm" variant="secondary" disabled={locked || !document.version} onClick={() => void exportManuscript(base, path)}>导出 Markdown</Button>
    </div>
    <div className="plotloom-novel-status">
      <span role="status">{reading ? '正在读取文稿…' : !document ? '读取失败，请刷新重试。' :
        conflict ? '磁盘文稿已有新版本。当前仍显示草稿。' : draft ? '未保存草稿' : document.version ? '已保存' : '新文稿'}</span>
      <Button variant="ghost" size="sm" style={{ visibility: draft ? 'visible' : 'hidden' }}
        disabled={locked} onClick={() => { storeDraft(null); setSelection(undefined); }}>丢弃草稿</Button>
    </div>
    <Textarea ref={input} aria-label="Markdown 正文" className="plotloom-novel-text" rows={16} readOnly={locked || conflict}
      value={editorText(content)} onSelect={selectText} onValueChange={value => {
        if (!document) return;
        const next = editContent(content, value);
        setSelection(undefined);
        storeDraft(next === document.content ? null : { content: next, baseVersion: draft ? draft.baseVersion : document.version });
      }} />
    <NovelWriting workspaceId={workspaceId} base={base} path={path} paths={paths} document={document}
      selection={selection} disabled={locked || !!draft} onSettled={onSaved}
      onSessionsChange={onSessionsChange} onOpenChat={onOpenChat} />
    {history && document ? <NovelHistory base={base} document={document} onClose={() => setHistory(false)}
      onRestored={restored => { setHistory(false); applyCommittedDocument(restored); }} /> : null}
  </section>;
}
