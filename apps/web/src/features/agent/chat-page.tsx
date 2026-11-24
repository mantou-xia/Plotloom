import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@plotloom/ui/input';
import type { AgentQuestionAnswer, ReplyFeedback, ReplyFeedbackInput, SessionDetail, SubmitMessageRequest, RetryMessageRequest, ToolApprovalDecision } from '@plotloom/contracts';
import type { ComposerMessage } from '@plotloom/ui/task-composer';
import type { ComposerConversationFile } from '@plotloom/ui/task-composer/types';
import { Button } from '@plotloom/ui/button';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { Skeleton } from '@plotloom/ui/skeleton';
import { ToolApprovalCard, type ToolApprovalState } from '@plotloom/ui/tool-approval-card';
import { QuestionCard } from '@plotloom/ui/question-card';
import { ChatComposer } from './chat-composer';
import { ChatScrollToLatest } from './chat-scroll-to-latest';
import type { OpenTurnChanges } from '../workspace/chat-workspace';
import { ChatTurn } from './chat-turn';
import { chatTurns } from './chat-turns';
import { composerRequest } from './composer-request';
import type { ChapterQuoteDraft } from './chapter-quote';
import { consumeAgentStream } from './client';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import type { OpenCitations } from '../workspace/citation-sources-page';
import type { OpenDeliverable } from '../workspace/deliverable-page';
import { deliverableLinks } from './deliverable-links';
import './chat-page.css';

const operationLabels = { create: '创建文件', overwrite: '覆盖文件', edit: '修改文件' };

/** 失焦时提交标题；失败保留草稿，用户可重新聚焦并再次离开以重试。 */
function ChatTitle({ name, onSave }: { name: string; onSave: (name: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  async function save(value: string) {
    if (saving) return;
    const next = value.trim();
    if (!next || next === name) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      // 失焦后保留用户已移到的焦点，避免打断同一次点击或 Tab 导航。
      setDraft(null);
    } catch (error) { notifyRequestError(error, 'chat-rename'); }
    finally { setSaving(false); }
  }
  return <header className="plotloom-chat__header">{draft === null ? <>
    <h1 title={name}>{name}</h1>
    <Button ref={editButton} variant="ghost" size="sm" iconOnly tooltip aria-label="重命名对话" onClick={() => setDraft(name)}><Pencil size={16} /></Button>
  </> :
    <Input className="plotloom-chat__title-input" size="sm" aria-label="对话名称" value={draft} onValueChange={setDraft}
      autoFocus onFocus={event => event.target.select()} maxLength={120} readOnly={saving}
      onBlur={event => void save(event.currentTarget.value)} onKeyDown={event => {
        if (event.nativeEvent.isComposing || saving) return;
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') {
          setDraft(null);
          requestAnimationFrame(() => editButton.current?.focus({ preventScroll: true }));
        }
      }} />
  }</header>;
}

