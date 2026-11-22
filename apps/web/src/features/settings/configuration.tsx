import { useEffect, useState } from 'react';
import { Ellipsis, Plus, Search, Trash2 } from 'lucide-react';
import { ActionMenu, ActionMenuItem } from '@plotloom/ui/action-menu';
import { ProviderAvatar, ProviderDetail } from './provider-detail';
import { ProviderAvatarPicker } from './provider-avatar-picker';
import { SidebarNavItem } from '@plotloom/ui/sidebar/nav-item';
import { PROVIDER_APIS, type ModelConfig, type ModelInfo, type ProviderSettings, type ProviderWrite, type ThinkingLevel } from '@plotloom/contracts';
import { selectThinkingLevel, thinkingLabels } from '../agent/thinking-levels';
import type { SkillInfo } from '@plotloom/contracts/skills';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { Disclosure } from '@plotloom/ui/disclosure';
import { Select } from '@plotloom/ui/select';
import { FormField } from '@plotloom/ui/form-field';
import { Switch } from '@plotloom/ui/switch';
import { requestJson } from '../../utils/http';
import { runWithToast } from '../../utils/feedback';

async function loadModels(signal: AbortSignal) {
  const [models, defaults] = await Promise.all([
    requestJson<{ models: ModelInfo[] }>('/api/models', 'GET', undefined, signal),
    requestJson<ModelConfig>('/api/model-config', 'GET', undefined, signal),
  ]);
  return { models: models.models, defaults };
}
async function loadProviders(signal: AbortSignal) {
  const [directory, catalog] = await Promise.all([
    requestJson<{ providers: ProviderSettings[] }>('/api/providers', 'GET', undefined, signal),
    requestJson<{ models: ModelInfo[] }>('/api/models', 'GET', undefined, signal),
  ]);
  return { providers: directory.providers, models: catalog.models };
}
const loadSkills = (signal: AbortSignal) => requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, signal);

/** 切换分类时取消旧读取，保存成功后再读取后端已应用的配置。 */
function useSettingsData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void load(controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [load, revision]);
  return { data, setData, error, reload: () => setRevision(n => n + 1) };
}

/** 密钥输入始终从空值开始；编辑时留空表示沿用后端凭据。 */
function ProviderEditor({ provider, onClose, onSaved }: { provider: ProviderSettings | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [id, setId] = useState(provider?.id ?? '');
  const [generatedId] = useState(() => provider?.id ?? 'provider-' + crypto.randomUUID());
  const [name, setName] = useState(provider?.name || provider?.id || '');
  const [avatar, setAvatar] = useState(provider?.avatar ?? '');
  const [endpoints, setEndpoints] = useState(provider?.endpoints ?? []);
  const [address, setAddress] = useState(provider?.baseUrl ?? '');
  const [api, setApi] = useState(provider?.api ?? 'openai-completions');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    const body: ProviderWrite = { id: id.trim() || generatedId, name: name.trim(), avatar, endpoints, baseUrl: address.trim(), api,
      modelApis: Object.fromEntries(Object.entries(provider?.modelApis ?? {}).filter(([,protocol]) => endpoints.some(e => e.api === protocol))),
      models: provider?.models ?? [],
      ...(key.trim() ? { apiKey: key.trim() } : {}) };
    const result = await runWithToast(() => requestJson('/api/providers', provider ? 'PUT' : 'POST', body),
      { loading: '正在保存供应商…', success: '供应商已保存' });
    setBusy(false);
    if (result.ok) onSaved(body.id);
  }
  return <Dialog open className="plotloom-provider-dialog" title={provider ? '编辑供应商' : '添加自定义供应商'} onOpenChange={open => { if (!open && !busy) onClose(); }}
    footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" form="provider-form" loading={busy}>保存</Button></>}>
    <form id="provider-form" className="plotloom-provider-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <FormField label="供应商名称" required><Input required pattern=".*\S.*" maxLength={120} value={name} onValueChange={setName} /></FormField>
      <FormField label="API Key" required={!provider?.configured} description={provider?.configured ? '已配置。留空沿用已保存的密钥。' : undefined}>
        <Input required={!provider?.configured} pattern=".*\S.*" type="password" autoComplete="new-password" placeholder={provider?.configured ? '已配置' : '输入供应商 API Key'} value={key} onValueChange={setKey} /></FormField>
      <FormField label="服务地址" required><Input required type="url" placeholder="https://example.com/v1" value={address} onValueChange={setAddress} /></FormField>
      <Disclosure label="更多设置"><div className="plotloom-provider-form">
      <ProviderAvatarPicker name={name.trim() || 'P'} value={avatar} onChange={setAvatar} />
      <FormField label="供应商标识" description="供模型配置和聊天记录引用的固定 ID。留空自动生成，创建后无法更改。"><Input readOnly={!!provider} placeholder="自动生成" pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{0,99}" value={id} onValueChange={setId} /></FormField>
      <FormField label="接口协议"><Select clearable={false} searchable={false} value={api} onValueChange={v => {
        if (!v || v === api) return;
        const next = endpoints.find(e => e.api === v);
        if (next) { setEndpoints([...endpoints.filter(e => e !== next), { api, baseUrl: address }]); setAddress(next.baseUrl); }
        setApi(v);
      }}
        options={[...new Set([...PROVIDER_APIS, api])].map(value => ({ value, label: value }))} /></FormField>
      {PROVIDER_APIS.filter(protocol => protocol !== api).map(protocol => <FormField key={protocol} label={protocol + ' 端点（可选）'}>
        <Input type="url" value={endpoints.find(e => e.api === protocol)?.baseUrl ?? ''} onValueChange={v =>
          setEndpoints(old => [...old.filter(e => e.api !== protocol && e.api !== api), ...(v ? [{ api: protocol, baseUrl: v }] : [])])} /></FormField>)}
      </div></Disclosure>
    </form>
  </Dialog>;
}

