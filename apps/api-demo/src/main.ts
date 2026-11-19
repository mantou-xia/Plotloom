import { API_CATALOG, API_MODULES, API_ERRORS, SSE_EVENTS, type EndpointDoc, type FieldDoc } from '@plotloom/contracts/catalog';
import type { AgentEvent, ModelConfig, ModelInfo, SessionListItem } from '@plotloom/contracts';
import { iconMarkup } from '@plotloom/ui/icons/dom';
import { checkFields, checkJson, checkStream, consumeSse, isObject, type CheckResult, type StreamItem } from './client.ts';
import { uploadDraft, attachmentPreview, appendSourceDraft } from './sources.ts';
import './style.css';

type Phase = 'running' | 'success' | 'error' | 'stopped' | 'disconnected';
interface Run {
  phase: Phase; url: string; sessionId: string; started: number; elapsed: number; status?: number;
  body?: unknown; headers: Record<string, string>; events: StreamItem[]; text: string; thinking: string;
  checks: CheckResult[]; error?: string; controller: AbortController;
}
const endpointById = new Map(API_CATALOG.map((item) => [item.id, item]));
let selected = endpointById.get(location.hash.slice(1)) ?? endpointById.get('sessions.create')!;
let sessionId = sessionStorage.getItem('plotloom.demo.session') ?? '';
const assetParameters: Record<string, string> = Object.fromEntries(['workspaceId', 'proposalId', 'changeId', 'skillId', 'attachmentId'].map((name) => [name, sessionStorage.getItem(`plotloom.demo.${name}`) ?? '']));
function setAssetParameter(name: string, value: string) {
  assetParameters[name] = value; sessionStorage.setItem(`plotloom.demo.${name}`, value);
  const input = byId<HTMLInputElement>(`path-${name}`); if (input) input.value = value;
}
let sessions: SessionListItem[] = [];
let config: ModelConfig | undefined;
let models: ModelInfo[] = [];
let connection: 'checking' | 'online' | 'offline' = 'checking';
let docsTab = 'request';
let resultTab = 'result';
let query = '';
const drafts = new Map(API_CATALOG.map((item) => [item.id, item.examples.length ? JSON.stringify(item.examples[0].body, null, 2) : '']));
// 示例选择与草稿共同按接口保存，切换说明页后仍能恢复正确的示例。
const exampleSelections = new Map<string, number>();
const runs = new Map<string, Run>();
let uploadReading = false;
let uploadReadId = 0;
const app = document.querySelector<HTMLDivElement>('#app')!;
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const pretty = (value: unknown) => JSON.stringify(value, null, 2) ?? '';
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

app.innerHTML = `
  <a class="skip-link" href="#endpoint-title">跳到接口内容</a>
  <header class="topbar">
    <a class="brand" href="#sessions.create"><span class="brand-mark" aria-hidden="true">P<span>/</span></span><span>Plotloom<span class="brand-sub">开发者工作台</span></span></a>
    <div class="top-title">接口试验台 <span class="tag">P3 · DEMO</span></div>
    <div class="top-actions"><span id="connection" role="status"></span><button id="refresh" class="button quiet">重新检测</button></div>
  </header>
  <div class="workspace">
    <aside class="sidebar" aria-label="接口目录">
      <div class="sidebar-heading"><span>接口目录</span><span class="count">${API_CATALOG.length}</span></div>
      <label class="search-label" for="search">搜索接口</label>
      <input id="search" type="search" placeholder="名称、路径或方法…" autocomplete="off" />
      <nav id="catalog" aria-label="按模块浏览"></nav>
      <div class="sidebar-footer"><span class="mono">HTTP + SSE</span><p>每个请求有据可查。</p><p class="muted">从模型配置到生成结果，在一个页面完成检查。</p></div>
    </aside>
    <main class="main">
      <section class="workspace-heading"><div><div class="breadcrumb">开发与验证 <span>/</span> 通用 Agent</div><h1>接口试验台<span class="heading-dot">.</span></h1><p>了解接口，调整参数，查看真实响应。</p></div><div class="api-target"><span>本机服务</span><code>${escape(__API_TARGET__)}</code></div></section>
      <section class="session-context" aria-label="当前测试会话">
        <div class="context-label"><span class="context-symbol">${iconMarkup('Hash', 22)}</span><div><strong>测试会话</strong><span>用于路径中的 :id</span></div></div>
        <label class="sr-only" for="session-id">会话 ID</label><input id="session-id" aria-describedby="session-help" placeholder="创建会话后自动填入，也可粘贴 ID" value="${escape(sessionId)}" autocomplete="off" />
        <label class="sr-only" for="session-picker">选择已有会话</label><select id="session-picker"><option value="">选择已有会话</option></select>
        <button id="stop-active" class="button secondary" title="对当前测试会话调用停止接口">停止生成</button>
      </section>
      <div id="session-help" class="context-help">新建会话后自动沿用 ID；切换接口时，参数草稿和检查结果会保留。</div>
      <div id="connection-note" class="connection-note" role="status"></div>
      <div class="workbench">
        <article class="request-panel"><div id="endpoint-header"></div><div id="doc-tabs" class="tabs" aria-label="接口说明"></div><div id="documentation"></div></article>
        <aside class="response-panel" aria-label="接口检查结果"><div class="response-heading"><div><span class="eyebrow">LIVE RESPONSE</span><h2>检查结果</h2></div><span id="result-state" class="tag">等待请求</span></div>
          <div id="result-meta"></div><div id="result-tabs" class="tabs"></div><div id="result-content" aria-live="off"></div>
          <div class="response-footer"><span class="status-dot"></span><span>结果来自实际接口调用</span><button id="copy-result" class="text-button">复制结果</button></div>
        </aside>
      </div>
      <footer class="page-footer"><span>Plotloom / API Explorer</span><span>${API_MODULES.length} 个模块 · ${API_CATALOG.length} 个接口 · 本机环境</span></footer>
    </main>
  </div><div id="notice" class="notice" role="status" aria-live="polite"></div>`;

