import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { SessionDetail, SubmitMessageRequest, RetryMessageRequest } from '@plotloom/contracts';
import type { ComposerMessage } from '@plotloom/ui/task-composer';
import { Button } from '@plotloom/ui/button';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { ChatComposer } from './chat-composer';
import { ChatTurn } from './chat-turn';
import { chatTurns } from './chat-turns';
import { composerRequest } from './composer-request';
import { consumeAgentStream } from './client';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import './chat-page.css';

/** 页面始终读取权威快照；SSE 仅处理接受确认，离开页面断开连接但不停止后台任务。 */
export function ChatPage({ title, sessionId, onSessionsChange, settingsRevision = 0 }: { title?: string; sessionId: string; onSessionsChange: () => Promise<void>; settingsRevision?: number }) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const attachmentDropTarget = useRef<HTMLElement>(null);
  const [reload, setReload] = useState(0);
  const [controlsRevision, setControlsRevision] = useState(0);
  const [away, setAway] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const mounted = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const busy = pending || session?.status === 'running';
  const turns = useMemo(() => session ? chatTurns(session) : [], [session]);

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
        setSession(detail); setLoadFailed(false);
        if (detail.status === 'running' || pending) timer = setTimeout(() => void load(), 350);
        else { setControlsRevision(value => value + 1); void onSessionsChange(); }
      } catch (cause) {
        if (!abort.signal.aborted) {
          setLoadFailed(true); notifyRequestError(cause, `session-load-${sessionId}`);
          if (pending) timer = setTimeout(() => void load(), 1500);
        }
      }
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [path, pending, reload, onSessionsChange, sessionId]);

  // 仅用户仍靠近底部时跟随，异步 Markdown 和图片尺寸变化也遵守同一阅读意图。
  useLayoutEffect(() => {
    const element = viewport.current, content = thread.current;
    if (!element || !content) return;
    const resize = new ResizeObserver(() => {
      if (follow.current) element.scrollTop = element.scrollHeight;
      setAway(element.scrollHeight - element.clientHeight - element.scrollTop > 48);
    });
    resize.observe(content); resize.observe(element);
    return () => resize.disconnect();
  }, []);

  /** accepted 才释放草稿；发送失败保留原文，主动发送时恢复跟随最新消息。 */
  function send(message: ComposerMessage): Promise<boolean> {
    const body = composerRequest(message);
    if ((!body.text && !body.attachmentIds?.length && !body.references?.length) || busy || sending.current || !session) return Promise.resolve(false);
    const acceptance = Promise.withResolvers<boolean>();
    follow.current = true;
    void generate('messages', body, acceptance.resolve).catch(() => {});
    return acceptance.promise;
  }

  /** 重试由后端重放最新原始请求；保留历史，工具会再次执行。同步锁阻止连续点击。 */
  async function retry() {
    if (!session?.retryMessageId || busy || sending.current) return;
    follow.current = true;
    await generate('retry', { messageId: session.retryMessageId });
  }

  /** SSE 不重复拼接正文；结束、断流或失败后统一重查快照，防止 UI 与刷新后的历史不同。 */
  async function generate(endpoint: 'messages' | 'retry', body: SubmitMessageRequest | RetryMessageRequest, accepted?: (value: boolean) => void) {
    if (sending.current) { accepted?.(false); return; }
    sending.current = true;
    const abort = new AbortController();
    controller.current = abort; setPending(true);
    try {
      const response = await request(`${path}/${endpoint}`, 'POST', body, abort.signal);
      await consumeAgentStream(response, event => {
        if (!mounted.current || abort.signal.aborted) return;
        if (event.sessionId !== sessionId) throw new Error('收到不属于当前聊天的事件。');
        if (event.type === 'accepted') { accepted?.(true); setReload(value => value + 1); void onSessionsChange(); }
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

  return <section ref={attachmentDropTarget} className="plotloom-chat" aria-label="聊天">
    <header className="plotloom-chat__header"><h1>{title || session?.name || '新聊天'}</h1>
      <span className="plotloom-chat__project" title={session?.projectPath}>{session?.projectPath ? `${session.projectPath} · 直接执行` : '普通聊天'}</span></header>
    <div className="plotloom-chat__reading">
      <ScrollBox ref={viewport} className="plotloom-chat__messages" aria-label="聊天记录" onScroll={event => {
        const element = event.currentTarget;
        follow.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 48; setAway(!follow.current);
      }}>
        <div ref={thread} className="plotloom-chat__thread">
          {!session && !loadFailed ? <p role="status">正在加载聊天…</p> : session && !turns.length ? <p className="plotloom-chat__empty">有什么想法，开始聊聊吧。</p> : null}
          {turns.map(turn => <ChatTurn key={turn.id} turn={turn} busy={busy} onRetry={turn.user?.id === session?.retryMessageId ? retry : undefined} />)}
        </div>
      </ScrollBox>
      <Button className="plotloom-chat__latest" variant="secondary" size="sm" iconOnly aria-label="回到最新消息"
        style={{ visibility: away ? 'visible' : 'hidden' }} onClick={() => {
          follow.current = true;
          if (viewport.current) { viewport.current.scrollTop = viewport.current.scrollHeight; viewport.current.focus({ preventScroll: true }); }
          setAway(false);
        }}><ArrowDown /></Button>
    </div>
    <div className="plotloom-chat__bottom">
      <div className="plotloom-chat__status" role="status">
        {loadFailed ? <Button variant="text" size="sm" onClick={() => setReload(value => value + 1)}>重新查询聊天记录</Button>
          : busy ? session?.activity === 'compacting' ? '正在压缩上下文…' : '正在处理…' : null}
      </div>
      {session ? <ChatComposer sessionId={sessionId} projectPath={session.projectPath} busy={busy} activity={pending ? 'generating' : session.activity}
        attachmentDropTarget={attachmentDropTarget} stopping={stopping} revision={controlsRevision + settingsRevision}
        onSubmit={send} onStop={() => void stop()} onRefresh={() => setReload(value => value + 1)} /> : null}
    </div>
  </section>;
}
