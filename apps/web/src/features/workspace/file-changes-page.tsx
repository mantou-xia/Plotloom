import { useEffect, useId, useRef, useState, type Ref } from 'react';
import type { ProjectFileChange, ProjectFileDiff } from '@plotloom/contracts';
import { FileChangeRow, FileChangesFrame } from '@plotloom/ui/file-changes-frame';
import { requestJson } from '../../utils/http';

const noSelection: ReadonlySet<string> = new Set();

/** 展开时按记录 ID 请求单次写入；收起或离开会话会取消请求。 */
function FileChange({ change, endpoint, open, onToggle, rowRef }: {
  change: ProjectFileChange; endpoint: string; open: boolean; onToggle: () => void; rowRef?: Ref<HTMLLIElement>;
}) {
  const [diff, setDiff] = useState<ProjectFileDiff>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const panelId = useId();
  useEffect(() => {
    if (!open || diff) return;
    const abort = new AbortController();
    setError('');
    void requestJson<ProjectFileDiff>(`${endpoint}/${encodeURIComponent(change.id)}`, 'GET', undefined, abort.signal)
      .then(value => { if (!abort.signal.aborted) setDiff(value); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '对比加载失败。'); });
    return () => abort.abort();
  }, [open, diff, change.id, endpoint, retry]);
  return <FileChangeRow change={change} diff={diff} open={open} onToggle={onToggle} rowRef={rowRef}
    panelId={panelId} error={error} onRetry={() => setRetry(value => value + 1)} />;
}

/** 列表按写入顺序追加；聊天更新时间变化时刷新，避免中途关掉用户正在查看的对比。 */
export function FileChangesPage({ sessionId, revision, writeIds, selection = noSelection }: {
  sessionId: string | null; revision?: string; writeIds?: readonly string[]; selection?: ReadonlySet<string>;
}) {
  const [records, setRecords] = useState<ProjectFileChange[]>();
  const [expansion, setExpansion] = useState({ selection, openIds: selection });
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedRow = useRef<HTMLLIElement>(null);
  // 新的入口点击重置展开状态，保留已加载的写入明细供再次打开。
  if (selection !== expansion.selection) setExpansion({ selection, openIds: selection });
  const scope = writeIds ? new Set(writeIds) : null;
  const changes = scope ? records?.filter(change => scope.has(change.id)) : records;
  const selectedId = changes?.find(change => selection.has(change.id))?.id;
  useEffect(() => {
    if (selectedId) selectedRow.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    else if (selection !== noSelection && contentRef.current) contentRef.current.scrollTop = 0;
  }, [selectedId, selection]);

  /** 同一工作区可独立展开各条写入记录，直至重新从摘要进入。 */
  function toggleWrite(id: string) {
    setExpansion(current => {
      const openIds = new Set(current.openIds);
      if (openIds.has(id)) openIds.delete(id);
      else openIds.add(id);
      return { ...current, openIds };
    });
  }
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const endpoint = sessionId ? `/api/sessions/${encodeURIComponent(sessionId)}/project-writes` : '';
  useEffect(() => {
    if (!endpoint) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    void requestJson<{ changes: ProjectFileChange[] }>(endpoint, 'GET', undefined, abort.signal)
      .then(value => { if (!abort.signal.aborted) setRecords(value.changes); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '文件修改记录加载失败。'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [endpoint, revision, refresh]);
  return <FileChangesFrame title={writeIds ? '本轮文件修改' : 'Agent 文件修改'} contentRef={contentRef}
    error={error} loading={loading} count={changes?.length} onRefresh={sessionId ? () => setRefresh(value => value + 1) : undefined}>
      {changes?.length ? <ul>{changes.map(change => <FileChange key={change.id} change={change} endpoint={endpoint}
        open={expansion.openIds.has(change.id)} onToggle={() => toggleWrite(change.id)} rowRef={change.id === selectedId ? selectedRow : undefined} />)}</ul>
        : <p className="plotloom-file-changes__empty" role={error ? 'alert' : 'status'}>
          {!sessionId ? '打开项目聊天后查看 Agent 的文件修改。' : error || (changes ? (writeIds ? '本轮暂无可查看的文件记录。' : '这个聊天还没有成功写入的文件。') : '正在读取文件修改记录…')}
        </p>}
  </FileChangesFrame>;
}
