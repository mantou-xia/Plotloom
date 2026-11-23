import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ModelConfig, ModelInfo, ProjectApprovalMode, ProjectFiles, SessionSummary, ThinkingLevel } from '@plotloom/contracts';
import type { Attachment } from '@plotloom/contracts/sources';
import type { SkillInfo, SkillSettings } from '@plotloom/contracts/skills';
import { WORLDVIEW_PATH } from '@plotloom/contracts/writing';
import { ATTACHMENT_TYPES, SOURCE_LIMITS } from '@plotloom/contracts/sources';
import { AsciiOcean } from '@plotloom/ui/ascii-ocean';
import { chatDraft } from './chat-draft';
import { TaskComposer, type ComposerMessage } from '@plotloom/ui/task-composer';
import { Button } from '@plotloom/ui/button';
import { request, requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { composerRequest } from './composer-request';
import { ChapterQuoteList } from './chapter-quotes';
import type { ChapterQuoteDraft } from './chapter-quote';
import { consumeAgentStream } from './client';
import { selectThinkingLevel, thinkingLabels } from './thinking-levels';
import './new-chat-page.css';

export const modelKey = (provider: string, model: string) => JSON.stringify([provider, model]);

export interface NewChatModelSnapshot {
  revision: number;
  models: ModelInfo[];
  selected: string | null;
  thinking: ThinkingLevel;
}

/** 模型配置属于页面，项目切换只重置草稿，不能重复请求或覆盖用户已选模型。 */
function useNewChatModels(modelRevision: number, snapshotRef: RefObject<NewChatModelSnapshot | null>) {
  const cached = snapshotRef.current?.revision === modelRevision ? snapshotRef.current : null;
  const [models, setModels] = useState<ModelInfo[]>(() => cached?.models ?? []);
  const [selected, setSelected] = useState<string | null>(() => cached?.selected ?? null);
  const [thinking, setThinking] = useState<ThinkingLevel>(() => cached?.thinking ?? 'off');
  const [failed, setFailed] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState(() => cached?.revision);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    // 同一配置版本下直接复用默认模型。设置保存后递增版本，避免把旧配置带入新会话。
    if (!reload && snapshotRef.current?.revision === modelRevision) return;
    const abort = new AbortController();
    void Promise.all([requestJson<{ models: ModelInfo[] }>('/api/models', 'GET', undefined, abort.signal),
      requestJson<ModelConfig>('/api/model-config', 'GET', undefined, abort.signal)]).then(([list, config]) => {
      if (abort.signal.aborted) return;
      const initial = list.models.find(model => model.configured && model.provider === config.provider && model.id === config.model)
        ?? list.models.find(model => model.configured);
      const next = { revision: modelRevision, models: list.models, selected: initial ? modelKey(initial.provider, initial.id) : null,
        thinking: selectThinkingLevel(initial?.thinkingLevels, config.thinkingLevel) };
      snapshotRef.current = next;
      setModels(next.models); setSelected(next.selected); setThinking(next.thinking); setFailed(false); setLoadedRevision(next.revision);
    }).catch(error => { if (!abort.signal.aborted) { setFailed(true); notifyRequestError(error, 'new-chat-models'); } });
    return () => abort.abort();
  }, [reload, modelRevision, snapshotRef]);
  return { models, selected, setSelected, thinking, setThinking, failed, loaded: loadedRevision === modelRevision, setReload };
}

/** 页面、背景与编辑器持续挂载；草稿版本只更新数据，不再重建任何可见控件。 */
export function NewChatPage({ modelRevision, modelSnapshotRef, skillRevision, draftRevision, projectPath, workspaceId, workspaceTitle, novelRoot, onStarted, renderProjectControl, quoteDraft }: {
  modelRevision: number; modelSnapshotRef: RefObject<NewChatModelSnapshot | null>; skillRevision: number;
  draftRevision: number; projectPath: string;
  workspaceId: string | null; workspaceTitle?: string; novelRoot?: string;
  onStarted: (session: SessionSummary) => void; renderProjectControl: (disabled: boolean) => ReactNode;
  quoteDraft?: ChapterQuoteDraft;
}) {
  const modelState = useNewChatModels(modelRevision, modelSnapshotRef);
  const [pending, setPending] = useState(false);
  const [unstartedWorld, setUnstartedWorld] = useState<string | null>(null);
  // 以本书正式资料为准，换会话或换浏览器都能识别已确认的世界观。
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    requestJson<{ paths: string[] }>('/api/workspaces/' + encodeURIComponent(workspaceId) + '/documents', 'GET', undefined, controller.signal)
      .then(({ paths }) => { if (!controller.signal.aborted) setUnstartedWorld(paths.includes(WORLDVIEW_PATH) ? null : workspaceId); })
      .catch(() => { if (!controller.signal.aborted) setUnstartedWorld(null); });
    return () => controller.abort();
  }, [workspaceId]);
  const attachmentDropTarget = useRef<HTMLElement>(null);
  const root = projectPath.trim();
  return <section ref={attachmentDropTarget} className="plotloom-work-start" aria-label="工作初始页">
    <AsciiOcean className="plotloom-work-start__ocean" />
    <div className="plotloom-work-start__welcome">
      <p className="plotloom-work-start__eyebrow">{workspaceId ? '小说对话' : '项目对话'}</p>
      <div className="plotloom-work-start__heading" role="heading" aria-level={1}>
        {workspaceId ? (workspaceTitle ? <>继续创作《{workspaceTitle}》</> : '小说对话') : root ? <>你想在 {renderProjectControl(pending)} 中完成什么？</> : renderProjectControl(pending)}
      </div>
      <p>{workspaceId && unstartedWorld === workspaceId ? '故事开头，主角生活在一个怎样的世界？可以先讲一条规则，或把已有的章节发给我。'
        : workspaceId || root ? '从这里开始一段新的对话。' : '选择或新建项目后开始对话。'}</p>
    </div>
    <NewChatDraft draftRevision={draftRevision} projectPath={workspaceId ? novelRoot ?? '' : projectPath} workspaceId={workspaceTitle ? workspaceId ?? undefined : undefined} attachmentDropTarget={attachmentDropTarget}
      modelState={modelState} skillRevision={skillRevision} pending={pending} setPending={setPending} onStarted={onStarted} quoteDraft={quoteDraft} />
  </section>;
}

