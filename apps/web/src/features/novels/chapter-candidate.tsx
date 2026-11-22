import { useEffect, useState } from 'react';
import type { Change, Proposal } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { FileDiff, type FileDiffBlock } from '@plotloom/ui/file-diff';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

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

/** 审阅只请求这一轮交付的候选，逐处决定仍走公开协议。 */
export function ChapterCandidate({ base, id, onClose, onAccepted }: {
  base: string; id: string; onClose: () => void; onAccepted: () => void;
}) {
  const [proposal, setProposal] = useState<Proposal>();
  const [busy, setBusy] = useState(false);
  const endpoint = base + '/proposals/' + encodeURIComponent(id);
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<Proposal>(endpoint, 'GET', undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setProposal(value); })
      .catch(error => notifyRequestError(error, 'chapter-candidate'));
    return () => controller.abort();
  }, [endpoint]);

  async function decide(changeId: string, action: 'accept' | 'reject') {
    setBusy(true);
    const result = await runWithToast(() => requestJson<Proposal>(endpoint + '/changes/' + encodeURIComponent(changeId), 'POST', { action }),
      { loading: '正在处理候选…', success: action === 'accept' ? '已采纳修改' : '已拒绝修改' });
    setBusy(false);
    if (result.ok) {
      setProposal(result.value);
      if (action === 'accept') onAccepted();
    }
  }

  let lineDelta = 0;
  return <Dialog open title="审阅候选差异" description={proposal?.path} className="plotloom-novel-review"
    onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <div className="plotloom-novel-fields">
      {!proposal && <p role="status">正在读取候选…</p>}
        {proposal?.changes.map((change, index) => {
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
  </Dialog>;
}
