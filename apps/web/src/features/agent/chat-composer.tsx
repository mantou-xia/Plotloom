import { useEffect, useRef, useState } from 'react';
import type { CompactionResult, ModelInfo, ProjectFiles, SessionConfig, SessionConfigRequest, SessionContext, SessionTools, ThinkingLevel } from '@plotloom/contracts';
import type { Attachment } from '@plotloom/contracts/sources';
import { ATTACHMENT_TYPES, SOURCE_LIMITS } from '@plotloom/contracts/sources';
import type { SkillActivation, SkillInfo } from '@plotloom/contracts/skills';
import { TaskComposer, type ComposerMessage } from '@plotloom/ui/task-composer';
import { Button } from '@plotloom/ui/button';
import { Select } from '@plotloom/ui/select';
import { Switch } from '@plotloom/ui/switch';
import { FormField } from '@plotloom/ui/form-field';
import { requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { modelKey } from './new-chat-page';

const thinkingLabels: Record<ThinkingLevel, string> = { off: '关闭', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高' };

/** 组件保持纯 UI；这里负责公开协议转换、配置保存、附件上传及上下文刷新。 */
export function ChatComposer({ sessionId, projectPath, busy, activity, stopping, revision, onSubmit, onStop, onRefresh }: {
  sessionId: string; projectPath?: string; busy: boolean; activity?: string; stopping: boolean; revision: number;
  onSubmit: (message: ComposerMessage) => Promise<boolean>; onStop: () => void; onRefresh: () => void;
}) {
  const path = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [enabled, setEnabled] = useState<SkillActivation | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [compacting, setCompacting] = useState(false);
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
      requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, abort.signal),
      requestJson<SkillActivation>(`${path}/skills`, 'GET', undefined, abort.signal),
      requestJson<SessionTools>(`${path}/tools`, 'GET', undefined, abort.signal),
    ]).then(([list, saved, usage, library, activation, available]) => {
      if (abort.signal.aborted) return;
      setModels(list.models); setConfig(saved); setContext(usage); setSkills(library.skills); setEnabled(activation);
      setTools([...available.tools.filter(tool => tool.active).map(tool => tool.name), 'read_skill']); setFailed(false);
    }).catch(cause => { if (!abort.signal.aborted) { setFailed(true); notifyRequestError(cause, 'composer-load'); } });
    return () => abort.abort();
  }, [path, revision, reload]);

  /** 等待服务端成功后更新选中值；互斥锁堵住连续点击和发送之间的配置竞争。 */
  async function saveConfig(input: SessionConfigRequest) {
    if (operation.current || busy || compacting) throw new Error('当前任务处理中，请稍后调整配置。');
    operation.current = true; setSaving(true);
    try {
      const saved = await requestJson<SessionConfig>(`${path}/config`, 'PUT', input);
      if (mounted.current) { setConfig(saved); setReload(value => value + 1); }
    } finally { operation.current = false; if (mounted.current) setSaving(false); }
  }

  async function saveSkills(ids: string[]) {
    if (operation.current || busy) return;
    operation.current = true; setSaving(true);
    try { const saved = await requestJson<SkillActivation>(`${path}/skills`, 'PUT', { skillIds: ids }); if (mounted.current) setEnabled(saved); }
    catch (cause) { if (mounted.current) notifyRequestError(cause, 'composer-skills'); }
    finally { operation.current = false; if (mounted.current) setSaving(false); }
  }

  async function compact() {
    if (operation.current || busy) return;
    operation.current = true; setCompacting(true);
    try { await requestJson<CompactionResult>(`${path}/compact`, 'POST', {}); }
    catch (cause) { if (mounted.current) notifyRequestError(cause, 'composer-compact'); }
    finally {
      operation.current = false;
      if (mounted.current) { setCompacting(false); setReload(value => value + 1); onRefresh(); }
    }
  }

  const locked = busy || saving || compacting;
  const compactRunning = compacting || activity === 'compacting';
  const canStop = compactRunning || activity === 'generating';
  return <div className="plotloom-chat__input">
    <details className="plotloom-chat__settings">
      <summary>上下文与技能{enabled?.effectiveSkillIds.length ? ` · ${enabled.effectiveSkillIds.length} 个已启用` : ''}</summary>
      <div className="plotloom-chat__settings-body">
        <div className="plotloom-chat__context-actions">
          <span>{context ? `上下文 ${context.tokens === null ? '用量待估算' : `${context.tokens.toLocaleString()} / ${context.contextWindow.toLocaleString()} tokens`}` : '正在读取上下文…'}</span>
          <Switch size="sm" label="自动压缩" checked={config?.autoCompaction ?? true} disabled={!config || locked}
            onCheckedChange={checked => void saveConfig({ autoCompaction: checked }).catch(cause => notifyRequestError(cause, 'composer-auto-compact'))} />
          <Button size="sm" variant="text" disabled={!config || locked} onClick={() => void compact()}>立即压缩</Button>
        </div>
        <FormField label="本聊天启用的技能" description="启用后可通过 @ 或 / 选择本轮使用的技能；技能不会授予额外工具权限。">
          <Select multiple value={enabled?.effectiveSkillIds ?? []} disabled={!enabled || locked} onValueChange={ids => void saveSkills(ids)} aria-label="本聊天技能"
            options={skills.map(skill => ({ value: skill.id, label: skill.name + (skill.declaredTools.some(name => !tools.includes(name)) ? '（缺少工具）' : ''),
              disabled: skill.declaredTools.some(name => !tools.includes(name)) }))} placeholder="选择需要启用的技能" />
        </FormField>
        {enabled?.unavailable.map(item => <p key={item.id}>{item.reason}</p>)}
      </div>
    </details>
    {failed ? <Button size="sm" variant="text" onClick={() => setReload(value => value + 1)}>重试加载输入配置</Button> : null}
    {compacting ? <p role="status">正在压缩上下文…</p> : null}
    <TaskComposer options={{ height: 0, disabled: !config || failed, busy: locked, stopping,
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
      permissionOptions: false, advancedMentions: false, projectPath,
      skills: enabled?.skills.filter(skill => skill.runnable) ?? [], context: context ?? undefined,
      onSearchFiles: projectPath ? query => requestJson<ProjectFiles>(`${path}/project-files`, 'POST', { query }) : undefined,
      maxAttachments: SOURCE_LIMITS.attachmentCount, attachmentAccept: '.png,.jpg,.jpeg,.webp,.txt,.md,.markdown',
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
