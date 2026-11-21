import { useEffect, useState } from 'react';
import type { Change, DocumentView, ExportResult, Proposal, Revision } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { FileDiff, type FileDiffBlock } from '@plotloom/ui/file-diff';
import { Select } from '@plotloom/ui/select';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

/** 导出正式稿直接下载接口返回的 Markdown，保留原文和行尾。 */
export async function exportManuscript(base: string, path: string) {
  await runWithToast(async () => {
    const { files: [file] } = await requestJson<ExportResult>(base + '/export', 'POST', { files: [{ path }] });
    if (!file) throw new Error('没有可导出的文稿。');
    const url = URL.createObjectURL(new Blob([file.content], { type: 'text/markdown;charset=UTF-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').at(-1) ?? '文稿.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, { loading: '正在导出 Markdown…', success: '已开始下载 Markdown' });
}

const revisionLabels: Record<Revision['source'], string> = {
  observed: '外部版本', manual: '手工保存', accepted: '采纳候选', restored: '恢复历史',
};

/** 先选择并查看历史原文，再用当前文稿的版本恢复；外部变化仍由接口做冲突校验。 */
export function NovelHistory({ base, document, onClose, onRestored }: {
  base: string; document: DocumentView; onClose: () => void; onRestored: (value: DocumentView) => void;
}) {
  const { path, version } = document;
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string }>();
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ revisions: Revision[] }>(base + '/history', 'POST', { path }, controller.signal).then(result => {
      if (!controller.signal.aborted) { setRevisions(result.revisions); setId(result.revisions[0]?.id ?? null); }
    }).catch(cause => notifyRequestError(cause, 'novel-history'));
    return () => controller.abort();
  }, [base, path]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void requestJson<ExportResult>(base + '/export', 'POST', { files: [{ path, revisionId: id }] }, controller.signal)
      .then(({ files }) => { if (!controller.signal.aborted && files[0]) setPreview({ id, content: files[0].content }); })
      .catch(cause => notifyRequestError(cause, 'novel-history-preview'));
    return () => controller.abort();
  }, [base, path, id]);

  async function restore() {
    if (!id || preview?.id !== id) return;
    setRestoring(true);
    const result = await runWithToast(() => requestJson<DocumentView>(base + '/restore', 'POST', { path, baseVersion: version, revisionId: id }),
      { loading: '正在恢复版本…', success: '已恢复所选版本' });
    setRestoring(false);
    if (result.ok) onRestored(result.value);
  }

  return <Dialog open title="历史版本" description={path} className="plotloom-novel-review"
    onOpenChange={open => { if (!open && !restoring) onClose(); }}
    footer={<><Button variant="ghost" disabled={restoring} onClick={onClose}>关闭</Button>
      <Button disabled={!id || preview?.id !== id || restoring} loading={restoring} onClick={() => void restore()}>恢复所选版本</Button></>}>
    <div className="plotloom-novel-fields">
      <Select aria-label="历史版本" value={id} clearable={false} disabled={restoring}
        options={revisions.map(revision => ({ value: revision.id, label: revisionLabels[revision.source] + ' · ' +
          new Date(revision.createdAt).toLocaleString('zh-CN', { hour12: false }) }))} onValueChange={setId} />
      <pre aria-label="历史文稿预览" className="plotloom-novel-preview">{preview?.id === id ? preview.content : '正在读取历史文稿…'}</pre>
    </div>
  </Dialog>;
}

const proposalLabels: Record<Proposal['status'], string> = {
  pending: '待审阅', partial: '部分已处理', accepted: '已采纳', rejected: '已拒绝', resolved: '已处理',
};
const changeLabels: Record<Change['status'], string> = {
  pending: '待决定', accepted: '已采纳', rejected: '已拒绝',
};
const splitLines = (value: string) => value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
const countNewlines = (value: string) => value.match(/\n/g)?.length ?? 0;

/** 行号基于候选前后两版；显示公开差异范围，决定时提交该处的 ID。 */
function changeBlocks(proposal: Proposal, change: Change, lineDelta: number): FileDiffBlock[] {
  const beforeStart = 1 + countNewlines(proposal.baseContent.slice(0, change.start));
  const blocks: FileDiffBlock[] = [];
  if (change.before) blocks.push({ kind: 'removed', beforeStart, afterStart: null, lines: splitLines(change.before) });
  if (change.after) blocks.push({ kind: 'added', beforeStart: null, afterStart: beforeStart + lineDelta, lines: splitLines(change.after) });
  return blocks;
}

export function NovelProposals({ base, proposals, onDecision }: {
  base: string; proposals: Proposal[]; onDecision: (proposal: Proposal, action: 'accept' | 'reject') => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const proposal = proposals.find(item => item.id === selected);

  async function decide(changeId: string, action: 'accept' | 'reject') {
    if (!proposal || busy) return;
    setBusy(true);
    const result = await runWithToast(() => requestJson<Proposal>(base + '/proposals/' + encodeURIComponent(proposal.id)
      + '/changes/' + encodeURIComponent(changeId), 'POST', { action }),
    { loading: action === 'accept' ? '正在采纳…' : '正在拒绝…', success: action === 'accept' ? '已采纳修改' : '已拒绝修改' });
    setBusy(false);
    if (result.ok) onDecision(result.value, action);
  }

  let lineDelta = 0;
  return <>
    <h2>候选</h2>
    {proposals.length ? <ul>{proposals.map(item => <li key={item.id}>
      <Button variant="ghost" size="sm" aria-label={'审阅候选 ' + item.path} onClick={() => setSelected(item.id)}>{item.path}</Button>
      <span className="plotloom-novel-muted">{proposalLabels[item.status]}</span>
    </li>)}</ul> : <p className="plotloom-novel-muted">暂无候选</p>}
    {proposal ? <Dialog open title="审阅候选差异" description={proposal.path} className="plotloom-novel-review"
      onOpenChange={open => { if (!open && !busy) setSelected(null); }}>
      <div className="plotloom-novel-fields">
        {proposal.origin?.reason ? <p>{proposal.origin.reason}</p> : null}
        {proposal.changes.map((change, index) => {
          const blocks = changeBlocks(proposal, change, lineDelta);
          lineDelta += countNewlines(change.after) - countNewlines(change.before);
          return <section key={change.id} className="plotloom-novel-change">
            <div className="plotloom-novel-actions">
              <h3>第 {index + 1} 处</h3>
              <span role="status">{changeLabels[change.status]}</span>
              <Button size="sm" disabled={busy || change.status !== 'pending'} onClick={() => void decide(change.id, 'accept')}>采纳</Button>
              <Button size="sm" variant="secondary" disabled={busy || change.status !== 'pending'} onClick={() => void decide(change.id, 'reject')}>拒绝</Button>
            </div>
            <FileDiff blocks={blocks} label={'第 ' + (index + 1) + ' 处差异'} />
          </section>;
        })}
      </div>
    </Dialog> : null}
  </>;
}
