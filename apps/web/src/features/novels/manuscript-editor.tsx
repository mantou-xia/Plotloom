import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileCheck, History } from 'lucide-react';
import { countManuscriptCharacters, type DocumentView, type ManuscriptView } from '@plotloom/contracts/workspaces';
import { ActionMenu, ActionMenuItem } from '@plotloom/ui/action-menu';
import { ManuscriptPaper } from '@plotloom/ui/manuscript-frame';
import { DocumentEditor } from '@plotloom/ui/document-editor';
import { Button } from '@plotloom/ui/button';
import { MarkdownRenderer } from '@plotloom/ui/markdown';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import { NovelHistory, exportManuscript } from './novel-review';
import { readManuscript } from './novel-api';

interface Draft { baseVersion: string | null; content: string }
export const draftKey = (workspaceId: string, path: string) => 'plotloom:novel-draft:v1:' + JSON.stringify([workspaceId, path]);
const editorText = (content: string) => content.replace(/\r\n?/g, '\n');
const handledDiscards = new WeakSet<ManuscriptView>();

function readDraft(key: string): Draft | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as Draft : null;
  } catch {
    return null;
  }
}

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
function editContent(previous: string, next: string, original: string) {
  const before = editorText(previous);
  let start = 0;
  while (start < before.length && start < next.length && before[start] === next[start]) start += 1;
  let end = 0;
  while (end < before.length - start && end < next.length - start && before.at(-1 - end) === next.at(-1 - end)) end += 1;
  const newline = previous.match(/\r\n|\n|\r/)?.[0] ?? original.match(/\r\n|\n|\r/)?.[0] ?? '\n';
  return previous.slice(0, manuscriptOffset(previous, start))
    + next.slice(start, next.length - end).replaceAll('\n', newline)
    + previous.slice(manuscriptOffset(previous, before.length - end));
}

interface EditorProps {
  workspaceId: string;
  base: string;
  path: string;
  reload: number;
  onRefresh?: () => void;
  onReviewCandidate?: () => void;
  title?: string;
  onSaved?: () => void;
  viewRequest?: ManuscriptView;
}

