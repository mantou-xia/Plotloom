import { useRef, useState, type FormEvent } from 'react';
import { Activity, Box, Cloud, Copy, Cpu, Eye, Lightbulb, RefreshCw, Server, Trash2 } from 'lucide-react';
import { PROVIDER_APIS, type ModelInfo, type ProviderSettings, type ProviderWrite } from '@plotloom/contracts';
import { Button } from '@plotloom/ui/button';
import { ProviderModelManager } from './provider-model-manager';
import { Disclosure } from '@plotloom/ui/disclosure';
import { Notice, type NoticeTone } from '@plotloom/ui/notice';
import { ProviderAvatarPicker } from './provider-avatar-picker';
import { Input } from '@plotloom/ui/input';
import { Select } from '@plotloom/ui/select';
import { Switch } from '@plotloom/ui/switch';
import { requestJson } from '../../utils/http';

/** 上传头像只显示本机保存的图片；内置头像和首字使用项目图标及主题色。 */
export function ProviderAvatar({ avatar, name }: { avatar?: string; name: string }) {
  if (avatar?.startsWith('data:image/')) return <img className="plotloom-provider-picture" src={avatar} alt="" />;
  return avatar === 'cloud' ? <Cloud /> : avatar === 'cpu' ? <Cpu /> : avatar === 'box' ? <Box /> : <Server aria-label={name} />;
}

