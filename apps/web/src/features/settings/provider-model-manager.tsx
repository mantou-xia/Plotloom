import { useEffect, useState } from 'react';
import { Box, Check, Minus, Plus, RefreshCw, Search } from 'lucide-react';
import type { ProviderSettings } from '@plotloom/contracts';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { Drawer } from '@plotloom/ui/drawer';
import { requestJson } from '../../utils/http';

/** 打开时读取所选端点的目录。逐行操作成功后才更新本地选择，失败可直接重试。 */
export function ProviderModelManager({ provider, api, open, onSaved, onClose }: {
  provider: ProviderSettings; api: string; open: boolean; onSaved: () => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<{ source: ProviderSettings; value: ProviderSettings }>();
  const saved = local?.source === provider ? local.value : provider;
  const [remote, setRemote] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void requestJson<{models: string[]}>('/api/providers/discover', 'POST', { id: provider.id, api }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRemote(result.models); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, provider.id, revision, open]);
  async function toggle(id: string) {
    if (pending) return;
    const added = saved.models.includes(id);
    const { configured, ...fields } = saved;
    const modelApis = { ...fields.modelApis };
    if (added) delete modelApis[id]; else modelApis[id] = api;
    const next = { ...fields, models: added ? fields.models.filter(m => m !== id) : [...fields.models, id], modelApis };
    setPending(id); setError('');
    try { await requestJson('/api/providers', 'PUT', next); setLocal({ source: provider, value: { ...next, configured } }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '模型保存失败'); }
    finally { setPending(''); }
  }
  const visible = remote.filter(id => id.toLowerCase().includes(query.trim().toLowerCase()));
  return <Drawer open={open} title={(provider.name || provider.id) + ' · 模型管理'}
    onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <div className="plotloom-model-search"><Input type="search" aria-label="搜索上游模型" placeholder="搜索模型" startIcon={<Search />} value={query} onValueChange={setQuery} />
      <Button variant="ghost" iconOnly tooltip aria-label="刷新上游模型" disabled={loading || !!pending} onClick={() => setRevision(r => r + 1)}><RefreshCw /></Button></div>
    <ul className="plotloom-remote-models" aria-busy={loading}>{visible.map(id => {
      const added = saved.models.includes(id);
      return <li key={id}><Box size={16} aria-hidden="true" /><span>{id}</span>{added && <Check size={15} aria-label="已添加" />}
        <Button size="sm" variant="ghost" iconOnly tooltip aria-label={(added ? '移除 ' : '添加 ') + id} loading={pending === id} disabled={!!pending || loading}
          onClick={() => void toggle(id)}>{added ? <Minus /> : <Plus />}</Button></li>;
    })}</ul>
    <p role="status">{error || (loading ? '正在获取模型列表…' : !visible.length ? (query ? '没有匹配的模型' : '服务未返回模型') : '')}</p>
  </Drawer>;
}
