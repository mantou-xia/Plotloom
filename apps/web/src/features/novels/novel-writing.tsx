import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionSummary } from '@plotloom/contracts';
import type { WritingRequest, WritingResult, WritingTask } from '@plotloom/contracts/writing';
import type { DocumentView, Selection } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Select } from '@plotloom/ui/select';
import { Textarea } from '@plotloom/ui/textarea';
import { consumeAgentStream } from '../agent/client';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import { readManuscript } from './novel-api';
import type { ChatSummary } from '@plotloom/contracts/skills';

const writingTasks: Record<Exclude<WritingTask, 'discuss'>, string> = {
  chapter: '按大纲写章节',
  continue: '续写',
  rewrite: '改写选区',
  enrich_outline: '丰富大纲',
};
const taskOptions = Object.entries(writingTasks).map(([value, label]) => ({ value, label }));
const writingSessionKey = (id: string) => 'plotloom:novel-writing:v1:' + id;

interface NovelWritingProps {
  workspaceId: string;
  base: string;
  path: string;
  paths: string[];
  document?: DocumentView;
  selection?: Selection;
  disabled: boolean;
  onSettled: () => void;
  onSessionsChange: () => Promise<void>;
  onOpenChat: (id: string) => void;
}

/** 创作沿用小说会话。断流与刷新后以服务端记录确认结果，停止走既有会话接口。 */
export function NovelWriting({ workspaceId, base, path, paths, document, selection, disabled, onSettled, onSessionsChange, onOpenChat }: NovelWritingProps) {
  const storageKey = writingSessionKey(workspaceId);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(storageKey));
  const [task, setTask] = useState<Exclude<WritingTask, 'discuss'>>('rewrite');
  const [outline, setOutline] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [records, setRecords] = useState<WritingResult[]>([]);
  const [phase, setPhase] = useState<'preparing' | 'starting' | 'running' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const onSettledRef = useRef(onSettled);
  useEffect(() => { onSettledRef.current = onSettled; }, [onSettled]);
  useEffect(() => () => controller.current?.abort(), []);
  const load = useCallback((id: string, signal?: AbortSignal) =>
    requestJson<{ requests: WritingResult[] }>('/api/sessions/' + encodeURIComponent(id) + '/writing', 'GET', undefined, signal), []);

  useEffect(() => {
    if (!sessionId || phase) return;
    const poll = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    async function sync(id: string) {
      try {
        const { requests } = await load(id, poll.signal);
        if (poll.signal.aborted) return;
        setRecords(requests);
        if (requests.some(record => record.outcome === 'running')) {
          running = true;
          timer = setTimeout(() => void sync(id), 1000);
        } else if (running || requests[0]?.proposals.length) onSettledRef.current();
      } catch (cause) {
        if (poll.signal.aborted) return;
        // 聊天可能从设置中删除。先核对小说会话列表，服务暂时不可用时保留原绑定。
        const chats = await requestJson<{ sessions: ChatSummary[] }>(base + '/sessions', 'GET', undefined, poll.signal)
          .catch(() => null);
        if (poll.signal.aborted) return;
        if (chats && !chats.sessions.some(chat => chat.id === id)) {
          localStorage.removeItem(storageKey);
          setSessionId(null);
          setRecords([]);
          return;
        }
        notifyRequestError(cause, 'novel-writing-records');
        if (running) timer = setTimeout(() => void sync(id), 2000);
      }
    }
    void sync(sessionId);
    return () => { poll.abort(); clearTimeout(timer); };
  }, [sessionId, phase, load, base, storageKey]);

  const current = records.find(record => record.context.target?.path === path);
  const remoteRunning = records.some(record => record.outcome === 'running');
  const inProgress = !!phase || remoteRunning;
  const canStop = phase === 'running' || remoteRunning;
  const options = paths.filter(file => file !== path).map(file => ({ value: file, label: file }));
  const validTask = task === 'chapter' ? !!outline && paths.includes(outline) :
    !!document?.version && (task !== 'rewrite' || !!selection);
  const status = inProgress ? (canStop ? '正在创作…' : '正在准备创作…') : current?.outcome === 'aborted' ? '已停止' :
    current?.outcome === 'failed' ? '创作失败' : current?.review?.status === 'needs_input' ? '需要确认设定或补充资料' :
    current?.proposals.length ? '候选已保存，可在左侧逐处审阅' : current ? '本轮未产生候选' :
    task === 'rewrite' ? (selection ? '已选择 ' + selection.text.length + ' 个字符' : '请先在正文中选中文字') : '';

  /** 资料现读取版本，目标保留作者看到的版本。服务端继续校验目标与资料是否在发送前变化。 */
  async function generate() {
    if (!document || disabled || inProgress || !validTask || !instructions.trim()) return;
    const active = new AbortController();
    controller.current = active;
    const { signal } = active;
    setPhase('preparing');
    try {
      const outlinePath = task === 'chapter' ? outline : null;
      const referencePaths = references.filter(file => file !== outlinePath);
      const files = await Promise.all([...referencePaths, ...(outlinePath ? [outlinePath] : [])]
        .map(file => readManuscript(base, file, signal)));
      const versions = files.map(file => {
        if (!file.version) throw new Error('参考资料已不存在：' + file.path);
        return { path: file.path, version: file.version };
      });
      const body: WritingRequest = {
        task, instructions: instructions.trim(),
        target: { path, baseVersion: document.version, ...(task === 'rewrite' ? { selection } : {}) },
        outline: versions.find(file => file.path === outlinePath),
        references: versions.filter(file => file.path !== outlinePath).map(file => ({ ...file, role: 'other' })),
      };
      let id = sessionId;
      if (!id) {
        const session = await requestJson<SessionSummary>(base + '/sessions', 'POST', { name: '小说创作' }, signal);
        id = session.id;
        localStorage.setItem(storageKey, id);
        setSessionId(id);
        void onSessionsChange();
      }
      setPhase('starting');
      const response = await request('/api/sessions/' + encodeURIComponent(id) + '/writing/messages', 'POST', body, signal);
      await consumeAgentStream(response, event => {
        if (event.type === 'accepted') {
          setInstructions('');
          setPhase('running');
          void onSessionsChange();
        }
        if (event.type === 'failed') notifyRequestError(new Error(event.error.message), 'novel-writing');
      });
    } catch (cause) { notifyRequestError(cause, 'novel-writing'); }
    finally {
      if (!signal.aborted) {
        setPhase(null);
        onSettled();
        void onSessionsChange();
      }
    }
  }

  async function stop() {
    if (!sessionId || !canStop || stopping) return;
    setStopping(true);
    const result = await runWithToast(() => requestJson('/api/sessions/' + encodeURIComponent(sessionId) + '/stop', 'POST'),
      { loading: '正在停止创作…', success: '已停止创作' });
    setStopping(false);
    if (result.ok && !phase) {
      try { setRecords((await load(sessionId)).requests); } catch (cause) { notifyRequestError(cause, 'novel-writing-records'); }
      onSettled();
      void onSessionsChange();
    }
  }

  return <section className="plotloom-novel-writing" aria-label="小说创作">
    <div className="plotloom-novel-actions">
      <h3>小说创作</h3>
      <Button size="sm" variant="ghost" disabled={!sessionId} onClick={() => { if (sessionId) onOpenChat(sessionId); }}>打开创作聊天</Button>
    </div>
    <div className="plotloom-novel-writing-options">
      <Select aria-label="创作任务" options={taskOptions} value={task} searchable={false} clearable={false}
        disabled={inProgress} onValueChange={value => { if (value) setTask(value as typeof task); }} />
      <Select aria-label="正式大纲" placeholder={task === 'chapter' ? '选择正式大纲' : '当前任务无需指定大纲'}
        value={outline} options={options} disabled={task !== 'chapter' || inProgress} onValueChange={setOutline} />
      <Select multiple aria-label="参考资料" placeholder="选择参考资料" options={options} value={references} disabled={inProgress}
        onValueChange={value => setReferences(value.slice(0, 30))} />
    </div>
    <Textarea aria-label="创作要求" placeholder="写下本轮创作要求" rows={3} maxLength={10000} readOnly={inProgress}
      value={instructions} onValueChange={setInstructions} />
    <div className="plotloom-novel-actions">
      <Button disabled={disabled || !validTask || !instructions.trim() || inProgress} onClick={() => void generate()}>生成候选</Button>
      <Button variant="secondary" disabled={!canStop || stopping} loading={stopping} onClick={() => void stop()}>停止生成</Button>
      <Button variant="ghost" disabled={!current} onClick={() => setShowDetails(true)}>查看本轮资料与审校</Button>
    </div>
    <p role="status" className="plotloom-novel-writing-status">{status}</p>
    {showDetails && current ? <Dialog open title="创作资料与审校" onOpenChange={open => { if (!open) setShowDetails(false); }}>
      <div className="plotloom-novel-fields">
        <h3>本轮实际使用的资料</h3>
        {current.context.sources.map(source => <details key={source.path}>
          <summary>{source.path} · {source.version?.slice(0, 8) ?? '新文稿'}</summary>
          <pre className="plotloom-novel-preview">{source.selection?.text ?? source.content}</pre>
        </details>)}
        <h3>审校记录</h3>
        {current.review?.status === 'needs_input' ? current.review.issues.map((issue, index) => <section key={index}>
          <p>{issue.message}</p>
          {issue.evidence.map((item, i) => <blockquote key={i}>{item.path}：{item.quote}</blockquote>)}
        </section>) : <p>{current.review?.status === 'clear' ? '本轮审校通过' : '暂无审校记录'}</p>}
      </div>
    </Dialog> : null}
  </section>;
}