const modelKey = (m: ModelInfo) => JSON.stringify([m.provider, m.id]);
/** 默认模型和思考档位成对提交，之后创建的新聊天读取该选择。 */
function DefaultModel({ models, defaults, onSaved }: { models: ModelInfo[]; defaults: ModelConfig; onSaved: () => void }) {
  const [selected, setSelected] = useState(JSON.stringify([defaults.provider, defaults.model]));
  const [thinking, setThinking] = useState<ThinkingLevel>(defaults.thinkingLevel);
  const [busy, setBusy] = useState(false);
  const available = models.filter(m => m.configured);
  const model = available.find(m => modelKey(m) === selected);
  async function save() {
    if (!model || busy) return;
    setBusy(true);
    const result = await runWithToast(() => requestJson('/api/model-config', 'PUT', { provider: model.provider, model: model.id, thinkingLevel: thinking }),
      { loading: '正在保存默认模型…', success: '新聊天默认配置已保存' });
    setBusy(false); if (result.ok) onSaved();
  }
  return <SettingsSection title="新聊天默认配置">
    <SettingsRow title="默认模型" description="可选择已配置凭据的供应商模型。"><Select aria-label="默认模型" value={model ? selected : null} clearable={false}
      disabled={busy || !available.length} options={available.map(m => ({ value: modelKey(m), label: m.provider + ' / ' + m.name }))}
      onValueChange={v => { if (v) { setSelected(v); setThinking(selectThinkingLevel(available.find(m => modelKey(m) === v)?.thinkingLevels, thinking)); } }} /></SettingsRow>
    <SettingsRow title="默认思考档位"><Select aria-label="默认思考档位" value={thinking} disabled={busy || !model} clearable={false} searchable={false}
      options={(model?.thinkingLevels ?? ['off']).map(value => ({ value, label: thinkingLabels[value] }))}
      onValueChange={v => v && setThinking(v as ThinkingLevel)} /></SettingsRow>
    <Button size="sm" variant="secondary" disabled={!model} loading={busy} onClick={() => void save()}>保存默认配置</Button>
  </SettingsSection>;
}

export function DefaultModelConfiguration({ onChange }: { onChange: () => void }) {
  const { data, error, reload } = useSettingsData(loadModels);
  if (error) return <p role="alert">{error} <Button onClick={reload}>重试</Button></p>;
  if (!data) return <p role="status">正在读取默认模型…</p>;
  return <DefaultModel key={JSON.stringify(data.defaults)} models={data.models} defaults={data.defaults} onSaved={() => { reload(); onChange(); }} />;
}