/** 目录渲染自单一注册表；过滤只改变可见导航，不丢失正在执行的请求。 */
function renderCatalog() {
  byId('catalog').innerHTML = API_MODULES.map((module) => {
    const items = API_CATALOG.filter((item) => item.module === module.id && `${item.name} ${item.path} ${item.method} ${module.name}`.toLowerCase().includes(query.toLowerCase()));
    if (!items.length) return '';
    return `<section class="nav-group"><h2><span>${module.name}</span><span>${String(items.length).padStart(2, '0')}</span></h2>${items.map((item) =>
      `<a class="endpoint-link ${selected.id === item.id ? 'selected' : ''}" href="#${item.id}" ${selected.id === item.id ? 'aria-current="page"' : ''}><span class="method ${item.method.toLowerCase()}">${item.method}</span><span>${item.name}</span><span class="nav-run" data-phase="${runs.get(item.id)?.phase ?? ''}" aria-label="${runs.get(item.id)?.phase === 'running' ? '执行中' : ''}"></span></a>`).join('')}</section>`;
  }).join('') || '<p class="empty-nav">没有匹配的接口，请换个关键词。</p>';
}

function fieldTable(fields: readonly FieldDoc[]) {
  return `<div class="field-table" role="table" aria-label="字段说明"><div class="field-table-head" role="row"><span role="columnheader">字段 / 类型</span><span role="columnheader">含义与示例</span></div>${fields.map((field) => `<div class="field-row" role="row"><div role="cell"><code>${escape(field.name)}</code><span class="field-type">${escape(field.type)} <span>${field.required ? '必填' : '可选'}</span></span></div><div role="cell"><p>${escape(field.description)}</p><span class="field-example">例：<code>${escape(field.example)}</code></span></div></div>`).join('')}</div>`;
}

