import { useEffect, useRef, useState } from 'react';
import type { AgentEvent, SessionDetail, SubmitMessageRequest } from '@plotloom/contracts';
import type { ComposerMessage } from '@plotloom/ui/task-composer';
import { Button } from '@plotloom/ui/button';
import { ScrollBox } from '@plotloom/ui/scroll-box';
import { ChatComposer } from './chat-composer';
import { AttachmentPreview } from './attachment-preview';
import { composerRequest } from './composer-request';
import { consumeAgentStream } from './client';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import './chat-page.css';

/** 只管理当前聊天；离开页面断开订阅但不停止后端，重开时读取真实运行快照。 */
export function ChatPage({ sessionId, onSessionsChange }: { sessionId: string; onSessionsChange: () => Promise<void> }) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [liveThinking, setLiveThinking] = useState('');
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [controlsRevision, setControlsRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const mounted = useRef(false);
  const tail = useRef<HTMLDivElement>(null);
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const busy = pending || session?.status === 'running';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  // 没有本地流时轮询运行中的快照，覆盖刷新、切页和网络断流后的继续生成。
  useEffect(() => {
    if (pending) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const detail = await requestJson<SessionDetail>(path, 'GET', undefined, abort.signal);
        if (abort.signal.aborted) return;
        setSession(detail);
        setLoadFailed(false);
        setLiveText('');
        setLiveThinking('');
        if (detail.status === 'running') timer = setTimeout(() => void load(), 1000);
        else { setControlsRevision(value => value + 1); void onSessionsChange(); }
      } catch (cause) { if (!abort.signal.aborted) { setLoadFailed(true); notifyRequestError(cause, `session-load-${sessionId}`); } }
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [path, pending, reload, onSessionsChange, sessionId]);

  useEffect(() => { tail.current?.scrollIntoView({ block: 'end' }); }, [session?.messages, liveText, liveThinking]);

  /** accepted 后才清空输入；正常进度由聊天界面反馈，仅请求或生成失败弹出 Toast。 */
  function send(message: ComposerMessage): Promise<boolean> {
    const body = composerRequest(message);
    if ((!body.text && !body.attachmentIds?.length) || busy || sending.current || !session) return Promise.resolve(false);
    sending.current = true;
    const acceptance = Promise.withResolvers<boolean>();
    void generate(body, acceptance.resolve);
    return acceptance.promise;
  }

  /** 接收确认与生成完成分开：前者释放编辑器草稿，后者刷新权威历史、工具结果和上下文。 */
  async function generate(body: SubmitMessageRequest, accepted: (value: boolean) => void) {
    const abort = new AbortController();
    controller.current = abort;
    setPending(true); setLiveText(''); setLiveThinking(''); setStatus('正在发送…');
    try {
      const response = await request(`${path}/messages`, 'POST', body, abort.signal);
      await consumeAgentStream(response, (event: AgentEvent) => {
        if (!mounted.current || abort.signal.aborted) return;
        if (event.sessionId !== sessionId) throw new Error('收到不属于当前聊天的事件。');
        switch (event.type) {
          case 'accepted':
            accepted(true); setStatus('正在回复…');
            setSession(current => current ? { ...current, status: 'running', activity: 'generating', messages: [...current.messages,
              { id: event.messageId, role: 'user', content: [{ type: 'text', text: body.text || '已发送附件' }] }] } : current);
            void onSessionsChange(); break;
          case 'text_delta': setLiveText(value => value + event.delta); break;
          case 'thinking_delta': setLiveThinking(value => value + event.delta); break;
          case 'tool_start': setStatus(`正在使用工具：${event.name}`); break;
          case 'tool_end': setStatus(event.outcome === 'failed' ? `工具执行失败：${event.name}` : '正在回复…'); break;
          case 'retrying': setStatus(`正在重试（${event.attempt}/${event.maxAttempts}）…`); break;
          case 'compacting': setStatus(event.phase === 'start' ? '正在整理上下文…' : '正在回复…'); break;
          case 'failed': notifyRequestError(new Error(event.error.message), `chat-send-${sessionId}`); setStatus('生成失败'); break;
          case 'aborted': setStatus('已停止'); break;
          case 'completed': setStatus(''); break;
        }
      });
    } catch (cause) {
      if (!abort.signal.aborted && mounted.current) { notifyRequestError(cause, `chat-send-${sessionId}`); setStatus(''); }
    } finally {
      accepted(false);
      sending.current = false;
      if (mounted.current && !abort.signal.aborted) { setPending(false); void onSessionsChange(); }
    }
  }

  /** 停止必须调用服务端接口；正常结果由生成状态反馈，仅停止失败弹出提示。 */
  async function stop() {
    setStopping(true);
    try { await requestJson(`${path}/stop`, 'POST'); if (mounted.current) setReload(value => value + 1); }
    catch (cause) { if (mounted.current) notifyRequestError(cause, `chat-stop-${sessionId}`); }
    finally { if (mounted.current) setStopping(false); }
  }

  return <section className="plotloom-chat" aria-label="聊天">
    <header className="plotloom-chat__header"><h1>{session?.name || '新聊天'}</h1>
      {session?.projectPath ? <span className="plotloom-chat__project" title={session.projectPath}>{session.projectPath} · 直接执行</span> : <span>普通聊天</span>}</header>
    <ScrollBox className="plotloom-chat__messages" aria-label="聊天记录">
      <div className="plotloom-chat__thread">
        {!session ? loadFailed ? null : <p role="status">正在加载聊天…</p> : !session.messages.length ? <p className="plotloom-chat__empty">有什么想法，开始聊聊吧。</p> : null}
        {session?.messages.map(message => <article key={message.id} className="plotloom-chat__message" data-role={message.role}>
          <strong>{message.role === 'user' ? '你' : message.role === 'assistant' ? 'Plotloom' : '工具'}</strong>
          {message.content.map((block, index) => block.type === 'thinking' ? <details key={index}><summary>思考过程</summary><p>{block.text}</p></details>
            : block.type === 'tool' ? <details key={index}><summary>{block.name} · {block.status === 'failed' ? '失败' : block.status === 'running' ? '运行中' : '完成'}</summary><p>{block.text}</p></details>
              : <p key={index}>{block.text}</p>)}
          {message.attachments?.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment} />)}
          {message.references?.map((reference, index) => <details key={index}><summary>{reference.path} · 引用快照</summary><p>{reference.content}</p></details>)}
          {message.outcome === 'aborted' ? <small>已停止</small> : message.outcome === 'failed' ? <small>生成失败</small> : null}
        </article>)}
        {liveThinking || liveText ? <article className="plotloom-chat__message"><strong>Plotloom</strong>
          {liveThinking ? <details><summary>思考过程</summary><p>{liveThinking}</p></details> : null}
          {liveText ? <p>{liveText}</p> : null}</article> : null}
        <div ref={tail} />
      </div>
    </ScrollBox>
    <div className="plotloom-chat__bottom">
      {loadFailed ? <Button variant="text" size="sm" onClick={() => void runWithToast(async () => {
        const detail = await requestJson<SessionDetail>(path);
        if (mounted.current) { setSession(detail); setLoadFailed(false); setReload(value => value + 1); }
      }, { loading: '正在重新查询…', success: '聊天记录已更新' })}>重新查询</Button> : null}
      <p className="plotloom-chat__status" role="status">{busy ? status || (session?.activity === 'compacting' ? '正在压缩上下文…' : '正在回复…') : status}</p>
      {session ? <ChatComposer sessionId={sessionId} projectPath={session.projectPath} busy={busy} activity={session.activity}
        stopping={stopping} revision={controlsRevision} onSubmit={send} onStop={() => void stop()} onRefresh={() => setReload(value => value + 1)} /> : null}
    </div>
  </section>;
}
