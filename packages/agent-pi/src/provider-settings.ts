import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import type { Api, Model } from '@earendil-works/pi-ai/compat';
import { PROVIDER_APIS, type ProviderSettings, type ProviderWrite } from '@plotloom/contracts';
import { AgentError } from './errors.ts';
import type { AgentOptions } from './index.ts';

type ModelCapability = Pick<Model<Api>, 'id' | 'reasoning' | 'thinkingLevelMap'>;
type CapabilityCatalog = { providers: Record<string, { api: string; models: ModelCapability[] }> };

async function readOptional<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
}

/** 只在私有数据目录保存覆盖值；原始 SDK 文件继续提供模型能力和环境凭据。 */
export class ProviderStore {
  private writes = Promise.resolve();
  private saved: (ProviderWrite & { removed?: boolean })[] = [];
  private customIds: string[] = [];
  private modelCapabilities = new Map<string, ModelCapability>();
  private readonly path: string;
  runtime!: ModelRuntime;
  private readonly options: AgentOptions;
  constructor(options: AgentOptions) {
    this.options = options;
    this.path = join(options.dataDir, 'agent', 'providers.json');
  }

  async load() {
    this.saved = await readOptional<ProviderWrite[]>(this.path, []);
    const source = this.options.modelsPath ? await readOptional<{ providers?: Record<string, unknown> }>(this.options.modelsPath, {}) : {};
    this.customIds = Object.keys(source.providers ?? {});
    if (this.options.modelCapabilitiesPath) {
      const catalog = JSON.parse(await readFile(this.options.modelCapabilitiesPath, 'utf8')) as CapabilityCatalog;
      // 只拿同协议、同模型 ID 的思考能力。目录里的供应商地址和凭据不参与桌面配置。
      for (const { api, models } of Object.values(catalog.providers)) {
        for (const model of models) this.modelCapabilities.set(`${api}\0${model.id}`, model);
      }
    }
    this.runtime = await this.build(this.saved);
  }