function renderEndpoint() {
  const module = API_MODULES.find((item) => item.id === selected.module)!;
  byId('endpoint-header').innerHTML = `<div class="endpoint-kicker">${module.name} <span>${module.number}</span></div><h2 id="endpoint-title" tabindex="-1">${selected.name}</h2><p class="endpoint-description">${selected.description}</p><div class="endpoint-path"><span class="method ${selected.method.toLowerCase()}">${selected.method}</span><code>${selected.path}</code>${selected.stream ? '<span class="tag">SSE</span>' : '<span class="tag">JSON</span>'}</div>`;
  const tabs = [['request', '参数与示例'], ['response', '返回字段'], ...(selected.stream ? [['events', '流式事件']] : []), ['errors', '错误说明']];
  byId('doc-tabs').innerHTML = tabs.map(([key, title]) => `<button class="tab ${docsTab === key ? 'active' : ''}" data-doc-tab="${key}" aria-pressed="${docsTab === key}">${title}</button>`).join('');
  const content = byId('documentation');
  if (docsTab === 'response') {
    content.innerHTML = `<section class="doc-section"><h3>成功响应 <span class="inline-meta">${selected.success} · ${selected.stream ? 'text/event-stream' : 'application/json'}</span></h3>${fieldTable(selected.response)}<h3 class="example-title">响应示例 <span class="inline-meta">仅作格式参考</span></h3><pre class="example-code">${escape(pretty(selected.responseExample))}</pre></section>`;
  } else if (docsTab === 'events') {
    content.innerHTML = `<section class="doc-section"><p class="section-note">每个事件都包含 sessionId。最终事件只有 completed、aborted、failed 之一。</p>${SSE_EVENTS.map((event) => `<details class="event-doc"><summary><code>${event.name}</code><span>${event.description}</span></summary>${event.fields.length ? fieldTable(event.fields) : '<p class="section-note">无额外字段。</p>'}</details>`).join('')}</section>`;
  } else if (docsTab === 'errors') {
    content.innerHTML = `<section class="doc-section"><p class="section-note">流开始前返回 HTTP 错误；流开始后以 failed 事件返回错误。</p>${API_ERRORS.map((error) => `<div class="error-doc"><span class="mono">${error.status}</span><div><code>${error.code}</code><p>${error.description}</p></div></div>`).join('')}<pre class="example-code">${escape(pretty({ error: { code: 'SESSION_BUSY', message: '会话正在生成，请等待或停止。' } }))}</pre></section>`;
  } else {
    const names = [...selected.path.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]);
    const pathFields = selected.request.filter((item) => names.includes(item.name));
    const bodyFields = selected.request.filter((item) => !names.includes(item.name));
    content.innerHTML = `<section class="doc-section"><div class="usage-note">${iconMarkup('Info')}<p>${selected.note}</p></div>
      ${pathFields.length ? `<h3>路径参数 <span class="inline-meta">会话 id 使用上方输入；资产 ID 在下方填写</span></h3>${fieldTable(pathFields)}${pathFields.filter((field) => field.name !== 'id').map((field) => `<div class="editor-heading"><label for="path-${field.name}">${escape(field.name)}</label></div><input id="path-${field.name}" data-path-parameter="${field.name}" value="${escape(assetParameters[field.name])}" placeholder="${escape(field.description)}" autocomplete="off" />`).join('')}` : ''}
      <h3>请求参数 <span class="inline-meta">${selected.examples.length ? 'application/json' : '无需请求体'}</span></h3>
      ${bodyFields.length ? fieldTable(bodyFields) : `<p class="no-params">${selected.examples.length ? '使用默认模型时，发送空对象即可。' : '该接口不需要请求体，可以直接发起检查。'}</p>`}
      ${selected.request.some((item) => item.name === 'thinkingLevel') ? '<div id="model-controls"></div>' : ''}
      ${selected.id === 'attachments.upload' ? '<div class="editor-heading"><label for="attachment-file">选择附件文件</label></div><input id="attachment-file" type="file" accept=".png,.jpg,.jpeg,.webp,.txt,.md,.markdown" /><p class="section-note">选择后填入请求体，点击发送才会上传。图片最多 10 MiB，文本最多 1 MiB。</p>' : ''}
      ${selected.examples.length ? `<div class="editor-heading"><label for="request-body">请求体</label><select id="example-picker" aria-label="选择参数示例">${selected.examples.map((item, i) => `<option value="${i}">${item.name}</option>`).join('')}</select></div><textarea id="request-body" spellcheck="false" aria-describedby="body-help" rows="7">${escape(drafts.get(selected.id))}</textarea><div class="editor-footer"><span id="body-help">可编辑 JSON · 仅在点击后发送</span><button id="format-json" class="text-button">格式化</button><button id="reset-json" class="text-button">恢复示例</button></div>` : ''}
      <p id="request-error" class="request-error" role="alert"></p>
      <div class="request-actions"><button id="send-request" class="button primary">发送请求 ${iconMarkup('ArrowUpRight')}</button><span class="request-hint">预期 ${selected.success} ${selected.stream ? '· 流式响应' : '· JSON'}</span></div>
      <div class="next-step"><span>建议流程</span><a href="#models.get-config">检查模型</a>${iconMarkup('ArrowRight', 12)}<a href="#sessions.create">创建会话</a>${iconMarkup('ArrowRight', 12)}<a href="#generation.send">发送消息</a>${iconMarkup('ArrowRight', 12)}<a href="#sessions.get">查询结果</a></div></section>`;
    const examplePicker = byId<HTMLSelectElement>('example-picker');
    if (examplePicker) examplePicker.value = String(exampleSelections.get(selected.id) ?? 0);
    byId<HTMLTextAreaElement>('request-body')?.addEventListener('input', (event) => { drafts.set(selected.id, (event.target as HTMLTextAreaElement).value); renderModelControls(); });
    byId<HTMLSelectElement>('example-picker')?.addEventListener('change', (event) => setExample(Number((event.target as HTMLSelectElement).value)));
    byId('reset-json')?.addEventListener('click', () => setExample(Number(byId<HTMLSelectElement>('example-picker').value)));
    byId('format-json')?.addEventListener('click', () => {
      try { const formatted = pretty(JSON.parse(drafts.get(selected.id) ?? '')); drafts.set(selected.id, formatted); byId<HTMLTextAreaElement>('request-body').value = formatted; byId('request-error').textContent = ''; }
      catch { showRequestError('JSON 格式错误，请检查引号、逗号和括号。'); }
    });
    byId('send-request').addEventListener('click', () => void execute(selected));
    byId<HTMLInputElement>('attachment-file')?.addEventListener('change', async event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const readId = ++uploadReadId; uploadReading = true; updateButtons();
      try {
        const body = await uploadDraft(file);
        if (readId !== uploadReadId) return;
        drafts.set('attachments.upload', pretty(body));
        if (selected.id === 'attachments.upload') { byId<HTMLTextAreaElement>('request-body').value = pretty(body); showRequestError(''); }
      } catch (error) { if (readId === uploadReadId) notify(error instanceof Error ? error.message : '文件读取失败。'); }
      finally { if (readId === uploadReadId) { uploadReading = false; updateButtons(); } }
    });
    content.querySelectorAll<HTMLInputElement>('[data-path-parameter]').forEach((input) => input.addEventListener('input', () => setAssetParameter(input.dataset.pathParameter!, input.value)));
    renderModelControls();
  }
  updateButtons();
}