/** 草稿拥有会话、附件及发送生命周期；切换项目后旧异步结果不能操作新草稿。 */
function NewChatDraft({ draftRevision, projectPath, workspaceId, modelState, skillRevision, pending, setPending, onStarted, attachmentDropTarget, quoteDraft }: {
  draftRevision: number; projectPath: string; workspaceId?: string; modelState: ReturnType<typeof useNewChatModels>; skillRevision: number;
  attachmentDropTarget: RefObject<HTMLElement | null>;
  pending: boolean; setPending: (pending: boolean) => void; onStarted: (session: SessionSummary) => void;
  quoteDraft?: ChapterQuoteDraft;
}) {
  const { models, selected, setSelected, thinking, setThinking, failed, loaded, setReload } = modelState;
  const root = projectPath.trim();
  const draftKey = workspaceId ? 'new-novel:' + workspaceId : 'new:' + root;
  const [approval, setApproval] = useState<{ draftRevision: number; draftKey: string; mode: ProjectApprovalMode } | null>(null);
  const projectApprovalMode = approval?.draftRevision === draftRevision && approval.draftKey === draftKey ? approval.mode : 'required';
  // 每一版草稿有独立的异步作用域；旧请求持有旧作用域，不能覆盖新会话或清空新输入。
  const scope = useMemo(() => ({
    draft: { current: null as Promise<SessionSummary> | null }, sending: { current: false },
    mounted: { current: false }, stream: { current: null as AbortController | null },
  }), [draftRevision, draftKey]);
  const { draft, sending, mounted, stream } = scope;
  // 切换时仅释放旧订阅与忙碌状态，编辑器 DOM 不卸载；已接收的生成仍留在服务端。
  useLayoutEffect(() => { mounted.current = true; return () => {
    mounted.current = false; stream.current?.abort(); setPending(false);
  }; }, [scope, setPending]);
  const chosen = models.find(model => modelKey(model.provider, model.id) === selected);
  const canStart = Boolean(root || workspaceId);
  const [skillOptions, setSkillOptions] = useState<{ workspaceId?: string; revision: number; skills: SkillInfo[] }>();
  // 新聊天尚未建会话。用公开目录和小说默认设置过滤候选，发送时仍以服务端准入为准。
  useEffect(() => {
    if (!canStart) return;
    const abort = new AbortController();
    void Promise.all([
      requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, abort.signal),
      workspaceId ? requestJson<SkillSettings>(`/api/workspaces/${encodeURIComponent(workspaceId)}/skills`, 'GET', undefined, abort.signal) : null,
    ]).then(([catalog, settings]) => {
      if (abort.signal.aborted) return;
      const scope = workspaceId ? 'novel' : 'project';
      const skills = catalog.skills.filter(skill => skill.enabled && skill.availableIn.includes(scope)
        && (!settings || settings.skillIds.includes(skill.id)));
      setSkillOptions({ workspaceId, revision: skillRevision, skills });
    }).catch(error => { if (!abort.signal.aborted) notifyRequestError(error, 'new-chat-skills'); });
    return () => abort.abort();
  }, [canStart, workspaceId, skillRevision]);

  /** 并发附件共用创建请求；目录绑定后固定，发送失败重试复用同一会话。 */
  function ensureSession(): Promise<SessionSummary> {
    if (!canStart) return Promise.reject(new Error('请先选择项目或小说。'));
    if (!loaded || failed || !chosen?.configured) return Promise.reject(new Error('请先选择已配置的模型。'));
    if (!draft.current) {
      const path = workspaceId ? `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions` : '/api/sessions';
      draft.current = requestJson<SessionSummary>(path, 'POST', {
        provider: chosen.provider, model: chosen.id, thinkingLevel: thinking,
        ...(workspaceId ? {} : { projectPath: root }),
      }).catch(cause => { draft.current = null; throw cause; });
    }
    return draft.current;
  }

  /** accepted 后才切入聊天记录；失败保留编辑器和附件，后续聊天页读取服务端运行快照。 */
  async function send(message: ComposerMessage): Promise<boolean> {
    const sent = quoteDraft?.items ?? [];
    const body = composerRequest(message, sent);
    if (!canStart || sending.current || (!body.text && !body.attachmentIds?.length && !body.references?.length)) return false;
    sending.current = true; setPending(true);
    const acceptance = Promise.withResolvers<boolean>();
    void (async () => {
      try {
        const session = await ensureSession();
        if (!mounted.current) return;
        const path = '/api/sessions/' + encodeURIComponent(session.id);
        // 附件可能已提前创建会话，发送前以当前草稿权限保存配置。
        await requestJson(path + '/config', 'PUT', { provider: chosen!.provider, model: chosen!.id, thinkingLevel: thinking,
          projectApprovalMode });
        if (!mounted.current) return;
        const abort = new AbortController();
        stream.current = abort;
        const response = await request(path + '/messages', 'POST', body, abort.signal);
        await consumeAgentStream(response, event => {
          if (event.sessionId !== session.id) throw new Error('收到不属于当前聊天的事件。');
          if (event.type === 'accepted') {
            acceptance.resolve(true);
            quoteDraft?.clearSent(sent);
            if (mounted.current) onStarted(session);
          }
          if (event.type === 'failed' && mounted.current) notifyRequestError(new Error(event.error.message), 'new-chat-send');
        });
      } catch (cause) { if (mounted.current) notifyRequestError(cause, 'new-chat-send'); }
      finally { acceptance.resolve(false); sending.current = false; if (mounted.current) setPending(false); }
    })();
    return acceptance.promise;
  }

  return <div className="plotloom-work-start__bottom">
      <div className="plotloom-work-start__feedback" role="status">
        {/* 首次进入时静默加载模型；项目切换复用配置，只在失败或无可用模型时提示。 */}
        {failed ? <Button variant="text" size="sm" onClick={() => setReload(value => value + 1)}>重新加载模型</Button>
          : !loaded ? null : !chosen ? '暂无已配置凭据的模型，请先配置本机模型。' : pending ? '正在开始对话…' : null}
      </div>
      <TaskComposer draftContext={quoteDraft?.items.length ? <ChapterQuoteList draft={quoteDraft} /> : null}
        options={{ height: 0, draftKey: draftKey + ':' + draftRevision, ...chatDraft(draftKey), disabled: !canStart || !loaded || !chosen || failed, busy: pending,
        hasDraftContext: Boolean(quoteDraft?.items.length),
        models: models.filter(model => model.configured).map(model => modelKey(model.provider, model.id)),
        modelLabels: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), model.name + ' · ' + model.provider])),
        modelNames: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), model.id])),
        selectedModel: selected ?? '', value: thinking,
        thinkingOptions: (chosen?.thinkingLevels ?? ['off']).map(value => ({ value, label: thinkingLabels[value] })),
        onModelChange: key => { const model = models.find(item => modelKey(item.provider, item.id) === key); setSelected(key); setThinking(selectThinkingLevel(model?.thinkingLevels, thinking)); },
        onValueChange: value => setThinking(value as ThinkingLevel),
        permissionOptions: root || workspaceId ? 'project' : false,
        permission: projectApprovalMode === 'full_access' ? 'full_access' : 'default',
        onPermissionChange: value => setApproval({ draftRevision, draftKey, mode: value === 'full_access' ? 'full_access' : 'required' }),
        placeholder: '输入消息，/ 调用技能，@ 引用文件',
        advancedMentions: false, projectPath: root || undefined,
        skills: skillOptions?.workspaceId === workspaceId && skillOptions?.revision === skillRevision ? skillOptions.skills : undefined,
        onSearchFiles: root || workspaceId ? async query => { const session = await ensureSession(); return requestJson<ProjectFiles>('/api/sessions/' + encodeURIComponent(session.id) + '/project-files', 'POST', { query }); } : undefined,
        maxAttachments: SOURCE_LIMITS.attachmentCount, attachmentAccept: '.png,.jpg,.jpeg,.webp,.txt,.md,.markdown', attachmentDropTarget,
        onAttachmentUpload: async input => {
          if (!ATTACHMENT_TYPES.includes(input.mimeType as typeof ATTACHMENT_TYPES[number])) throw new Error('支持 PNG、JPEG、WebP、TXT 和 Markdown。');
          if (input.mimeType.startsWith('image/') && !chosen?.input.includes('image')) throw new Error('当前模型不支持图片，请先切换模型。');
          const session = await ensureSession();
          return requestJson<Attachment>('/api/sessions/' + encodeURIComponent(session.id) + '/attachments', 'POST', input);
        },
        onAttachmentRemove: async id => { const session = await ensureSession(); await requestJson('/api/sessions/' + encodeURIComponent(session.id) + '/attachments/' + encodeURIComponent(id), 'DELETE'); },
        onSubmit: send,
      }} />
    </div>;
}