  /** 构建独立运行时后才发布，使在途生成保留原凭据和模型快照。 */
  private async build(entries: typeof this.saved) {
    const dir = join(this.options.dataDir, 'agent');
    const runtime = await ModelRuntime.create({ authPath: join(dir, 'auth.json'), modelsPath: this.options.modelsPath ?? null,
      modelsStorePath: join(dir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
    if (runtime.getError()) throw new AgentError(422, 'MODEL_CONFIG_INVALID', '本机模型配置无效。');
    if (this.options.apiKey && this.options.defaultModel) await runtime.setRuntimeApiKey(this.options.defaultModel.provider, this.options.apiKey);
    for (const entry of entries) {
      if (entry.removed) continue;
      const models = entry.models.map(id => {
        const original = runtime.getModel(entry.id, id);
        const protocol = entry.modelApis?.[id];
        const endpoint = entry.endpoints?.find(e => e.api === protocol) ?? entry;
        const capability = this.modelCapabilities.get(`${endpoint.api}\0${id}`);
        return { ...(original ?? { id, name: id, reasoning: capability?.reasoning ?? false, thinkingLevelMap: capability?.thinkingLevelMap,
          input: ['text'] as ['text'], contextWindow: 128000, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }), api: endpoint.api as Api, baseUrl: endpoint.baseUrl };
      });
      runtime.registerProvider(entry.id, { api: entry.api as Api, baseUrl: entry.baseUrl, models });
      // 使用凭据接口传入字面密钥，避免 SDK 把密钥作为环境变量或命令表达式解析。
      if (entry.apiKey) await runtime.setRuntimeApiKey(entry.id, entry.apiKey);
    }
    return runtime;
  }

  async list(): Promise<ProviderSettings[]> {
    const runtime = this.runtime;
    const ids = new Set([...this.customIds, ...this.saved.map(entry => entry.id)]);
    const result: ProviderSettings[] = [];
    for (const id of ids) {
      const saved = this.saved.find(item => item.id === id);
      if (saved?.removed) continue;
      const models = runtime.getModels(id);
      if (!models.length && !saved) continue;
      const first = models[0];
      result.push({ id, api: saved?.api ?? first.api, baseUrl: saved?.baseUrl ?? first.baseUrl,
        name: saved?.name ?? id, avatar: saved?.avatar ?? '', enabled: saved?.enabled ?? true,
        endpoints: saved?.endpoints ?? [], modelApis: saved?.modelApis ?? {},
        models: saved?.models ?? models.map(model => model.id), configured: !!(await runtime.getAuth(id)) });
    }
    return result;
  }

  enabled(id: string) {
    const entry = this.saved.find(p => p.id === id);
    return !entry?.removed && entry?.enabled !== false;
  }

  removed(id: string) { return this.saved.some(p => p.id === id && p.removed); }

  /** 只在用户明确复制时解析有效凭据，列表和常规保存响应保持脱敏。 */
  async copyCredential(id: string) {
    if (!(await this.list()).some(provider => provider.id === id)) throw new AgentError(404, 'PROVIDER_NOT_FOUND', '供应商不存在。');
    const key = (await this.runtime.getAuth(id))?.auth.apiKey;
    if (!key) throw new AgentError(422, 'PROVIDER_KEY_REQUIRED', '请先保存 API Key。');
    return key;
  }

  /** 文件来源的供应商以删除标记屏蔽，避免重启后重新出现；删除同时清掉本地覆盖凭据。 */
  remove(id: string) {
    const operation = this.writes.then(async () => {
      const existing = (await this.list()).find(p => p.id === id);
      if (!existing) throw new AgentError(404, 'PROVIDER_NOT_FOUND', '供应商不存在。');
      const next = this.saved.filter(p => p.id !== id);
      if (this.customIds.includes(id)) next.push({ id, api: existing.api, baseUrl: existing.baseUrl, models: [], removed: true });
      await this.commit(next);
      return { saved: true };
    });
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }

  /** 检测与同步均针对已保存的端点；单一凭据只在服务端加入请求，禁止转发重定向。 */
  async discover(id: string, api: string | undefined, checkOnly: boolean) {
    const auth = this.runtime;
    const provider = (await this.list()).find(p => p.id === id);
    if (!provider) throw new AgentError(404, 'PROVIDER_NOT_FOUND', '供应商不存在。');
    const endpoint = [provider, ...(provider.endpoints ?? [])].find(e => !api || e.api === api);
    if (!endpoint) throw new AgentError(400, 'INVALID_REQUEST', '未配置此端点。');
    const credential = (await auth.getAuth(id))?.auth;
    if (!credential?.apiKey) throw new AgentError(422, 'PROVIDER_KEY_REQUIRED', '请先保存 API Key。');
    const url = new URL(endpoint.baseUrl.replace(/\/+$/, '') + '/models');
    if (endpoint.api === 'anthropic-messages' && url.pathname === '/models') url.pathname = '/v1/models';
    const headers: Record<string, string> = endpoint.api === 'anthropic-messages'
      ? { 'x-api-key': credential.apiKey, 'anthropic-version': '2023-06-01' } : { Authorization: 'Bearer ' + credential.apiKey };
    try {
      const signal = AbortSignal.timeout(15000);
      const ids = new Set<string>();
      const cursors = new Set<string>();
      // Anthropic 的目录分页；检测只验证首个目录响应，完整同步按游标取回。
      for (;;) {
        const response = await fetch(url, { headers, signal, redirect: 'error' });
        if (!response.ok) { await response.body?.cancel(); throw new Error(); }
        const page = await response.json() as { data: { id: string }[]; has_more?: boolean; last_id?: string };
        if (!Array.isArray(page.data) || !page.data.every(m => typeof m?.id === 'string' && m.id.trim())) throw new Error();
        if (checkOnly) return { connected: true };
        for (const model of page.data) ids.add(model.id);
        if (!page.has_more) break;
        if (!page.last_id || cursors.has(page.last_id)) throw new Error();
        cursors.add(page.last_id); url.searchParams.set('after_id', page.last_id);
      }
      return { models: [...ids] };
    } catch { throw new AgentError(502, 'PROVIDER_DISCOVERY_FAILED', '无法读取模型目录，请检查端点、凭据和服务对模型列表的支持。'); }
  }

  private async commit(next: typeof this.saved) {
    const candidate = await this.build(next);
    const temp = this.path + '.' + crypto.randomUUID() + '.tmp';
    try {
      await writeFile(temp, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      await rename(temp, this.path);
    } finally { await rm(temp, { force: true }); }
    this.saved = next;
    this.runtime = candidate;
  }

  /** 串行重读当前快照，完整校验并原子替换；创建冲突或写盘失败不会改变现行配置。 */
  save(input: ProviderWrite, create: boolean) {
    const operation = this.writes.then(async () => {
      const prior = (await this.list()).find(entry => entry.id === input.id);
      if (create && (prior || (this.runtime.getProvider(input.id) && !this.saved.some(p => p.id === input.id && p.removed)))) throw new AgentError(409, 'PROVIDER_EXISTS', '供应商标识已存在。');
      if (!create && !prior) throw new AgentError(404, 'PROVIDER_NOT_FOUND', '供应商不存在。');
      if (!prior?.configured && !input.apiKey?.trim()) throw new AgentError(422, 'PROVIDER_KEY_REQUIRED', '请填写供应商 API Key。');
      const url = URL.canParse(input.baseUrl) ? new URL(input.baseUrl) : null;
      const models = input.models.map(id => id.trim());
      if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        !models.every(Boolean) || new Set(models).size !== models.length || (input.apiKey !== undefined && !input.apiKey.trim()) ||
        !(PROVIDER_APIS.some(api => api === input.api) || prior?.api === input.api))
        throw new AgentError(400, 'INVALID_REQUEST', '请检查服务地址、协议、密钥及模型标识，模型不可重复。');
      const endpoints = input.endpoints ?? prior?.endpoints ?? [];
      const all = [input, ...endpoints];
      const protocols = new Set(all.map(e => e.api));
      const modelApis = Object.fromEntries(Object.entries(input.modelApis ?? prior?.modelApis ?? {}).filter(([id]) => models.includes(id)));
      if (protocols.size !== all.length || endpoints.some(e => !PROVIDER_APIS.some(api => api === e.api)) ||
        all.some(e => { const u = URL.canParse(e.baseUrl) && new URL(e.baseUrl); return !u || !['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash; }) ||
        Object.values(modelApis).some(api => !protocols.has(api))) throw new AgentError(400, 'INVALID_REQUEST', '请检查协议、端点和模型的对应关系。');
      const origins = new Set(prior && [prior, ...(prior.endpoints ?? [])].map(e => new URL(e.baseUrl).origin));
      // 重建被屏蔽的文件供应商也可能继承环境密钥，必须由用户显式授权新目的地。
      if (!input.apiKey && (prior?.configured && all.some(e => !origins.has(new URL(e.baseUrl).origin)) ||
        !prior && await this.runtime.getAuth(input.id)))
        throw new AgentError(422, 'PROVIDER_KEY_REQUIRED', '更换服务域名时，请重新填写该服务的密钥。');
      const previous = this.saved.find(entry => entry.id === input.id);
      const next = [...this.saved.filter(entry => entry.id !== input.id), { ...previous, ...input, removed: false, models, endpoints, modelApis, apiKey: input.apiKey ?? previous?.apiKey }];
      await this.commit(next);
      return { saved: true };
    });
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }
}