function setExample(index: number) {
  const body = selected.examples[index]?.body;
  if (!body) return;
  exampleSelections.set(selected.id, index);
  // 模型示例优先沿用服务返回的当前选择，避免硬编码示例与本机配置不一致。
  const example = 'provider' in body && config?.provider && config.model ? { ...body, provider: config.provider, model: config.model }
    : 'attachmentIds' in body && assetParameters.attachmentId ? { ...body, attachmentIds: [assetParameters.attachmentId] } : body;
  drafts.set(selected.id, pretty(example));
  byId<HTMLTextAreaElement>('request-body').value = pretty(example);
  byId('request-error').textContent = '';
  renderModelControls();
}

/** 选择器仅编辑请求草稿，能力来自公开模型接口；以请求 JSON 和服务返回的有效值为准。 */
function renderModelControls() {
  const container = byId('model-controls');
  if (!container) return;
  let body: Record<string, unknown>;
  try { const parsed = JSON.parse(drafts.get(selected.id) || '{}'); if (!isObject(parsed)) throw new Error(); body = parsed; }
  catch { container.innerHTML = '<p class="section-note">修正 JSON 后可使用模型选择器。</p>'; return; }
  const fallback = selected.id === 'sessions.set-config' ? sessions.find((s) => s.id === sessionId) : config;
  const effective = models.find((m) => m.provider === (body.provider ?? fallback?.provider) && m.id === (body.model ?? fallback?.model));
  const explicitIndex = models.findIndex((m) => m.provider === body.provider && m.id === body.model);
  container.innerHTML = `<div class="editor-heading"><label for="model-choice">模型</label><select id="model-choice"><option value="" ${selected.id === 'models.set-config' ? 'disabled' : ''}>${selected.id === 'models.set-config' ? '请选择模型（必填）' : selected.id === 'sessions.set-config' ? '沿用当前会话' : '使用默认配置'}</option>${models.map((m, i) => `<option value="${i}" ${!m.configured ? 'disabled' : ''}>${escape(m.name)} · ${escape(m.provider)}${m.configured ? '' : '（未配置）'}</option>`).join('')}</select></div>
    <div class="editor-heading"><label for="thinking-choice">思考强度</label><select id="thinking-choice"><option value="">沿用已有设置</option>${(effective?.thinkingLevels ?? []).map((level) => `<option value="${level}">${level}</option>`).join('')}</select></div>
    <p class="section-note">${effective ? `有效模型：${escape(effective.id)} · 窗口 ${effective.contextWindow.toLocaleString()} tokens` : '尚未取得当前模型能力，请选择模型或重新检测。'}。选择后仍需点击发送请求。</p>`;
  byId<HTMLSelectElement>('model-choice').value = explicitIndex >= 0 ? String(explicitIndex) : '';
  const thinkingChoice = byId<HTMLSelectElement>('thinking-choice');
  if (typeof body.thinkingLevel === 'string' && !effective?.thinkingLevels.some((level) => level === body.thinkingLevel)) {
    const option = new Option(`${body.thinkingLevel}（当前不支持）`, body.thinkingLevel); option.disabled = true; thinkingChoice.add(option);
  }
  thinkingChoice.value = typeof body.thinkingLevel === 'string' ? body.thinkingLevel : '';
  const save = () => { drafts.set(selected.id, pretty(body)); byId<HTMLTextAreaElement>('request-body').value = pretty(body); renderModelControls(); };
  byId('model-choice').addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (value === '') { delete body.provider; delete body.model; }
    else { const m = models[Number(value)]; body.provider = m.provider; body.model = m.id; }
    // 换模型时不强塞旧档位，让后端按新模型能力调整，避免产生无效选项。
    delete body.thinkingLevel; save();
  });
  thinkingChoice.addEventListener('change', () => { if (thinkingChoice.value) body.thinkingLevel = thinkingChoice.value; else delete body.thinkingLevel; save(); });
}

function showRequestError(message: string) {
  const target = byId('request-error');
  if (target) target.textContent = message;
  else notify(message);
}

