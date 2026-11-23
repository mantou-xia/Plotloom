import { useEffect, useMemo, useRef, useState } from 'react';
import { diffArrays } from 'diff';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { Change, Proposal } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { DocumentListItem } from '@plotloom/ui/document-list-item';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

const countNewlines = (value: string) => value.match(/\r\n|\r|\n/gu)?.length ?? 0;
const words = new Intl.Segmenter('zh', { granularity: 'word' });
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

function reviewLines(start: number, value: string) {
  if (!value) return '';
  const end = start + countNewlines(value.trimEnd());
  return end === start ? `第 ${start} 行` : `第 ${start}–${end} 行`;
}

/** 两版分开排版，词句高亮只帮助阅读，使用后端已确定的整处差异做审批。 */
function ManuscriptComparison({ change, beforeLine, afterLine, context }: {
  change: Change; beforeLine: number; afterLine: number; context: string;
}) {
  const highlights = useMemo(() => {
    const tokenize = (text: string) => Array.from(words.segment(text), ({ segment }) => segment);
    return diffArrays(tokenize(change.before), tokenize(change.after), { timeout: 100 });
  }, [change.before, change.after]);
  return <div className="plotloom-candidate-comparison">
    {(['before', 'after'] as const).map(side => {
      const text = change[side];
      const label = side === 'before' ? '修改前' : '修改后';
      return <section key={side} aria-label={label} data-side={side}>
        <header><h3>{label}</h3><span>{reviewLines(side === 'before' ? beforeLine : afterLine, text)}</span></header>
        {text ? <div className="plotloom-candidate-comparison__text">{highlights ? highlights.map((part, index) => {
          if (side === 'before' ? part.added : part.removed) return null;
          const value = part.value.join('');
          return part.added || part.removed ? <mark key={index}>{value}</mark> : value;
        }) : text}</div> : <p>{side === 'before' ? '此处新增' : '此处删除'}</p>}
      </section>;
    })}
    {context ? <details><summary>查看后文</summary><div className="plotloom-candidate-comparison__text">{context}</div></details> : null}
  </div>;
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
  const beforeLine = proposal && change ? 1 + countNewlines(proposal.baseContent.slice(0, change.start)) : 1;
  const afterLine = beforeLine + lineDelta;
  // 只展示下一处差异前的原文。正文后移时仍可核对同一段落。
  const context = proposal && change ? proposal.baseContent.slice(change.end, proposal.changes[index + 1]?.start)
    .trimStart().split(/(?:\r\n|\r|\n)[\t ]*(?:\r\n|\r|\n)/u, 1)[0] : '';
  const disabled = busy || !change;
  return <section className="plotloom-candidate-panel" aria-label="审阅候选差异">
    <header className="plotloom-candidate-panel__header">
      <Button size="sm" variant="ghost" iconOnly aria-label="返回候选列表" disabled={busy} onClick={onBack}><ArrowLeft /></Button>
      <div><h2>审阅候选差异</h2><p title={proposal?.path}>{proposal?.path.split('/').at(-1) ?? ' '}</p></div>
    </header>
    <div className="plotloom-candidate-panel__progress" role="status">
      {change ? `第 ${index + 1} / ${proposal!.changes.length} 处 · 剩余 ${pending.length} 处` : proposal ? '全部差异已处理' : ' '}
    </div>
    <ScrollBox key={change?.id} reserveScrollbarSpace={false} className="plotloom-candidate-panel__diff" aria-label="当前差异">
      {change ? <ManuscriptComparison change={change} beforeLine={beforeLine} afterLine={afterLine} context={context} /> : !proposal ?
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
