import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { Change, Proposal } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { FileDiff, type FileDiffBlock } from '@plotloom/ui/file-diff';
import { DocumentListItem } from '@plotloom/ui/document-list-item';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

const splitLines = (value: string) => value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
const countNewlines = (value: string) => value.match(/\n/g)?.length ?? 0;
const reviewDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' });

/** 手动打开时先看本书待审候选，Agent 可以直接定位同一标签内的指定候选。 */
export function ChapterReviewWorkspace({ workspaceId, request, onOpened, onAccepted }: {
  workspaceId: string; request?: { proposalId: string }; onOpened: () => void; onAccepted: () => void;
}) {
  const [lastRequest, setLastRequest] = useState(request);
  const [selected, setSelected] = useState(request?.proposalId);
  if (request && request !== lastRequest) {
    setLastRequest(request);
    setSelected(request.proposalId);
  }
  // 自动定位只消费一次，关闭标签后从功能列表打开会重新展示候选列表。
  useEffect(() => { if (request) onOpened(); }, [request, onOpened]);
  const base = '/api/workspaces/' + encodeURIComponent(workspaceId);
  return selected ? <ChapterCandidate key={selected} base={base} id={selected} onBack={() => setSelected(undefined)} onAccepted={onAccepted} />
    : <ChapterCandidateList base={base} onOpen={setSelected} />;
}

/** 待审列表由服务端状态驱动，文件名与目录分开显示，便于定位同名章节。 */
function ChapterCandidateList({ base, onOpen }: { base: string; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Proposal[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ proposals: Proposal[] }>(base + '/proposals', 'GET', undefined, controller.signal)
      .then(({ proposals }) => {
        if (controller.signal.aborted) return;
        setItems(proposals.filter(item => /^(正文章节|大纲)\//u.test(item.path) && ['pending', 'partial'].includes(item.status))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      }).catch(error => {
        if (controller.signal.aborted) return;
        setFailed(true);
        notifyRequestError(error, 'chapter-candidate-list');
      });
    return () => controller.abort();
  }, [base, attempt]);
  return <section className="plotloom-candidate-panel plotloom-candidate-panel--queue" aria-label="候选章节审阅">
    <header className="plotloom-candidate-panel__header"><h2>待审候选</h2></header>
    <ScrollBox className="plotloom-candidate-panel__list" aria-label="待审候选列表">
      {failed ? <Button size="sm" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重试读取候选</Button>
        : !items ? <p role="status">正在读取候选…</p>
          : items.length === 0 ? <p role="status">暂无待审候选</p> : <ul>{items.map(item => {
            const divider = item.path.lastIndexOf('/');
            const title = item.path.slice(divider + 1);
            const remaining = item.changes.filter(change => change.status === 'pending').length;
            return <li key={item.id}>
              <DocumentListItem title={title} label={item.path} category={item.path.slice(0, divider)}
                date={reviewDate.format(new Date(item.createdAt))} selected={false} onSelect={() => onOpen(item.id)}
                endContent={<>剩余 {remaining} 处<ChevronRight aria-hidden="true" /></>} />
            </li>;
          })}</ul>}
    </ScrollBox>
  </section>;
}

/** 行号基于候选前后两版；显示公开差异范围，决定时提交该处的 ID。 */
function changeBlocks(proposal: Proposal, change: Change, lineDelta: number): FileDiffBlock[] {
  const beforeStart = 1 + countNewlines(proposal.baseContent.slice(0, change.start));
  const blocks: FileDiffBlock[] = [];
  if (change.before) blocks.push({ kind: 'removed', beforeStart, afterStart: null, lines: splitLines(change.before) });
  if (change.after) blocks.push({ kind: 'added', beforeStart: null, afterStart: beforeStart + lineDelta, lines: splitLines(change.after) });
  return blocks;
}

/** 审阅只请求这一轮交付的候选，逐处决定仍走公开协议。 */
function ChapterCandidate({ base, id, onBack, onAccepted }: {
  base: string; id: string; onBack: () => void; onAccepted: () => void;
}) {
  const [proposal, setProposal] = useState<Proposal>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const deciding = useRef(false);
  const endpoint = base + '/proposals/' + encodeURIComponent(id);
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<Proposal>(endpoint, 'GET', undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setProposal(value); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setFailed(true);
        notifyRequestError(error, 'chapter-candidate');
      });
    return () => controller.abort();
  }, [endpoint, attempt]);

  /** 用服务端的新状态选中下一处待审差异，提交失败时保留当前差异。 */
  async function decide(action: 'accept' | 'reject', changeId?: string) {
    if (deciding.current) return;
    deciding.current = true;
    setBusy(true);
    const route = changeId ? '/changes/' + encodeURIComponent(changeId) : '/decision';
    const result = await runWithToast(() => requestJson<Proposal>(endpoint + route, 'POST', { action }),
      { loading: '正在处理候选…', success: action === 'accept' ? '已采纳修改' : '已拒绝修改' });
    deciding.current = false;
    setBusy(false);
    if (result.ok) {
      setProposal(result.value);
      if (action === 'accept') onAccepted();
    }
  }

  const pending = proposal?.changes.filter(change => change.status === 'pending') ?? [];
  const change = pending[0];
  const index = change && proposal ? proposal.changes.indexOf(change) : -1;
  const lineDelta = index >= 0 && proposal ? proposal.changes.slice(0, index)
    .reduce((delta, item) => item.status === 'accepted' ? delta + countNewlines(item.after) - countNewlines(item.before) : delta, 0) : 0;
  const display = proposal && change ? changeBlocks(proposal, change, lineDelta) : [];
  const disabled = busy || !change;
  return <section className="plotloom-candidate-panel" aria-label="审阅候选差异">
    <header className="plotloom-candidate-panel__header">
      <Button size="sm" variant="ghost" iconOnly aria-label="返回候选列表" disabled={busy} onClick={onBack}><ArrowLeft /></Button>
      <div><h2>审阅候选差异</h2><p title={proposal?.path}>{proposal?.path.split('/').at(-1) ?? ' '}</p></div>
    </header>
    <div className="plotloom-candidate-panel__progress" role="status">
      {change ? `第 ${index + 1} / ${proposal!.changes.length} 处 · 剩余 ${pending.length} 处` : proposal ? '全部差异已处理' : ' '}
    </div>
    <ScrollBox key={change?.id} orientation="both" reserveScrollbarSpace={false} className="plotloom-candidate-panel__diff" aria-label="当前差异">
      {change ? <FileDiff blocks={display} label={`第 ${index + 1} 处差异`} /> : !proposal ?
        (failed ? <Button size="sm" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重试读取候选</Button> : <p role="status">正在读取候选…</p>) : null}
    </ScrollBox>
    <footer className="plotloom-candidate-panel__actions">
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void decide('reject')}>全部拒绝</Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void decide('accept')}>全部采纳</Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void decide('reject', change.id)}>拒绝</Button>
      <Button size="sm" disabled={disabled} onClick={() => void decide('accept', change.id)}>采纳</Button>
    </footer>
  </section>;
}