/** 输入和每次运行独立保存；切换导航或当前会话不会改写一个已发出请求的目标。 */
async function execute(endpoint: EndpointDoc, explicitSession?: string) {
  if (runs.get(endpoint.id)?.phase === 'running') return;
  const targetSession = explicitSession ?? sessionId.trim();
  if (endpoint.path.includes(':id') && !targetSession) { showRequestError('请先创建会话，或在上方填写会话 ID。'); byId('session-id').focus(); return; }
  const pathParameters: Record<string, string> = { ...assetParameters, id: targetSession };
  const names = [...endpoint.path.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]);
  const missing = names.find((name) => !pathParameters[name]?.trim());
  if (missing) { showRequestError(`请填写路径参数 ${missing}。`); byId(`path-${missing}`)?.focus(); return; }
  let body: Record<string, unknown> | undefined;
  if (endpoint.examples.length) {
    try { const parsed: unknown = JSON.parse(drafts.get(endpoint.id) ?? ''); if (!isObject(parsed)) throw new Error(); body = parsed; }
    catch { showRequestError('请求体必须是合法 JSON 对象，请检查后再发送。'); return; }
  }
  if (byId('request-error')) byId('request-error').textContent = '';
  const url = endpoint.path.replace(/:([A-Za-z]+)/g, (_match, name: string) => encodeURIComponent(pathParameters[name].trim()));
  const run: Run = { phase: 'running', url, sessionId: targetSession, started: performance.now(), elapsed: 0, headers: {}, events: [], text: '', thinking: '', checks: [], controller: new AbortController() };
  runs.set(endpoint.id, run);
  renderCatalog(); updateButtons(); renderResult();
  try {
    const signal = endpoint.stream || endpoint.id === 'context.compact' ? run.controller.signal : AbortSignal.any([run.controller.signal, AbortSignal.timeout(20000)]);
    const response = await fetch(url, { method: endpoint.method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
    run.status = response.status;
    run.headers = Object.fromEntries(response.headers.entries());
    const contentType = response.headers.get('content-type') ?? '';
    if (endpoint.stream && response.ok && contentType.includes('text/event-stream')) {
      await consumeSse(response, (event) => {
        run.events.push({ event, elapsedMs: Math.round(performance.now() - run.started) });
        if (event.type === 'text_delta') run.text += event.delta;
        if (event.type === 'thinking_delta') run.thinking += event.delta;
        run.elapsed = Math.round(performance.now() - run.started);
        scheduleResult();
      });
      run.checks = checkStream(run.events.map((item) => item.event), targetSession);
      for (const item of run.events) {
        const specification = SSE_EVENTS.find((event) => event.name === item.event.type);
        if (!specification) run.checks.push({ name: '事件类型', passed: false, detail: `未知事件 ${item.event.type}` });
        else run.checks.push(...checkFields(item.event, specification.fields).filter((check) => !check.passed));
      }
      const final = run.events.at(-1)?.event;
      run.phase = !run.checks.every((check) => check.passed) ? 'error' : final?.type === 'aborted' ? 'stopped' : 'success';
      if (final?.type === 'failed') run.error = final.error.message;
      if (!run.events.some((item) => ['completed', 'failed', 'aborted'].includes(item.event.type))) { run.phase = 'disconnected'; run.error = '连接已结束，但没有最终事件。生成可能仍在继续，请读取会话确认。'; }
    } else {
      const raw = await response.text();
      try { run.body = JSON.parse(raw); } catch { run.body = raw; }
      run.checks = checkJson(endpoint, response.status, contentType, run.body);
      if (endpoint.stream && response.ok) run.checks.push({ name: 'SSE 格式', passed: false, detail: '预期 text/event-stream，实际未返回流。' });
      run.phase = run.checks.every((check) => check.passed) ? 'success' : 'error';
      if (isObject(run.body) && isObject(run.body.error)) run.error = String(run.body.error.message ?? '接口返回错误。');
      if (response.ok && isObject(run.body)) {
        if (endpoint.id === 'context.compact' && run.body.outcome === 'aborted' && run.phase === 'success') run.phase = 'stopped';
        if (['sessions.create', 'chats.create'].includes(endpoint.id) && typeof run.body.id === 'string') { setSession(run.body.id); notify('会话已创建，ID 已自动填入。'); }
        if (endpoint.id === 'attachments.upload' && targetSession === sessionId && typeof run.body.id === 'string') setAssetParameter('attachmentId', run.body.id);
        if (['skills.create', 'skills.import', 'skills.copy'].includes(endpoint.id) && typeof run.body.id === 'string') setAssetParameter('skillId', run.body.id);
        if (endpoint.id === 'workspaces.create' && typeof run.body.id === 'string') setAssetParameter('workspaceId', run.body.id);
        if (endpoint.id === 'proposals.create' && typeof run.body.id === 'string') {
          setAssetParameter('proposalId', run.body.id);
          if (Array.isArray(run.body.changes) && isObject(run.body.changes[0]) && typeof run.body.changes[0].id === 'string') setAssetParameter('changeId', run.body.changes[0].id);
        }
        if (endpoint.id === 'models.get-config' || endpoint.id === 'models.set-config') config = run.body as unknown as ModelConfig;
      }
    }
  } catch (error) {
    if (run.controller.signal.aborted) { run.phase = 'disconnected'; run.error = endpoint.id === 'context.compact' ? '已断开请求，后端压缩仍可能继续；请查询上下文或取消压缩。' : endpoint.stream ? '已断开本页订阅，后端生成仍可能继续。可停止生成或重新查询会话。' : '已取消本次请求。'; }
    else { run.phase = 'error'; run.error = error instanceof Error && error.name === 'TimeoutError' ? '请求超时，请检查本机后端并重新查询。' : `请求未完成：${error instanceof Error ? error.message : '网络异常'}。请确认后端已启动。`; }
  } finally {
    run.elapsed = Math.round(performance.now() - run.started);
    renderCatalog(); updateButtons(); renderResult();
    if (run.phase !== 'running') notify(`${endpoint.name}：${phaseLabel(run.phase)}`);
    if (run.status && run.status < 400) void refreshContext(false);
  }
}

function phaseLabel(phase: Phase) { return ({ running: '执行中', success: '检查通过', error: '检查未通过', stopped: '已停止', disconnected: '订阅已断开' })[phase]; }

function updateButtons() {
  const send = byId<HTMLButtonElement>('send-request');
  if (send) { send.disabled = runs.get(selected.id)?.phase === 'running' || (selected.id === 'attachments.upload' && uploadReading); send.innerHTML = send.disabled ? '正在处理…' : `发送请求 ${iconMarkup('ArrowUpRight')}`; }
  byId<HTMLButtonElement>('stop-active').disabled = !sessionId.trim() || runs.get('generation.stop')?.phase === 'running';
}

let scheduled = false;
function scheduleResult() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; renderResult(); });
}

