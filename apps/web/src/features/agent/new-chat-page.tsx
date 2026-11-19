import { useEffect, useRef, useState } from 'react';
import type { ModelConfig, ModelInfo, ProjectFiles, SessionSummary, ThinkingLevel } from '@plotloom/contracts';
import type { Attachment } from '@plotloom/contracts/sources';
import { ATTACHMENT_TYPES, SOURCE_LIMITS } from '@plotloom/contracts/sources';
import { AsciiOcean } from '@plotloom/ui/ascii-ocean';
import { TaskComposer, type ComposerMessage } from '@plotloom/ui/task-composer';
import { Button } from '@plotloom/ui/button';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { composerRequest } from './composer-request';
import { consumeAgentStream } from './client';
import './new-chat-page.css';

export const modelKey = (provider: string, model: string) => JSON.stringify([provider, model]);
const thinkingLabels: Record<ThinkingLevel, string> = { off: '关闭', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高' };

/** 工作初始状态保留项目上下文；仅发送、上传或引用文件时通过公开协议创建会话。 */
export function NewChatPage({ projectPath, onStarted }: {
  projectPath: string; onStarted: (session: SessionSummary) => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thinking, setThinking] = useState<ThinkingLevel>('off');
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const draft = useRef<Promise<SessionSummary> | null>(null);
  const sending = useRef(false);
  const mounted = useRef(false);
  const stream = useRef<AbortController | null>(null);
  // 切到聊天记录后由既有快照轮询接手；断开订阅不会停止服务端生成。
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stream.current?.abort(); }; }, []);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([requestJson<{ models: ModelInfo[] }>('/api/models', 'GET', undefined, abort.signal),
      requestJson<ModelConfig>('/api/model-config', 'GET', undefined, abort.signal)]).then(([list, config]) => {
      if (abort.signal.aborted) return;
      setModels(list.models); setFailed(false); setLoaded(true);
      const initial = list.models.find(model => model.configured && model.provider === config.provider && model.id === config.model)
        ?? list.models.find(model => model.configured);
      setSelected(initial ? modelKey(initial.provider, initial.id) : null);
      setThinking(initial?.thinkingLevels.includes(config.thinkingLevel) ? config.thinkingLevel : 'off');
    }).catch(error => { if (!abort.signal.aborted) { setFailed(true); notifyRequestError(error, 'new-chat-models'); } });
    return () => abort.abort();
  }, [reload]);
  const chosen = models.find(model => modelKey(model.provider, model.id) === selected);
  const root = projectPath.trim();
  const projectName = root.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || root;

  /** 并发附件共用创建请求；目录绑定后固定，发送失败重试复用同一会话。 */
  function ensureSession(): Promise<SessionSummary> {
    if (!chosen?.configured) return Promise.reject(new Error('请先选择已配置的模型。'));
    if (!draft.current) {
      draft.current = requestJson<SessionSummary>('/api/sessions', 'POST', {
        provider: chosen.provider, model: chosen.id, thinkingLevel: thinking,
        name: root ? projectName.slice(0, 120) : '新聊天', ...(root ? { projectPath: root } : {}),
      }).catch(cause => { draft.current = null; throw cause; });
    }
    return draft.current;
  }

  /** accepted 后才切入聊天记录；失败保留编辑器和附件，后续聊天页读取服务端运行快照。 */
  async function send(message: ComposerMessage): Promise<boolean> {
    const body = composerRequest(message);
    if (sending.current || (!body.text && !body.attachmentIds?.length)) return false;
    sending.current = true; setPending(true);
    const acceptance = Promise.withResolvers<boolean>();
    void (async () => {
      try {
        const session = await ensureSession();
        if (!mounted.current) return;
        const path = '/api/sessions/' + encodeURIComponent(session.id);
        await requestJson(path + '/config', 'PUT', { provider: chosen!.provider, model: chosen!.id, thinkingLevel: thinking });
        if (!mounted.current) return;
        const abort = new AbortController();
        stream.current = abort;
        const response = await request(path + '/messages', 'POST', body, abort.signal);
        await consumeAgentStream(response, event => {
          if (event.sessionId !== session.id) throw new Error('收到不属于当前聊天的事件。');
          if (event.type === 'accepted') { acceptance.resolve(true); if (mounted.current) onStarted(session); }
          if (event.type === 'failed' && mounted.current) notifyRequestError(new Error(event.error.message), 'new-chat-send');
        });
      } catch (cause) { if (mounted.current) notifyRequestError(cause, 'new-chat-send'); }
      finally { acceptance.resolve(false); sending.current = false; if (mounted.current) setPending(false); }
    })();
    return acceptance.promise;
  }

  return <section className="plotloom-work-start" aria-label="工作初始页">
    <AsciiOcean className="plotloom-work-start__ocean" />
    <div className="plotloom-work-start__welcome">
      <p className="plotloom-work-start__eyebrow">{root ? '当前项目' : '从一个想法开始'}</p>
      <h1>{root ? <>你想在 <span title={root}>{projectName}</span> 中完成什么？</> : '有什么想法，开始聊聊吧。'}</h1>
      <p>从这里开始一段新的对话。</p>
    </div>
    <div className="plotloom-work-start__bottom">
      <div className="plotloom-work-start__feedback" role="status">
        {failed ? <Button variant="text" size="sm" onClick={() => setReload(value => value + 1)}>重新加载模型</Button>
          : !loaded ? '正在加载模型…' : !chosen ? '暂无已配置凭据的模型，请先配置本机模型。' : pending ? '正在开始对话…' : null}
      </div>
      <TaskComposer options={{ height: 0, disabled: !chosen || failed, busy: pending,
        models: models.filter(model => model.configured).map(model => modelKey(model.provider, model.id)),
        modelLabels: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), model.name + ' · ' + model.provider])),
        modelNames: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), model.id])),
        selectedModel: selected ?? '', value: thinking,
        thinkingOptions: (chosen?.thinkingLevels ?? ['off']).map(value => ({ value, label: thinkingLabels[value] })),
        onModelChange: key => { const model = models.find(item => modelKey(item.provider, item.id) === key); setSelected(key); if (!model?.thinkingLevels.includes(thinking)) setThinking('off'); },
        onValueChange: value => setThinking(value as ThinkingLevel),
        permissionOptions: false, advancedMentions: false, projectPath: root || undefined, skills: [],
        onSearchFiles: root ? async query => { const session = await ensureSession(); return requestJson<ProjectFiles>('/api/sessions/' + encodeURIComponent(session.id) + '/project-files', 'POST', { query }); } : undefined,
        maxAttachments: SOURCE_LIMITS.attachmentCount, attachmentAccept: '.png,.jpg,.jpeg,.webp,.txt,.md,.markdown',
        onAttachmentUpload: async input => {
          if (!ATTACHMENT_TYPES.includes(input.mimeType as typeof ATTACHMENT_TYPES[number])) throw new Error('支持 PNG、JPEG、WebP、TXT 和 Markdown。');
          if (input.mimeType.startsWith('image/') && !chosen?.input.includes('image')) throw new Error('当前模型不支持图片，请先切换模型。');
          const session = await ensureSession();
          return requestJson<Attachment>('/api/sessions/' + encodeURIComponent(session.id) + '/attachments', 'POST', input);
        },
        onAttachmentRemove: async id => { const session = await ensureSession(); await requestJson('/api/sessions/' + encodeURIComponent(session.id) + '/attachments/' + encodeURIComponent(id), 'DELETE'); },
        onSubmit: send,
      }} />
    </div>
  </section>;
}