/** 草稿携带原始版本。重开时遇到外部改稿，仍保留草稿供复制或核对。 */
export function ManuscriptEditor({ workspaceId, base, path, reload, onRefresh, onReviewCandidate, onSaved, title = path, viewRequest }: EditorProps) {
  const key = draftKey(workspaceId, path);
  const [document, setDocument] = useState<DocumentView>();
  const [draft, setDraft] = useState(() => readDraft(key));
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [reading, setReading] = useState(true);
  const viewKey = 'plotloom:chapter-view:' + key;
  const [preview, setPreview] = useState(() => (viewRequest ? viewRequest.mode === 'preview' : sessionStorage.getItem(viewKey) === 'preview'));
  const [priorView, setPriorView] = useState(viewRequest);
  if (viewRequest && viewRequest !== priorView) {
    setPriorView(viewRequest);
    setPreview(viewRequest.mode === 'preview');
  }
  const previewBody = useRef<HTMLElement>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [history, setHistory] = useState(viewRequest?.mode === 'history');
  const [handledView, setHandledView] = useState<ManuscriptView>();
  const documentScroll = useRef<HTMLElement>(null);
  const reader = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const content = draft?.content ?? document?.content ?? '';
  const conflict = !!(draft && document && draft.baseVersion !== document.version);
  const locked = busy || reading || !document;
  const [menuContainer, setMenuContainer] = useState<HTMLDialogElement | null>(null);
  const bindToolbar = useCallback((node: HTMLElement | null) => {
    setMenuContainer(node?.closest('dialog') ?? null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;
    setReading(true);
    void readManuscript(base, path, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        // 刷新可能发生在写入成功、浏览器收到响应之前。内容一致即清理这份已提交草稿。
        const pending = readDraft(key);
        if (pending?.content === value.content) storeDraft(null);
        setDocument(value);
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setDocument(undefined);
      notifyRequestError(cause, 'novel-document');
    }).finally(() => {
      if (!controller.signal.aborted) setReading(false);
    });
    return () => controller.abort();
  }, [base, path, reload, readAttempt, key]);

  // 两种视图独立保留阅读位置；切换回来时正文排版已经完成。
  useLayoutEffect(() => {
    if (reading) return;
    const node = preview ? previewBody.current : documentScroll.current;
    if (node) node.scrollTop = Number(sessionStorage.getItem(viewKey + (preview ? ':preview' : ':edit'))) || 0;
  }, [reading, preview, viewKey]);

  function changeView(next: boolean) {
    setPreview(next);
    sessionStorage.setItem(viewKey, next ? 'preview' : 'edit');
  }

  function storeDraft(next: Draft | null) {
    setDraft(next);
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch (cause) { notifyRequestError(cause, 'novel-draft-storage'); }
  }

  // 请求只处理一次。保留正在提交的文稿，等当前提交结束再处理明确批准的草稿操作。
  useEffect(() => {
    if (!viewRequest || viewRequest === handledView || busy) return;
    setHandledView(viewRequest);
    if (viewRequest.mode === 'history') setHistory(true);
    if (viewRequest.mode === 'discard' && !handledDiscards.has(viewRequest)) {
      handledDiscards.add(viewRequest);
      storeDraft(null);
      setSaveFailed(false);
    }
  }, [viewRequest, handledView, busy]);

  /** 服务端提交结果比此前发起的刷新更新，避免旧读取回填到编辑器。 */
  function applyCommittedDocument(value: DocumentView) {
    reader.current?.abort();
    setReading(false);
    setDocument(value);
    onSaved?.();
  }

  /** 用服务器返回的新版本更新底稿；提交失败时继续保留原草稿。 */
  async function save() {
    if (!document || locked || conflict || saving.current) return;
    saving.current = true;
    setBusy(true);
    const result = await requestJson<DocumentView>(base + '/document', 'PUT', { path, content, baseVersion: document.version })
      .then(value => ({ ok: true as const, value })).catch(cause => {
        notifyRequestError(cause, 'novel-autosave');
        return { ok: false as const };
      });
    saving.current = false;
    setBusy(false);
    if (!result.ok) {
      setSaveFailed(true);
      // 读回磁盘版本，让过期草稿立即进入冲突状态，作者可复制或丢弃草稿。
      setReadAttempt(value => value + 1);
      return;
    }
    // 请求完成前作者可能已切章并重新编辑，旧保存只能清理自己提交的草稿。
    const pending = readDraft(key);
    if (pending?.baseVersion === draft?.baseVersion && pending?.content === draft?.content) storeDraft(null);
    applyCommittedDocument(result.value);
  }

  // 输入法组字还没结束时不自动保存，以免保存中的只读状态打断候选词。
  useEffect(() => {
    if (!draft || locked || conflict || saveFailed || composing) return;
    const timer = setTimeout(() => void save(), 650);
    return () => clearTimeout(timer);
  }, [draft, locked, conflict, saveFailed, composing, document]);

  async function finalize() {
    if (!document?.version || locked || draft) return;
    setBusy(true);
    await runWithToast(() => requestJson(base + '/finalize', 'POST', { path, baseVersion: document.version }),
      { loading: '正在留档…', success: '已留档定稿' });
    setBusy(false);
  }

  function changeDocument(value: string) {
    if (!document) return;
    setSaveFailed(false);
    // 撤销到当前磁盘稿时清理草稿，直接保留磁盘的原始换行。
    if (value === editorText(document.content)) { storeDraft(null); return; }
    const next = editContent(content, value, document.content);
    storeDraft(next === document.content ? null : { content: next, baseVersion: draft ? draft.baseVersion : document.version });
  }

  const status = <div className="plotloom-novel-status">
    <span role="status">{reading ? '正在读取文稿…' : !document ? '读取失败，请刷新重试。' :
      conflict ? '磁盘文稿已有新版本。当前仍显示草稿。' : busy && draft ? '正在保存…' : saveFailed && draft ? '自动保存失败，草稿已保留。' :
        draft ? '未保存草稿' : document.version ? '已保存' : '新文稿'}</span>
    <div className="plotloom-novel-actions">
      <Button variant="ghost" size="sm" style={{ visibility: saveFailed && draft && !conflict ? 'visible' : 'hidden' }}
        disabled={locked} onClick={() => setSaveFailed(false)}>重试</Button>
      <Button variant="ghost" size="sm" style={{ visibility: draft && (conflict || saveFailed) ? 'visible' : 'hidden' }}
        disabled={locked} onClick={() => { storeDraft(null); setSaveFailed(false); }}>丢弃草稿</Button>
    </div>
  </div>;
  // 查看记录与导出正式稿不修改文稿。只有定稿和恢复需要干净且已保存的底稿。
  const hasSavedDocument = !!document?.version;
  const canFinalize = !locked && !draft && hasSavedDocument;
  const count = countManuscriptCharacters(content);

  const editor = <div className="plotloom-manuscript-input">
    <DocumentEditor label="文稿正文" value={editorText(content)} readOnly={locked || conflict}
      scrollRef={documentScroll} onValueChange={changeDocument}
      onBlur={draft && !saveFailed && !composing ? () => void save() : undefined}
      onCompositionChange={setComposing}
      onScroll={top => sessionStorage.setItem(viewKey + ':edit', String(top))} />
    </div>;
  const previewContent = <article className="plotloom-chapter-preview" aria-label="章节预览" ref={previewBody} tabIndex={0}
      onScroll={event => sessionStorage.setItem(viewKey + ':preview', String(event.currentTarget.scrollTop))}>
      <MarkdownRenderer content={content} />
    </article>;
  const historyDialog = history && document ? <NovelHistory base={base} document={document} initialId={viewRequest?.revisionId} canRestore={!locked && !draft} onClose={() => setHistory(false)}
      onRestored={restored => { setHistory(false); applyCommittedDocument(restored); }} /> : null;

  return <section className="plotloom-novel-editor" aria-label="小说编辑器" ref={bindToolbar}>
    <ManuscriptPaper title={title} preview={preview} onPreviewChange={changeView} onRefresh={onRefresh}
      actions={<>
        <Button size="sm" variant="ghost" iconOnly tooltip aria-label="定稿"
          disabled={!canFinalize} onClick={() => void finalize()}><FileCheck /></Button>
        <ActionMenu container={menuContainer} side="bottom" trigger={<Button size="sm" variant="ghost" iconOnly
          aria-label="定稿选项" disabled={!document}><ChevronDown /></Button>}>
          <ActionMenuItem icon={<History />} onSelect={() => setHistory(true)}>定稿记录</ActionMenuItem>
          {onReviewCandidate && <ActionMenuItem onSelect={onReviewCandidate}>审阅本章候选</ActionMenuItem>}
          {path.startsWith('正文章节/') && <ActionMenuItem icon={<Download />} disabled={!hasSavedDocument || !!draft || locked}
            onSelect={() => void exportManuscript(base, path, 'TXT')}>导出 TXT</ActionMenuItem>}
          <ActionMenuItem icon={<Download />} disabled={!hasSavedDocument} onSelect={() => void exportManuscript(base, path)}>导出 Markdown</ActionMenuItem>
        </ActionMenu>
      </>} editor={editor} reading={previewContent}
      footer={<>{status}<span className="plotloom-paper-count" title="含 Markdown 标记，不含空白">{count.toLocaleString('zh-CN')} 字</span></>} />
    {historyDialog}
  </section>;
}