/** 动态内容先转义再展示；模型输出、工具结果和错误都只作为文本处理。 */
function renderResult() {
  const run = runs.get(selected.id);
  byId('result-state').textContent = run ? phaseLabel(run.phase) : '等待请求';
  byId('result-state').dataset.phase = run?.phase ?? '';
  byId('result-meta').innerHTML = run ? `<div class="response-meta"><span><b>${run.status ?? '—'}</b> HTTP 状态</span><span><b>${run.elapsed.toLocaleString()}</b> ms</span><span><b>${selected.stream ? run.events.length : run.checks.filter((check) => check.passed).length}</b> ${selected.stream ? '事件' : '检查通过'}</span></div><code class="actual-path">${escape(run.url)}</code>` : '';
  byId('result-tabs').innerHTML = ['result', 'raw', 'headers'].map((tab, i) => `<button class="tab ${resultTab === tab ? 'active' : ''}" data-result-tab="${tab}" aria-pressed="${resultTab === tab}">${['结果', '原始数据', '响应头'][i]}</button>`).join('');
  const content = byId('result-content');
  if (!run) {
    content.innerHTML = `<div class="response-empty"><span class="empty-glyph">${iconMarkup('Braces', 24)}</span><h3>准备好发起第一次请求</h3><p>阅读左侧说明，按需调整参数，<br />点击「发送请求」查看真实结果。</p><div class="empty-flow"><span>请求</span>${iconMarkup('ArrowRight', 12)}<span>响应</span>${iconMarkup('ArrowRight', 12)}<span>检查</span></div></div>`;
  } else if (resultTab === 'headers') {
    content.innerHTML = `<pre class="result-code">${escape(pretty(run.headers))}</pre>`;
  } else if (resultTab === 'raw') {
    content.innerHTML = `<pre class="result-code">${escape(pretty(run.events.length ? run.events : run.body ?? { message: run.error ?? '等待响应…' }))}</pre>`;
  } else {
    content.innerHTML = `${run.phase === 'running' ? '<div class="run-progress"><span></span></div><p class="running-label">正在等待接口返回…</p>' : ''}
      ${run.error ? `<div class="result-error" role="alert">${escape(run.error)}${selected.stream ? '<button class="text-button" data-read-session>读取本次会话</button>' : ''}</div>` : ''}
      ${run.text ? `<section class="generated"><h3>生成文本</h3><div class="generated-text">${escape(run.text)}</div></section>` : ''}
      ${selected.stream ? `<section class="generated"><h3>模型思考</h3><div class="generated-text">${escape(run.thinking || (run.phase === 'running' ? '等待模型返回可见思考文本…' : '模型未返回可见思考文本；这不代表没有进行推理。'))}</div></section>` : ''}
      ${run.events.length ? `<section class="event-list"><h3>事件时间线 <span>${run.events.length}</span></h3>${run.events.filter((item) => !['text_delta', 'thinking_delta'].includes(item.event.type)).map(({ event, elapsedMs }) => `<div class="event-row"><span class="event-dot"></span><div><code>${escape(event.type)}</code><p>${escape(eventDescription(event))}</p></div><time>+${elapsedMs}ms</time></div>`).join('')}<div class="delta-summary">${run.events.filter((item) => item.event.type === 'text_delta').length} 个正文增量 · ${run.events.filter((item) => item.event.type === 'thinking_delta').length} 个思考增量 · 原始数据可逐条查看</div></section>` : ''}
      ${selected.id === 'sessions.get' ? renderHistory(run.body) : ''}
      ${selected.id === 'attachments.get' ? attachmentPreview(run.body, escape) : ''}
      ${selected.id.startsWith('attachments.') && run.status && run.status < 400 ? renderAttachmentActions(run.body, run.sessionId) : ''}
      ${selected.id === 'documents.read' && isObject(run.body) && typeof run.body.version === 'string' ? '<button class="button secondary" data-use-reference>加入消息引用</button>' : ''}
      ${run.body !== undefined ? `<pre class="result-code">${escape(pretty(selected.id === 'attachments.get' && isObject(run.body) && typeof run.body.data === 'string' ? { ...run.body, data: `[${run.body.data.length} 个 base64 字符，完整内容见原始数据]` } : run.body))}</pre>` : ''}
      ${run.checks.length ? `<details class="checks" open><summary>响应检查 <span>${run.checks.filter((check) => check.passed).length} / ${run.checks.length}</span></summary>${run.checks.map((check) => `<div class="check-row"><span class="check-icon ${check.passed ? 'pass' : 'fail'}" role="img" aria-label="${check.passed ? '通过' : '未通过'}">${iconMarkup(check.passed ? 'Check' : 'CircleAlert', 12)}</span><div><strong>${escape(check.name)}</strong><span>${escape(check.detail)}</span></div></div>`).join('')}</details>` : ''}
      ${run.phase === 'running' ? `<div class="stream-controls"><button class="button secondary" data-disconnect>断开订阅</button>${selected.stream ? '<button class="button secondary" data-stop-run>停止本次生成</button>' : ''}${selected.id === 'context.compact' ? '<button class="button secondary" data-stop-compact>取消本次压缩</button>' : ''}</div>` : ''}`;
  }
  byId<HTMLButtonElement>('copy-result').disabled = !run;
}