/** 模型管理只从已配置端点读取目录，新增供应商后直接打开列表。 */
export function ProviderDetail({ provider: p, models, onSaved, initialManage }: {
  provider: ProviderSettings; models: ModelInfo[]; onSaved: () => void; initialManage: boolean;
}) {
  const [api, setApi] = useState(p.api);
  const endpoints = [p, ...(p.endpoints ?? [])];
  const endpoint = endpoints.find(e => e.api === api) ?? p;
  const [query, setQuery] = useState('');
  const [manage, setManage] = useState(initialManage);
  const [draft, setDraft] = useState<Partial<Pick<ProviderWrite, 'name' | 'avatar' | 'baseUrl' | 'endpoints' | 'apiKey'>>>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ tone: NoticeTone; message: string }>();
  const title = p.name || p.id;
  const choices = endpoints.map(e => ({ value: e.api, label: e.api }));
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFeedback(undefined);
    try { await action(); } catch (error) { setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '操作失败，请重试' }); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(patch: Partial<ProviderWrite>) {
    const { configured: _, ...fields } = p;
    await requestJson('/api/providers', 'PUT', { ...fields, ...patch });
    onSaved();
  }
  /** 地址和凭据一次提交；换域名时服务端可验证新的 Key 与地址同批保存。 */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { apiKey, ...fields } = draft;
    void run(async () => {
      await save({ ...fields, ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}) });
      setDraft({}); setFeedback({ tone: 'success', message: '供应商设置已保存。' });
    });
  }
  /** 在点击事件内申请剪贴板写入，密钥只在异步 Blob 中传递。 */
  async function copyKey() {
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': requestJson<{ apiKey: string }>(
      '/api/providers/' + encodeURIComponent(p.id) + '/credential', 'POST', {}
    ).then(result => new Blob([result.apiKey], { type: 'text/plain' })) })]);
    setFeedback({ tone: 'success', message: 'API Key 已复制。' });
  }
  const dirty = Object.keys(draft).length > 0;
  const extraEndpoints = draft.endpoints ?? p.endpoints ?? [];
  const shown = p.models.filter(id => (id + ' ' + (models.find(m => m.id === id)?.name ?? '')).toLowerCase().includes(query.toLowerCase()));
  return <>
    <header><h2>{title}</h2><Switch aria-label="启用供应商" checked={p.enabled !== false} disabled={busy} onCheckedChange={enabled => void run(() => save({ enabled }))} /></header>
    <form className="plotloom-provider-inline" onSubmit={submit}>
      <div className="plotloom-provider-field"><label htmlFor="provider-key">API 密钥</label>
        <div className="plotloom-provider-key">
          <Input id="provider-key" type="password" autoComplete="new-password" placeholder={p.configured ? '••••••••••••' : '输入 API Key'}
            value={draft.apiKey ?? ''} onValueChange={apiKey => setDraft(current => ({ ...current, apiKey }))} disabled={busy} />
          <Button variant="ghost" iconOnly tooltip aria-label="复制 API Key" disabled={busy || !p.configured} onClick={() => void run(copyKey)}><Copy /></Button>
          <Button variant="ghost" iconOnly tooltip={dirty ? '保存更改后检测连接' : true} aria-label="检测连接" disabled={busy || dirty || !p.configured}
            onClick={() => void run(async () => {
              await requestJson('/api/providers/check', 'POST', { id: p.id, api: endpoint.api });
              setFeedback({ tone: 'success', message: '连接成功，已读取模型目录。' });
            })}><Activity /></Button>
        </div>
      </div>
      <div className="plotloom-provider-field"><label htmlFor="provider-endpoint">协议端点</label>
        <Select id="provider-endpoint" options={choices} value={endpoint.api} onValueChange={v => { if (v) { setApi(v); setFeedback(undefined); } }}
          clearable={false} searchable={false} disabled={busy} />
      </div>
      <div className="plotloom-provider-field"><label htmlFor="provider-address">API 地址</label>
        <Input id="provider-address" type="url" required disabled={busy}
          value={endpoint.api === p.api ? draft.baseUrl ?? p.baseUrl : extraEndpoints.find(e => e.api === endpoint.api)?.baseUrl ?? endpoint.baseUrl}
          onValueChange={baseUrl => setDraft(current => endpoint.api === p.api ? { ...current, baseUrl } :
            { ...current, endpoints: extraEndpoints.map(e => e.api === endpoint.api ? { ...e, baseUrl } : e) })} />
      </div>
      <Disclosure label="更多设置"><div className="plotloom-provider-form">
        <ProviderAvatarPicker name={draft.name ?? title} value={draft.avatar ?? p.avatar ?? ''} onChange={avatar => setDraft(current => ({ ...current, avatar }))} />
        <Input aria-label="供应商名称" required value={draft.name ?? title} maxLength={120} onValueChange={name => setDraft(current => ({ ...current, name }))} />
        {PROVIDER_APIS.filter(protocol => protocol !== p.api).map(protocol => {
          const used = Object.values(p.modelApis ?? {}).includes(protocol);
          return <div className="plotloom-provider-field" key={protocol}><label htmlFor={'endpoint-' + protocol}>{protocol} 端点</label>
            <Input id={'endpoint-' + protocol} type="url" required={used} value={extraEndpoints.find(e => e.api === protocol)?.baseUrl ?? ''}
              onValueChange={baseUrl => setDraft(current => ({ ...current, endpoints: [
                ...extraEndpoints.filter(e => e.api !== protocol), ...(baseUrl ? [{ api: protocol, baseUrl }] : []),
              ] }))} /></div>;
        })}
      </div></Disclosure>
      <div className="plotloom-provider-save"><Button size="sm" variant="secondary" disabled={busy || !dirty} onClick={() => setDraft({})}>撤销更改</Button>
        <Button size="sm" type="submit" disabled={!dirty} loading={busy}>保存更改</Button></div>
      <div className="plotloom-provider-notice">{feedback ? <Notice tone={feedback.tone}>{feedback.message}</Notice> : null}</div>
    </form>
    <header><h3>模型 <small>{p.models.length}</small></h3><div className="plotloom-provider-actions">
      <Button size="sm" variant="secondary" startIcon={<RefreshCw />} disabled={busy || dirty || !p.configured} onClick={() => setManage(true)}>获取模型列表</Button></div></header>
    <Input aria-label="搜索模型" placeholder="搜索模型名称或 ID" type="search" value={query} onValueChange={setQuery} clearable />
    <ul>{shown.map(id => {
      const model = models.find(m => m.id === id);
      return <li key={id}><Box size={16} /><span>{model?.name || id}<small>{id} · {p.modelApis?.[id] ?? p.api}</small></span>
        {model?.input.includes('image') && <Eye size={16} aria-label="支持图片输入" />}
        {model?.reasoning && <Lightbulb size={16} aria-label="支持推理" />}
        <Button size="sm" variant="ghost" iconOnly tooltip aria-label={'移除模型 ' + id} disabled={busy} onClick={() => void run(() => save({ models: p.models.filter(m => m !== id) }))}><Trash2 /></Button></li>;
    })}</ul>
    {!shown.length && <p>{query ? '没有匹配的模型' : '尚未添加模型'}</p>}
    <ProviderModelManager provider={p} api={endpoint.api} open={manage} onSaved={onSaved} onClose={() => setManage(false)} />
  </>;
}