/** 页面以服务端快照为准；SSE 触发刷新，离开页面断开连接但不停止后台任务。 */
export function ChatPage({ title, novelRoot, acceptedRevision, sessionId, snapshots, onRename, onSessionsChange, settingsRevision = 0, onOpenCitations, onOpenTurnChanges, onOpenManuscript, onOpenDeliverable, quoteDraft }: {
  onRename: (id: string, name: string) => Promise<string>;
  snapshots: Map<string, SessionDetail>;
  title?: string; novelRoot?: string; acceptedRevision: number; sessionId: string; onSessionsChange: () => Promise<void>; settingsRevision?: number; onOpenCitations: OpenCitations; onOpenTurnChanges: OpenTurnChanges;
  onOpenManuscript: (view: NonNullable<SessionDetail['manuscriptRequest']>['view']) => boolean;
  onOpenDeliverable: OpenDeliverable;
  quoteDraft?: ChapterQuoteDraft;
}) {
  const [session, setSession] = useState(() => snapshots.get(sessionId) ?? null);
  const [verified, setVerified] = useState(false);
  const hasRead = useRef(false);
  const [openedAt] = useState(() => Date.now());
  const manuscriptRequest = session?.manuscriptRequest;
  useEffect(() => {
    if (!verified || !manuscriptRequest || (['discard', 'export_txt'].includes(manuscriptRequest.view.mode) && Date.parse(manuscriptRequest.createdAt) < openedAt)) return;
    const key = 'plotloom:manuscript-request:' + sessionId;
    if (sessionStorage.getItem(key) === manuscriptRequest.id) return;
    if (onOpenManuscript(manuscriptRequest.view)) sessionStorage.setItem(key, manuscriptRequest.id);
  }, [sessionId, verified, manuscriptRequest, openedAt, onOpenManuscript]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ id: string; state: ToolApprovalState } | null>(null);
  const deciding = useRef<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const attachmentDropTarget = useRef<HTMLElement>(null);
  const [reload, setReload] = useState(0);
  const [controlsRevision, setControlsRevision] = useState(0);
  const [away, setAway] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const mounted = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const busy = pending || session?.status === 'running';
  const turns = useMemo(() => session ? chatTurns(session) : [], [session]);
  /** 保存成功后同步已挂载聊天与回访缓存，刷新仍以本机持久记录为准。 */
  async function saveFeedback(turnId: string, input: ReplyFeedbackInput) {
    const saved = await requestJson<ReplyFeedback>(path + '/feedback/' + encodeURIComponent(turnId), 'PUT', input);
    if (!mounted.current) return;
    const apply = (current: SessionDetail) => ({
      ...current, feedback: [...(current.feedback ?? []).filter(item => item.turnId !== turnId), saved],
    });
    const cached = snapshots.get(sessionId);
    if (cached) snapshots.set(sessionId, apply(cached));
    setSession(current => current && apply(current));
  }
  const conversationFiles = useMemo(() => {
    // 候选以服务端消息快照为准，按最近一轮优先展示，刷新后仍能引用同一份资料。
    const files = new Map<string, ComposerConversationFile>();
    for (const turn of turns.toReversed()) {
      for (const file of deliverableLinks(turn.answer).files) {
        if (!files.has('file:' + file.path)) files.set('file:' + file.path, file);
      }
      for (const attachment of turn.user?.attachments ?? []) {
        if (!files.has('attachment:' + attachment.id)) {
          files.set('attachment:' + attachment.id, { name: attachment.name, attachmentId: attachment.id });
        }
      }
    }
    return [...files.values()];
  }, [turns]);
  const approvals = session?.pendingApprovals ?? [];
  // 顺序展示待批调用，逐项处理可保留相同操作位置。
  const approval = approvals[0];
  const awaitingApproval = session?.activity === 'awaiting_approval';
  const question = session?.pendingQuestion;
  const composerSuspended = awaitingApproval || !!question;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  // 单个串行轮询覆盖本页生成、刷新与断流，避免慢查询覆盖较新的结果。
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const detail = await requestJson<SessionDetail>(path, 'GET', undefined, abort.signal);
        if (abort.signal.aborted) return;
        // 只缓存稳定快照，避免切回时重放审批或显示过期的生成状态。
        snapshots.delete(sessionId);
        if (detail.status === 'idle' && detail.activity === 'idle' && !pending) {
          snapshots.set(sessionId, detail);
          const oldest = snapshots.keys().next().value;
          if (snapshots.size > 12 && oldest !== undefined) snapshots.delete(oldest);
        }
        setSession(detail); setVerified(true); setLoadFailed(false);
        if (detail.status === 'running' || pending) timer = setTimeout(() => void load(), 350);
        else {
          if (hasRead.current) setControlsRevision(value => value + 1);
          void onSessionsChange();
        }
        hasRead.current = true;
      } catch (cause) {
        if (!abort.signal.aborted) {
          setLoadFailed(true); notifyRequestError(cause, `session-load-${sessionId}`);
          if (pending) timer = setTimeout(() => void load(), 1500);
        }
      }
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [path, pending, reload, onSessionsChange, sessionId, acceptedRevision, snapshots]);

  // 按浮层实际高度给最后一轮留出滚动空间。输入区和正文变高时，仅在用户仍靠近底部时跟随。
  useLayoutEffect(() => {
    const page = attachmentDropTarget.current, element = viewport.current;
    const content = thread.current, floating = bottom.current;
    if (!page || !element || !content || !floating) return;
    let bottomHeight = -1;
    const syncLayout = () => {
      const height = Math.ceil(floating.getBoundingClientRect().height);
      if (height !== bottomHeight) {
        bottomHeight = height;
        page.style.setProperty('--chat-bottom-height', `${height}px`);
      }
      if (follow.current) element.scrollTop = element.scrollHeight;
      setAway(element.scrollHeight - element.clientHeight - element.scrollTop > 48);
    };
    const resize = new ResizeObserver(syncLayout);
    resize.observe(content, { box: 'border-box' });
    resize.observe(element);
    resize.observe(floating, { box: 'border-box' });
    syncLayout();
    return () => resize.disconnect();
  }, []);

  /** accepted 才释放草稿；发送失败保留原文，主动发送时恢复跟随最新消息。 */
  function send(message: ComposerMessage): Promise<boolean> {
    const sent = quoteDraft?.items ?? [];
    const body = composerRequest(message, sent);
    if ((!body.text && !body.attachmentIds?.length && !body.references?.length) || busy || sending.current || !session || !verified) return Promise.resolve(false);
    const acceptance = Promise.withResolvers<boolean>();
    follow.current = true;
    void generate('messages', body, acceptance.resolve).catch(() => {});
    return acceptance.promise.then(accepted => {
      if (accepted) quoteDraft?.clearSent(sent);
      return accepted;
    });
  }

  /** 重试由后端重放最新原始请求；保留历史，工具会再次执行。同步锁阻止连续点击。 */
  async function retry() {
    if (!session?.retryMessageId || busy || sending.current || !verified) return;
    follow.current = true;
    await generate('retry', { messageId: session.retryMessageId });
  }

  /** SSE 不重复拼接正文；结束、断流或失败后统一重查快照，防止 UI 与刷新后的历史不同。 */
  async function generate(endpoint: 'messages' | 'retry', body: SubmitMessageRequest | RetryMessageRequest, accepted?: (value: boolean) => void) {
    if (sending.current) { accepted?.(false); return; }
    sending.current = true;
    snapshots.delete(sessionId);
    const abort = new AbortController();
    controller.current = abort; setPending(true);
    try {
      const response = await request(`${path}/${endpoint}`, 'POST', body, abort.signal);
      await consumeAgentStream(response, event => {
        if (!mounted.current || abort.signal.aborted) return;
        if (event.sessionId !== sessionId) throw new Error('收到不属于当前聊天的事件。');
        if (event.type === 'accepted') { accepted?.(true); setReload(value => value + 1); void onSessionsChange(); }
        if (event.type === 'tool_approval_required' || event.type === 'user_answer_required') {
          setReload(value => value + 1);
          void onSessionsChange();
        }
        if (event.type === 'tool_end' && event.manuscriptView?.mode === 'export_txt') onOpenManuscript(event.manuscriptView);
        if (event.type === 'failed') notifyRequestError(new Error(event.error.message), `chat-send-${sessionId}`);
      });
    } catch (cause) {
      if (!abort.signal.aborted && mounted.current) { notifyRequestError(cause, `chat-send-${sessionId}`); throw cause; }
    } finally {
      accepted?.(false); sending.current = false;
      if (mounted.current && !abort.signal.aborted) { setPending(false); setReload(value => value + 1); void onSessionsChange(); }
    }
  }

  /** 等待服务端结束整轮执行；关闭本地订阅不能替代停止工具与模型。 */
  async function stop() {
    setStopping(true);
    try { await requestJson(`${path}/stop`, 'POST'); if (mounted.current) setReload(value => value + 1); }
    catch (cause) { if (mounted.current) notifyRequestError(cause, `chat-stop-${sessionId}`); }
    finally { if (mounted.current) setStopping(false); }
  }

  /** 以服务端确认的决定禁用原按钮，快照轮询随后移除已处理项目。 */
  async function decideApproval(id: string, decision: ToolApprovalDecision) {
    if (deciding.current) return;
    deciding.current = id;
    setDecidingId(id);
    try {
      await requestJson(`${path}/tool-approvals/${encodeURIComponent(id)}`, 'POST', { decision });
      if (mounted.current) setApprovalResult({ id, state: decision === 'approve' ? 'approved' : 'denied' });
    } catch (cause) {
      if (mounted.current) notifyRequestError(cause, `chat-tool-approval-${sessionId}`);
    } finally {
      deciding.current = null;
      if (mounted.current) { setDecidingId(null); setReload(value => value + 1); }
    }
  }

  /** 等服务端接受答案，再锁定该题并刷新快照；提交失败时保留用户的选择或自填内容。 */
  async function answerQuestion(id: string, answer: AgentQuestionAnswer) {
    if (deciding.current || answeredId === id || stopping) return;
    deciding.current = id;
    setDecidingId(id);
    try {
      await requestJson(`${path}/questions/${encodeURIComponent(id)}/answer`, 'POST', answer);
      if (mounted.current) { setAnsweredId(id); void onSessionsChange(); }
    } catch (cause) {
      if (mounted.current) notifyRequestError(cause, `chat-question-${sessionId}`);
    } finally {
      deciding.current = null;
      if (mounted.current) { setDecidingId(null); setReload(value => value + 1); }
    }
  }

  const initialLoading = !session && !loadFailed;
  return <section ref={attachmentDropTarget} className="plotloom-chat" aria-label="聊天" aria-busy={initialLoading}>
    {initialLoading && !title ? <header className="plotloom-chat__header"><Skeleton className="plotloom-chat__title-skeleton" /></header> :
    <ChatTitle name={title || session?.name || '新聊天'} onSave={async next => {
      const name = await onRename(sessionId, next);
      const cached = snapshots.get(sessionId);
      if (cached) snapshots.set(sessionId, { ...cached, name });
      setSession(current => current && { ...current, name });
      await onSessionsChange();
    }} />}
    <div className="plotloom-chat__reading">
      <ScrollBox ref={viewport} className="plotloom-chat__messages" aria-label="聊天记录" onScroll={event => {
        const element = event.currentTarget;
        follow.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 48; setAway(!follow.current);
      }}>
        <div ref={thread} className="plotloom-chat__thread">
          {initialLoading ? <div className="plotloom-chat__history-skeleton">
            <Skeleton className="plotloom-chat__message-skeleton" />
            <Skeleton lineWidths={['82%', '68%', '54%']} />
          </div> : session && !turns.length ? <p className="plotloom-chat__empty">有什么想法，开始聊聊吧。</p> : null}
          {turns.map(turn => <ChatTurn key={turn.id} turn={turn} busy={busy} onOpenCitations={onOpenCitations} onOpenTurnChanges={onOpenTurnChanges}
            onOpenDeliverable={onOpenDeliverable} onFeedbackChange={verified ? saveFeedback : undefined}
            onRetry={verified && turn.user?.id === session?.retryMessageId ? retry : undefined} />)}
          {loadFailed ? <Button variant="text" size="sm" onClick={() => setReload(value => value + 1)}>重新查询聊天记录</Button> : null}
        </div>
      </ScrollBox>
    </div>
    <div ref={bottom} className="plotloom-chat__bottom">
      {session ? <div className="plotloom-chat__composer-slot">
        <ChatScrollToLatest visible={away} viewport={viewport} />
        {/* 保留编辑器和占位，切换卡片时草稿、附件及阅读视口保持原位。 */}
        <div className="plotloom-chat__composer-content" data-suspended={composerSuspended || undefined}
          inert={composerSuspended} aria-hidden={composerSuspended || undefined}>
          <ChatComposer sessionId={sessionId} projectPath={session.projectPath ?? novelRoot} busy={busy} disabled={!verified} conversationFiles={conversationFiles}
            activity={awaitingApproval ? session.activity : pending ? 'generating' : session.activity}
            attachmentDropTarget={attachmentDropTarget} stopping={stopping} revision={controlsRevision + settingsRevision} quoteDraft={quoteDraft}
            onSubmit={send} onStop={() => void stop()} onRefresh={() => setReload(value => value + 1)} />
        </div>
        {question ? <div className="plotloom-chat__composer-card">
          <QuestionCard key={question.id} question={question.question} options={question.options}
            submitting={decidingId === question.id || answeredId === question.id} stopping={stopping}
            onAnswer={answer => void answerQuestion(question.id, answer)} onStop={() => void stop()} />
        </div> : awaitingApproval && approval ? <div className="plotloom-chat__composer-card">
          <ToolApprovalCard key={approval.id} operation={approval.label ?? operationLabels[approval.operation]}
            path={approval.path} preview={approval.preview} state={approvalResult?.id === approval.id ? approvalResult.state : 'pending'}
            pendingLabel={approvals.length > 1 ? `${approvals.length} 项操作待审批` : undefined}
            submitting={decidingId === approval.id} stopping={stopping} onStop={() => void stop()}
            onDecision={stopping ? undefined : decision => void decideApproval(approval.id, decision)} />
        </div> : null}
      </div> : initialLoading ? <Skeleton className="plotloom-chat__composer-skeleton" /> : null}
    </div>
  </section>;
}