/** 历史中的思考和正文分别呈现，所有模型文本均转义，原始 JSON 仍可核对。 */
function renderHistory(body: unknown): string {
  if (!isObject(body) || !Array.isArray(body.messages)) return '';
  return body.messages.filter(isObject).map((message) => `<section class="generated"><h3>${escape(message.role)} · ${escape(message.id)}</h3>${Array.isArray(message.content) ? message.content.filter(isObject).map((block) => `<p class="section-note">${block.type === 'thinking' ? '模型思考' : block.type === 'tool' ? '工具结果' : '正文'}</p><div class="generated-text">${escape(block.text ?? block.name ?? '')}</div>`).join('') : ''}
    ${Array.isArray(message.attachments) ? renderAttachmentActions({ attachments: message.attachments }, String(body.id)) : ''}
    ${Array.isArray(message.references) ? message.references.filter(isObject).map(reference => `<details class="event-doc"><summary>引用：${escape(reference.path)} · ${escape(String(reference.version).slice(0, 12))}</summary><div class="generated-text">${escape(reference.content)}</div></details>`).join('') : ''}</section>`).join('');
}

/** 附件动作始终携带响应中的会话归属，避免切换当前会话后误用其他聊天的 ID。 */
function renderAttachmentActions(body: unknown, owner: string): string {
  if (!isObject(body)) return '';
  const files = Array.isArray(body.attachments) ? body.attachments : typeof body.mimeType === 'string' ? [body] : [];
  return files.filter(isObject).map(file => `<div class="attachment-actions"><span>${escape(file.name)} · ${escape(file.size)} 字节</span>
    <button class="text-button" data-read-attachment="${escape(file.id)}" data-owner="${escape(owner)}">预览附件</button>
    <button class="text-button" data-use-attachment="${escape(file.id)}" data-owner="${escape(owner)}">加入消息</button></div>`).join('');
}

function eventDescription(event: AgentEvent): string {
  if (event.type === 'completed' && event.usage) return `整轮完成 · ${event.usage.totalTokens.toLocaleString()} tokens`;
  if (event.type === 'accepted') return `消息 ${event.messageId}`;
  if (event.type === 'tool_start' || event.type === 'tool_end') return event.name + ('outcome' in event ? ` · ${event.outcome}` : ' · 执行中');
  if (event.type === 'failed') return event.error.message;
  if (event.type === 'retrying') return `第 ${event.attempt} / ${event.maxAttempts} 次重试`;
  if (event.type === 'compacting') return event.phase === 'start' ? '开始压缩上下文' : '上下文压缩结束';
  return SSE_EVENTS.find((item) => item.name === event.type)?.description ?? event.type;
}

function setSession(value: string) {
  if (sessionId !== value) setAssetParameter('attachmentId', '');
  sessionId = value;
  sessionStorage.setItem('plotloom.demo.session', value);
  byId<HTMLInputElement>('session-id').value = value;
  updateButtons();
  renderModelControls();
}