/** 搜索只筛选本机配置的供应商；右侧能力来自模型目录，密钥只显示配置状态。 */
export function ProviderConfiguration({ onChange }: { onChange: () => void }) {
  const { data, error, reload } = useSettingsData(loadProviders);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [editor, setEditor] = useState<ProviderSettings | null | undefined>();
  const [removing, setRemoving] = useState<ProviderSettings>();
  const [deleting, setDeleting] = useState(false);
  const visible = data?.providers.filter(p => (p.id + ' ' + (p.name ?? '')).toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const provider = visible.find(p => p.id === selected) ?? visible[0];
  const models = data?.models.filter(m => m.provider === provider?.id) ?? [];
  return <div className="plotloom-model-service">
    <nav className="plotloom-provider-list" aria-label="供应商列表">
      <Input type="search" aria-label="搜索供应商" placeholder="搜索供应商…" startIcon={<Search />} value={query} onValueChange={setQuery} clearable />
      <div className="plotloom-provider-items">
        {visible.map(p => <SidebarNavItem key={p.id} label={(p.name || p.id) + (p.enabled === false ? '（已停用）' : '')} active={p.id === provider?.id}
          icon={<span className="plotloom-provider-initial"><ProviderAvatar avatar={p.avatar} name={p.name || p.id} /></span>}
          actions={<ActionMenu trigger={<Button variant="ghost" size="sm" iconOnly tooltip aria-label={(p.name || p.id) + ' 的更多操作'}><Ellipsis /></Button>}>
            <ActionMenuItem danger icon={<Trash2 />} onSelect={() => setRemoving(p)}>删除供应商</ActionMenuItem>
          </ActionMenu>} onClick={() => { setCreatedId(''); setSelected(p.id); }} />)}
      </div>
      <Button variant="secondary" startIcon={<Plus />} onClick={() => setEditor(null)}>添加供应商</Button>
    </nav>
    <section className="plotloom-provider-detail" aria-label="模型服务">
      {error ? <p role="alert">{error} <Button onClick={reload}>重试</Button></p> : !data ? <p role="status">正在读取供应商…</p> : provider ? <>
        <ProviderDetail key={provider.id} initialManage={createdId === provider.id} provider={provider} models={models} onSaved={() => { setCreatedId(''); reload(); onChange(); }} />
      </> : <p>{query.trim() ? '没有匹配的供应商' : '添加供应商后，可在这里管理服务地址、密钥和模型。'}</p>}
    </section>
    {editor !== undefined ? <ProviderEditor provider={editor} onClose={() => setEditor(undefined)} onSaved={id => {
      setCreatedId(editor === null ? id : ''); setEditor(undefined); setSelected(id); setQuery(''); reload(); onChange();
    }} /> : null}
    {removing && <Dialog open title="删除供应商" onOpenChange={open => { if (!open && !deleting) setRemoving(undefined); }}
      footer={<><Button variant="ghost" disabled={deleting} onClick={() => setRemoving(undefined)}>取消</Button>
        <Button danger loading={deleting} onClick={async () => {
          setDeleting(true);
          const result = await runWithToast(() => requestJson('/api/providers/' + encodeURIComponent(removing.id), 'DELETE'),
            { loading: '正在删除供应商…', success: '供应商已删除' });
          setDeleting(false);
          if (result.ok) { setRemoving(undefined); reload(); onChange(); }
        }}>确认删除</Button></>}>
      <p>删除「{removing.name || removing.id}」及其本机保存的密钥和模型配置？</p>
    </Dialog>}
  </div>;
}

/** 全局技能准入影响下一轮聊天；依赖及每个工作区的选择仍由服务端判断。 */
export function GlobalSkills({ onChange }: { onChange: () => void }) {
  const { data, setData, error, reload } = useSettingsData(loadSkills);
  const [pending, setPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  async function toggle(skill: SkillInfo, enabled: boolean) {
    setPending(skill.id); setSaveError('');
    try {
      const updated = await requestJson<SkillInfo>('/api/skills/' + encodeURIComponent(skill.id) + '/enabled', 'PUT', { enabled });
      setData(current => current && ({ skills: current.skills.map(s => s.id === skill.id ? updated : s) }));
      onChange();
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : '技能设置保存失败'); }
    finally { setPending(null); }
  }
  if (error) return <p role="alert">{error} <Button onClick={reload}>重试</Button></p>;
  if (!data) return <p role="status">正在读取技能…</p>;
  return <><SettingsSection title="全局启用" description="修改从下一轮聊天起生效。">
    {data.skills.map(s => <SettingsRow key={s.id} title={s.name} description={s.description}>
      <Switch aria-label={s.name} checked={s.enabled} disabled={pending !== null} onCheckedChange={v => void toggle(s, v)} /></SettingsRow>)}
  </SettingsSection><p role="alert">{saveError}</p></>;
}
