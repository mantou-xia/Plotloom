import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ModelInfo, ProjectFiles, SessionConfig, SessionConfigRequest, SessionContext, ThinkingLevel } from '@plotloom/contracts';
import type { Attachment } from '@plotloom/contracts/sources';
import { ATTACHMENT_TYPES, SOURCE_LIMITS } from '@plotloom/contracts/sources';
import type { SkillActivation } from '@plotloom/contracts/skills';
import { chatDraft } from './chat-draft';
import { ChapterQuoteList } from './chapter-quotes';
import type { ChapterQuoteDraft } from './chapter-quote';
import { TaskComposer, type ComposerMessage } from '@plotloom/ui/task-composer';
import type { ComposerConversationFile } from '@plotloom/ui/task-composer/types';
import { Button } from '@plotloom/ui/button';
import { requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { modelKey } from './new-chat-page';

import { thinkingLabels } from './thinking-levels';

/** 组件保持纯 UI；这里负责公开协议转换、配置保存、附件上传及上下文刷新。 */
export function ChatComposer({ sessionId, projectPath, busy, disabled, activity, stopping, revision, attachmentDropTarget, conversationFiles, quoteDraft, onSubmit, onStop, onRefresh }: {
  sessionId: string; projectPath?: string; busy: boolean; disabled: boolean; activity?: string; stopping: boolean; revision: number;
  attachmentDropTarget: RefObject<HTMLElement | null>;
  conversationFiles: readonly ComposerConversationFile[];
  quoteDraft?: ChapterQuoteDraft;
  onSubmit: (message: ComposerMessage) => Promise<boolean>; onStop: () => void; onRefresh: () => void;
}) {
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [enabled, setEnabled] = useState<SkillActivation | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const operation = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      requestJson<{ models: ModelInfo[] }>('/api/models', 'GET', undefined, abort.signal),
      requestJson<SessionConfig>(`${path}/config`, 'GET', undefined, abort.signal),
      requestJson<SessionContext>(`${path}/context`, 'GET', undefined, abort.signal),
      requestJson<SkillActivation>(`${path}/skills`, 'GET', undefined, abort.signal),
    ]).then(([list, saved, usage, activation]) => {
      if (abort.signal.aborted) return;
      setModels(list.models); setConfig(saved); setContext(usage); setEnabled(activation); setFailed(false);
    }).catch(cause => { if (!abort.signal.aborted) { setFailed(true); notifyRequestError(cause, 'composer-load'); } });
    return () => abort.abort();
  }, [path, revision, reload]);

  /** 等待服务端成功后更新选中值；互斥锁堵住连续点击和发送之间的配置竞争。 */
  async function saveConfig(input: SessionConfigRequest) {
    if (operation.current || busy || disabled) throw new Error('当前任务处理中，请稍后调整配置。');
    operation.current = true; setSaving(true);
    try {
      const saved = await requestJson<SessionConfig>(`${path}/config`, 'PUT', input);
      if (mounted.current) { setConfig(saved); setReload(value => value + 1); }
    } finally { operation.current = false; if (mounted.current) setSaving(false); }
  }

  const locked = busy || saving;
  const compactRunning = activity === 'compacting';
  const canStop = compactRunning || activity === 'generating';
  return <div className="plotloom-chat__input">
    <div className="plotloom-chat__config-status" role="status">
      {failed ? <Button size="sm" variant="text" onClick={() => setReload(value => value + 1)}>重试加载输入配置</Button>
        : compactRunning ? '正在压缩上下文…' : null}
    </div>
    <TaskComposer draftContext={quoteDraft?.items.length ? <ChapterQuoteList draft={quoteDraft} /> : null}
      options={{ height: 0, draftKey: sessionId, ...chatDraft('session:' + sessionId), disabled: disabled || !config || failed, busy: locked, stopping,
      hasDraftContext: Boolean(quoteDraft?.items.length),
      onStop: canStop ? compactRunning ? () => {
        void requestJson(`${path}/compact/stop`, 'POST').then(onRefresh).catch(cause => notifyRequestError(cause, 'composer-compact-stop'));
      } : onStop : undefined,
      models: models.filter(model => model.configured).map(model => modelKey(model.provider, model.id)),
      modelLabels: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), `${model.name} · ${model.provider}`])),
      modelNames: Object.fromEntries(models.map(model => [modelKey(model.provider, model.id), model.id])),
      selectedModel: config ? modelKey(config.provider, config.model) : '', value: config?.thinkingLevel ?? 'off',
      thinkingOptions: (config?.capabilities.thinkingLevels ?? ['off']).map(value => ({ value, label: thinkingLabels[value] })),
      onModelChange: async key => {
        const selected = models.find(model => modelKey(model.provider, model.id) === key);
        if (!selected?.configured) throw new Error('模型尚未配置。');
        await saveConfig({ provider: selected.provider, model: selected.id });
      },
      onValueChange: async value => { await saveConfig({ thinkingLevel: value as ThinkingLevel }); },
      permissionOptions: config?.projectApprovalMode ? 'project' : false,
      permission: config?.projectApprovalMode === 'full_access' ? 'full_access' : 'default',
      onPermissionChange: async value => { await saveConfig({ projectApprovalMode: value === 'full_access' ? 'full_access' : 'required' }); },
      placeholder: '输入消息，/ 调用技能，@ 引用文件',
      advancedMentions: false, projectPath, conversationFiles,
      skills: enabled?.skills.filter(skill => skill.runnable) ?? [], context: context ?? undefined,
      onSearchFiles: config?.projectApprovalMode ? query => requestJson<ProjectFiles>(`${path}/project-files`, 'POST', { query }) : undefined,
      maxAttachments: SOURCE_LIMITS.attachmentCount, attachmentAccept: '.png,.jpg,.jpeg,.webp,.txt,.md,.markdown', attachmentDropTarget,
      onAttachmentUpload: async input => {
        if (!ATTACHMENT_TYPES.includes(input.mimeType as typeof ATTACHMENT_TYPES[number])) throw new Error('支持 PNG、JPEG、WebP、TXT 和 Markdown。');
        if (input.mimeType.startsWith('image/') && !config?.capabilities.input.includes('image')) throw new Error('当前模型不支持图片，请先切换模型。');
        return requestJson<Attachment>(`${path}/attachments`, 'POST', input);
      },
      onAttachmentRemove: async id => { await requestJson(`${path}/attachments/${encodeURIComponent(id)}`, 'DELETE'); },
      onSubmit: message => operation.current || locked ? Promise.resolve(false) : onSubmit(message),
    }} />
  </div>;
}