/** 仅自动发起读取请求；设置模型、创建会话与生成始终由用户按钮触发。 */
async function refreshContext(showLoading = true) {
  if (showLoading) { connection = 'checking'; renderConnection(); }
  const results = await Promise.allSettled([
    fetch('/api/model-config', { signal: AbortSignal.timeout(5000) }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<ModelConfig>; }),
    fetch('/api/sessions', { signal: AbortSignal.timeout(5000) }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ sessions: SessionListItem[] }>; }),
    fetch('/api/models', { signal: AbortSignal.timeout(5000) }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ models: ModelInfo[] }>; }),
  ]);
  if (results[0].status === 'fulfilled') { config = results[0].value; connection = 'online'; }
  else connection = 'offline';
  if (results[1].status === 'fulfilled') {
    sessions = results[1].value.sessions;
    byId('session-picker').innerHTML = `<option value="">选择已有会话（${sessions.length}）</option>${sessions.map((session) => `<option value="${escape(session.id)}">${escape(session.name)} · ${escape(session.id.slice(0, 8))}… · ${escape(session.model)} · ${session.thinkingLevel} · ${session.activity}</option>`).join('')}`;
    byId<HTMLSelectElement>('session-picker').value = sessionId;
  }
  if (results[2].status === 'fulfilled') models = results[2].value.models;
  renderModelControls();
  renderConnection();
}

function renderConnection() {
  byId('connection').innerHTML = `<span class="connection-status ${connection}"><span class="status-dot"></span>${({ checking: '正在检测', online: '服务已连接', offline: '服务未连接' })[connection]}</span>`;
  byId<HTMLButtonElement>('refresh').disabled = connection === 'checking';
  const note = byId('connection-note');
  note.textContent = connection === 'offline' ? `无法连接 ${__API_TARGET__}。请在项目根目录运行 pnpm.cmd start，再点击「重新检测」。`
    : connection === 'online' && !config?.configured ? '服务已连接，模型尚未就绪。请在本机 .env 配置模型与凭据并重启后端；页面可先检查查询和错误响应。' : '';
  note.hidden = !note.textContent;
}

let noticeTimer: ReturnType<typeof setTimeout>;
function notify(message: string) {
  clearTimeout(noticeTimer);
  byId('notice').textContent = message;
  byId('notice').classList.add('visible');
  noticeTimer = setTimeout(() => byId('notice').classList.remove('visible'), 3500);
}

window.addEventListener('hashchange', () => {
  selected = endpointById.get(location.hash.slice(1)) ?? selected;
  docsTab = 'request'; resultTab = 'result';
  renderCatalog(); renderEndpoint(); renderResult();
});
byId('search').addEventListener('input', (event) => { query = (event.target as HTMLInputElement).value; renderCatalog(); });
byId('session-id').addEventListener('input', (event) => setSession((event.target as HTMLInputElement).value));
byId('session-picker').addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value; if (value) setSession(value); });
byId('refresh').addEventListener('click', () => void refreshContext());
byId('stop-active').addEventListener('click', () => {
  void execute(endpointById.get('generation.stop')!);
  if (!selected.stream) location.hash = 'generation.stop';
});
byId('doc-tabs').addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-doc-tab]'); if (button) { docsTab = button.dataset.docTab!; renderEndpoint(); } });
byId('result-tabs').addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-result-tab]'); if (button) { resultTab = button.dataset.resultTab!; renderResult(); } });
byId('result-content').addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const run = runs.get(selected.id);
  if (target.closest('[data-disconnect]')) run?.controller.abort();
  if (target.closest('[data-stop-run]') && run) void execute(endpointById.get('generation.stop')!, run.sessionId);
  if (target.closest('[data-stop-compact]') && run) void execute(endpointById.get('context.stop')!, run.sessionId);
  if (target.closest('[data-read-session]') && run) { setSession(run.sessionId); location.hash = 'sessions.get'; }
  const file = target.closest<HTMLElement>('[data-read-attachment], [data-use-attachment]');
  if (file) {
    if (file.dataset.owner !== sessionId && file.dataset.useAttachment) { notify('请先切换到该附件所属会话。'); return; }
    if (file.dataset.readAttachment) {
      setSession(file.dataset.owner!); setAssetParameter('attachmentId', file.dataset.readAttachment);
      location.hash = 'attachments.get'; void execute(endpointById.get('attachments.get')!, file.dataset.owner);
    } else {
      try { drafts.set('generation.send', appendSourceDraft(drafts.get('generation.send') ?? '{}', 'attachmentIds', file.dataset.useAttachment)); location.hash = 'generation.send'; }
      catch { notify('消息草稿 JSON 无效，请先修正。'); }
    }
  }
  if (target.closest('[data-use-reference]') && run && isObject(run.body)) {
    const workspaceId = run.url.match(/^\/api\/workspaces\/([^/]+)\//)?.[1];
    if (!workspaceId) return;
    try { drafts.set('generation.send', appendSourceDraft(drafts.get('generation.send') ?? '{}', 'references', { workspaceId: decodeURIComponent(workspaceId), path: run.body.path, version: run.body.version })); location.hash = 'generation.send'; }
    catch { notify('消息草稿 JSON 无效，请先修正。'); }
  }
});
byId('copy-result').addEventListener('click', async () => {
  const run = runs.get(selected.id);
  if (!run) return;
  try { await navigator.clipboard.writeText(pretty(run.events.length ? run.events : run.body ?? { error: run.error })); notify('结果已复制。'); }
  catch { notify('无法访问剪贴板，请在原始数据中选择复制。'); }
});
renderCatalog(); renderEndpoint(); renderResult();
void refreshContext();
