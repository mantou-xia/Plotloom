import { WORKSPACE_CATALOG } from './workspace-catalog.ts';
import { SKILL_CATALOG } from './skill-catalog.ts';
import { WRITING_CATALOG } from './writing-catalog.ts';
import { SOURCE_CATALOG, SOURCE_REQUEST_FIELDS, ATTACHMENT_FIELDS, REFERENCE_FIELDS } from './source-catalog.ts';
/** 公开接口目录：供测试台和契约覆盖检查共用，只登记 HTTP 知识，不导入后端实现。 */
export interface FieldDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: string;
}
export interface EndpointDoc {
  id: string;
  module: 'models' | 'sessions' | 'generation' | 'context' | 'workspaces' | 'documents' | 'proposals' | 'skills' | 'skill-settings' | 'chats' | 'writing' | 'attachments' | 'projects';
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  note: string;
  success: number;
  request: FieldDoc[];
  response: FieldDoc[];
  examples: Array<{ name: string; body: Record<string, unknown> }>;
  responseExample: unknown;
  stream?: boolean;
}
const field = (name: string, type: string, required: boolean, description: string, example: string): FieldDoc => ({ name, type, required, description, example });
const provider = field('provider', 'string', true, '供应商标识，必须与模型列表中的 provider 一致。', 'krill-ai-codex');
const model = field('model', 'string', true, '模型标识，必须属于指定供应商。', 'gpt-5.6-sol');
const id = field('id', 'string', true, '会话唯一标识。创建后自动填入测试台，也可从历史列表选择。', '019…');
const status = field('status', 'idle | running', true, 'idle 可写入；running 正在生成、改配置或压缩，此时写入返回 409。', 'idle');
const thinking = field('thinkingLevel', 'off | minimal | low | medium | high | xhigh | max', true, '实际生效的思考档位；可选值以模型 thinkingLevels 为准，不保证有可见思考。', 'low');
const optionalThinking = { ...thinking, required: false };
const autoCompaction = field('autoCompaction', 'boolean', true, '当前会话是否启用 Pi 自动压缩，默认 true；关闭不影响手动压缩，重启和资源重建后保留。', 'true');
const name = field('name', 'string', true, '会话名称，去除首尾空白后保存；请求为 1–120 字符且不能全空白。', '灯塔创作');
const projectPath = field('projectPath', 'string', false, '可选的本机现存项目绝对目录。创建时规范化并固定，重启保留；项目工具直接执行，没有沙箱或审批。省略不开放项目工具。', 'D:/projects/example');
const activity = field('activity', 'idle | generating | configuring | compacting', true, '当前正在执行的操作。', 'idle');
const capabilities = [
  field('reasoning', 'boolean', true, '模型定义是否支持思考能力；不代表上游必然公开思考文本。', 'true'),
  field('thinkingLevels', 'array', true, 'SDK 对该模型允许的档位。', '["off","low","high"]'),
  field('contextWindow', 'number', true, '模型定义的上下文窗口，单位 token。', '128000'),
  field('maxTokens', 'number', true, '模型定义的单次最大输出 token。', '16384'),
  field('input', 'array', true, '模型声明的输入类型；包含 image 才可发送图片附件。', '["text"]'),
];
const capabilityExample = { reasoning: true, thinkingLevels: ['off', 'low', 'high'], contextWindow: 128000, maxTokens: 16384, input: ['text'] };
const usageFields = [field('usage', 'object', false, '已保存的已知用量合计；缺失或零值不表示免费，不是账单。', '{}'),
  ...['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'].map((key, i) => field(`usage.${key}`, 'number', false, ['输入 token', '输出 token', '缓存读取 token', '缓存写入 token', '合计 token'][i], '100'))];
const modelConfig = [
  field('provider', 'string | null', true, '默认供应商；尚未选择时为 null。', 'krill-ai-codex'),
  field('model', 'string | null', true, '默认模型；尚未选择时为 null。', 'gpt-5.6-sol'),
  field('configured', 'boolean', true, '是否存在模型及凭据；不代表已经验证供应商连通性。', 'true'),
  thinking,
];
const summary = [id, provider, model, status, activity, name, thinking, projectPath];
const configExample = { provider: 'krill-ai-codex', model: 'gpt-5.6-sol', configured: true, thinkingLevel: 'off' };
const sessionExample = { id: '019-example-session', provider: 'krill-ai-codex', model: 'gpt-5.6-sol', status: 'idle', activity: 'idle', name: '灯塔创作', thinkingLevel: 'off' };
const sessionConfig = [id, provider, model, thinking, autoCompaction, field('capabilities', 'object', true, '当前模型能力。', '{}'), ...capabilities.map((item) => ({ ...item, name: `capabilities.${item.name}` }))];
const sessionConfigExample = { id: sessionExample.id, provider: configExample.provider, model: configExample.model, thinkingLevel: 'off', autoCompaction: true, capabilities: capabilityExample };

export const API_MODULES = [
  { id: 'projects', name: '项目', description: '系统选择文件夹、登记项目及切换已有项目', number: '13' },
  { id: 'attachments', name: '聊天附件', description: '上传、读取及移除当前会话资料', number: '12' },
  { id: 'writing', name: '内容创作', description: '大纲留档、上下文、创作与来源', number: '11' },
  { id: 'skills', name: '技能库', description: '内置、自定义与本机文件夹选择导入', number: '08' },
  { id: 'skill-settings', name: '技能启用', description: '工作区默认、聊天覆盖和依赖诊断', number: '09' },
  { id: 'chats', name: '小说聊天', description: '聊天归属与最近列表', number: '10' },
  { id: 'workspaces', name: '小说工作区', description: '登记小说目录、备份及恢复提交', number: '05' },
  { id: 'documents', name: 'Markdown 资料', description: '原稿读写、历史、搜索和导出', number: '06' },
  { id: 'proposals', name: '候选与逐处采纳', description: '查看差异、逐处采纳或拒绝', number: '07' },
  { id: 'models', name: '模型配置', description: '查看可用模型，选择默认模型', number: '01' },
  { id: 'sessions', name: '会话管理', description: '创建、查找和重新打开会话', number: '02' },
  { id: 'generation', name: '消息与生成', description: '发送消息、观察流式事件与停止', number: '03' },
  { id: 'context', name: '上下文与用量', description: '查看占用、压缩上下文及累计用量', number: '04' },
] as const;

const providerFields = [
  field('name','string',false,'展示名称，缺省使用标识。','示例服务'), field('avatar','string',false,'内置头像名或 PNG/JPEG/WebP 数据地址。','box'),
  field('enabled','boolean',false,'是否允许模型调用，缺省开启。','true'), field('endpoints','array',false,'额外端点，每个对象含唯一 api 和 baseUrl。','[]'),
  field('modelApis','object',false,'模型 ID 到端点协议的映射，缺省使用主端点。','{}'),
];
export const API_CATALOG: readonly EndpointDoc[] = [
  { id: 'providers.credential', module: 'models', name: '复制供应商凭据', method: 'POST', path: '/api/providers/:providerId/credential', success: 200,
    description: '为明确的复制动作读取有效 API Key。', note: '仅用隔离测试凭据验收。响应禁用缓存。400 请求需为空 JSON 对象；403 异站；404 供应商不存在；422 缺凭据。',
    request: [field('providerId','string',true,'供应商标识。','example')], examples: [{ name: '复制测试供应商凭据', body: {} }],
    response: [field('apiKey','string',true,'复制到剪贴板的值，界面不直接显示。','test-only')], responseExample: { apiKey: 'test-only' } },
  { id: 'providers.delete', module: 'models', name: '删除供应商', method: 'DELETE', path: '/api/providers/:providerId', success: 200,
    description: '移除本地配置，文件来源的供应商将被屏蔽。', note: '404 供应商不存在。历史会话保留。',
    request: [field('providerId','string',true,'待删除供应商标识。','example')], examples: [], response: [field('saved','boolean',true,'删除已保存。','true')], responseExample: { saved: true } },
  ...(['check','discover'] as const).map((action): EndpointDoc => ({
    id: 'providers.' + action, module: 'models', method: 'POST', path: '/api/providers/' + action, success: 200,
    name: action === 'check' ? '检测端点连接' : '预览远端模型', description: '使用本机保存的单一凭据读取指定协议的模型目录。',
    note: '不会修改本地目录。400 协议未登记；404 未找到供应商；422 未配置密钥；502 远端拒绝、超时或不支持目录。',
    request: [field('id','string',true,'已保存的供应商。','example'), field('api','string',false,'指定端点协议，缺省主端点。','openai-completions')],
    examples: [{ name: '查询已保存端点', body: { id: 'example' } }], response: action === 'check' ? [field('connected','boolean',true,'成功读取模型目录。','true')] : [field('models','array',true,'远端模型 ID，未写入。','["alpha"]')],
    responseExample: action === 'check' ? { connected: true } : { models: ['alpha'] },
  })),
  {
    id: 'providers.list', module: 'models', name: '读取自定义供应商', method: 'GET', path: '/api/providers', success: 200,
    description: '查看本机可编辑的供应商、服务地址、协议和模型列表。', note: '仅返回凭据配置状态。读取失败返回 500，异站请求返回 403。',
    request: [], examples: [], response: [field('providers', 'array', true, '自定义供应商列表。', '[]'),
      ...providerFields.map(f => ({ ...f, name: 'providers[].' + f.name })),
      ...['id', 'baseUrl', 'api', 'models', 'configured'].map((name, i) => field('providers[].' + name,
        ['string','string','string','array','boolean'][i], true, ['稳定标识','服务地址','模型协议','模型标识列表','凭据已配置'][i], ['example','https://example.com/v1','openai-completions','["alpha"]','true'][i]))],
    responseExample: { providers: [{ id: 'example', api: 'openai-completions', models: ['alpha'], baseUrl: 'https://example.com/v1', configured: false }] },
  },
  ...(['POST', 'PUT'] as const).map((method): EndpointDoc => ({
    id: method === 'POST' ? 'providers.create' : 'providers.edit', module: 'models',
    name: method === 'POST' ? '新增供应商' : '编辑供应商', method, path: '/api/providers', success: 200,
    description: '在本机保存服务地址、协议、凭据和完整模型列表，供后续模型请求使用。',
    note: '400 参数错误；404 编辑目标不存在；409 标识已占用；422 更换服务域名需要重新输入密钥；403 异站请求。编辑时省略密钥沿用当前凭据。',
    request: [field('id','string',true,'供应商唯一标识。','example'), field('baseUrl','string',true,'HTTP(S) 服务地址。','https://example.com/v1'),
      field('api','string',true,'协议：openai-completions、openai-responses、anthropic-messages，编辑也可保留原协议。','openai-completions'),
      ...providerFields, field('apiKey','string',method === 'POST','新建或尚无凭据时必填；已配置时可省略以沿用。所有端点共用。','test-only'),field('models','array',true,'已添加的上游模型 ID，可为空。','[]')],
    examples: [{ name: '测试供应商', body: { id: 'example', baseUrl: 'https://example.com/v1', api: 'openai-completions', ...(method === 'POST' ? { apiKey: 'test-only' } : {}), models: [] } }],
    response: [field('saved','boolean',true,'已持久化并应用。','true')], responseExample: { saved: true },
  })),
  {
    id: 'projects.list', module: 'projects', name: '项目列表', method: 'GET', path: '/api/projects', success: 200,
    description: '列出已保存的项目，包括尚无聊天的项目。',
    note: '按创建顺序倒序返回，不依赖聊天存在。会话以 projectPath 对应项目 path；不从聊天隐式生成项目。异站请求返回 403 ORIGIN_FORBIDDEN；存储读取失败返回 500。',
    request: [], examples: [], response: [field('projects', 'array', true, '项目清单，未创建时为空数组。', '[]'),
      field('projects[].id', 'string', true, '项目唯一标识。', 'project-id'), field('projects[].name', 'string', true, '用户定义的项目名称。', '我的作品'),
      field('projects[].path', 'string', true, '规范化后的绝对源目录。', 'D:/projects/story'), field('projects[].createdAt', 'string', true, '项目创建时间（ISO 8601）。', '2026-11-19T00:00:00.000Z')],
    responseExample: { projects: [{ id: 'project-id', name: '我的作品', path: 'D:/projects/story', createdAt: '2026-11-19T00:00:00.000Z' }] },
  },
  {
    id: 'projects.create', module: 'projects', name: '创建项目', method: 'POST', path: '/api/projects', success: 201,
    description: '将项目名称与现存文件夹独立保存，创建后即使没有聊天也可展示。',
    note: '名称去除首尾空白，1–120 字符；目录规范化且唯一。只登记项目，不创建源文件夹、聊天或调用模型。格式错误 400 INVALID_REQUEST；空白名称 422 PROJECT_NAME_INVALID；目录不存在、相对路径或文件路径 422 PROJECT_PATH_INVALID；相同目录 409 PROJECT_ALREADY_EXISTS；异站请求 403 ORIGIN_FORBIDDEN。',
    request: [field('name', 'string', true, '用户定义的项目名称。', '我的作品'), field('path', 'string', true, '系统选择器返回的现存绝对目录，最多 2000 字符。', 'D:/projects/story')],
    response: [field('id', 'string', true, '新项目唯一标识。', 'project-id'), field('name', 'string', true, '去除首尾空白后的名称。', '我的作品'),
      field('path', 'string', true, '规范化后的源目录，可用于创建会话的 projectPath。', 'D:/projects/story'), field('createdAt', 'string', true, '创建时间（ISO 8601）。', '2026-11-19T00:00:00.000Z')],
    examples: [{ name: '登记已有目录（先替换实际路径）', body: { name: '我的作品', path: 'D:/projects/story' } },
      { name: '错误：空白名称', body: { name: ' ', path: 'D:/projects/story' } }, { name: '错误：相对路径', body: { name: '我的作品', path: 'relative/path' } }],
    responseExample: { id: 'project-id', name: '我的作品', path: 'D:/projects/story', createdAt: '2026-11-19T00:00:00.000Z' },
  },
  {
    id: 'projects.select-folder', module: 'projects', name: '系统选择文件夹', method: 'POST', path: '/api/projects/select-folder', success: 200,
    description: '在后端所在电脑打开 Windows 原生文件夹选择窗口，等待用户确认或取消。',
    note: '请求体为 {}；只能选择文件系统文件夹，不上传文件，不登记项目。确认返回 path，系统窗口取消返回 {path:null}，属于正常结束。关闭页面或中止请求会关闭该窗口；无生成任务或停止接口。当前仅 Windows 桌面支持。非法参数 400 INVALID_REQUEST；窗口已打开 409 FOLDER_PICKER_BUSY；打开失败 500 FOLDER_PICKER_FAILED；不支持的系统 501 FOLDER_PICKER_UNAVAILABLE；异站请求 403 ORIGIN_FORBIDDEN。',
    request: [], response: [field('path', 'string | null', true, '所选文件夹绝对路径；取消为 null，调用方保留原有选择。', 'D:/projects/story')],
    examples: [{ name: '打开系统选择器', body: {} }], responseExample: { path: 'D:/projects/story' },
  },
  ...SOURCE_CATALOG,
  ...WRITING_CATALOG,
  ...SKILL_CATALOG,
  {
    id: 'sessions.organize', module: 'chats', name: '置顶、归档或恢复对话', method: 'PUT', path: '/api/sessions/:id/organization', success: 200,
    description: '更新提供的状态，归档和恢复时保留置顶选择。', note: '至少提供一个布尔值。参数无效 400，未知会话 404，忙碌时 409 SESSION_BUSY。',
    request: [id, field('pinned', 'boolean', false, '置顶或取消置顶。', 'true'), field('archived', 'boolean', false, '归档或恢复。', 'true')],
    response: [field('pinned', 'boolean', true, '保存后的置顶状态。', 'true'), field('archived', 'boolean', true, '保存后的归档状态。', 'false')],
    examples: [{ name: '置顶', body: { pinned: true } }, { name: '取消置顶', body: { pinned: false } }, { name: '归档', body: { archived: true } }, { name: '恢复', body: { archived: false } }],
    responseExample: { pinned: true, archived: false },
  },
  {
    id: 'sessions.delete-archived', module: 'chats', name: '永久删除已归档对话', method: 'DELETE', path: '/api/sessions/:id', success: 200,
    description: '永久清理该对话的历史、专属附件和浏览器数据。', note: '未知会话 404，未归档 409 SESSION_NOT_ARCHIVED，忙碌时 409 SESSION_BUSY。',
    request: [id], response: [id], examples: [], responseExample: { id: 'session-id' },
  },
  ...WORKSPACE_CATALOG,
  {
    id: 'models.list', module: 'models', name: '获取模型列表', method: 'GET', path: '/api/models', success: 200,
    description: '查看本机已注册的模型，以及每个模型是否已经配置凭据。',
    note: '仅返回公开模型信息，接口不会返回密钥、供应商地址或凭据路径。',
    request: [], examples: [],
    response: [field('models', 'array', true, '已注册的模型集合，可能包含尚未配置的模型。', '[]'),
      field('models[].provider', 'string', true, '供应商标识。', 'krill-ai-codex'),
      field('models[].id', 'string', true, '用于选择模型的标识，对应请求中的 model。', 'gpt-5.6-sol'),
      field('models[].name', 'string', true, '适合展示的模型名称。', 'gpt-5.6-sol · Krill AI'),
      field('models[].configured', 'boolean', true, '是否已配置本机凭据。', 'true'),
      ...capabilities.map((item) => ({ ...item, name: `models[].${item.name}` }))],
    responseExample: { models: [{ provider: 'krill-ai-codex', id: 'gpt-5.6-sol', name: 'gpt-5.6-sol · Krill AI', configured: true, ...capabilityExample }] },
  },
  {
    id: 'models.get-config', module: 'models', name: '读取默认模型', method: 'GET', path: '/api/model-config', success: 200,
    description: '读取创建新会话时使用的默认供应商、模型及配置状态。',
    note: '未配置模型时仍可调用此接口。configured 为 false 时，先在本机填写凭据。',
    request: [], response: modelConfig, examples: [], responseExample: configExample,
  },
  {
    id: 'models.set-config', module: 'models', name: '设置默认模型', method: 'PUT', path: '/api/model-config', success: 200,
    description: '将已注册、已配置凭据的模型设为默认值，供后续新会话使用。',
    note: '修改会保存到本机，重启后保留；已有会话继续使用原来的模型。',
    request: [provider, model, optionalThinking], response: modelConfig,
    examples: [{ name: '选择模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }], responseExample: configExample,
  },
  {
    id: 'sessions.create', module: 'sessions', name: '创建会话', method: 'POST', path: '/api/sessions', success: 201,
    description: '创建一个独立的 Agent 会话，用来开始对话、调用工具与保存生成结果。',
    note: '空会话立即保存。未指定名称时显示“新聊天”，首轮按原始提示词前 16 个字符命名。provider/model 必须同时提供。projectPath 必须是已存在且可访问的绝对目录，否则 422 PROJECT_PATH_INVALID；不自动创建目录。项目聊天启用 Pi 原生 read/grep/find/ls/edit/write 及平台终端（Windows powershell，其他平台 bash）。目录固定，切换需新建聊天。',
    request: [{ ...provider, required: false }, { ...model, required: false }, optionalThinking, { ...name, required: false }, projectPath], response: summary,
    examples: [{ name: '使用默认模型', body: {} }, { name: '项目聊天', body: { name: '项目任务', projectPath: 'D:/projects/example' } }, { name: '指定模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }],
    responseExample: sessionExample,
  },
  {
    id: 'sessions.project-files', module: 'sessions', name: '搜索项目文件', method: 'POST', path: '/api/sessions/:id/project-files', success: 200,
    description: '按相对路径关键词搜索当前项目，为聊天 @ 引用提供文件和目录候选。',
    note: 'query 可为空，大小写不敏感，返回最多 40 项、扫描最多 5000 项；跳过依赖/构建/版本目录及符号链接。truncated 表示达到限额，可细化关键词。没有项目 409 PROJECT_NOT_SELECTED；未知会话 404 SESSION_NOT_FOUND；项目不可用 422 PROJECT_PATH_INVALID；请求非法 400 INVALID_REQUEST。返回相对路径，不读取内容；引用由 Agent 工具实际读取，不是版本快照。',
    request: [id, field('query', 'string', true, '路径关键词，最多 200 字符，空字符串列出候选。', 'README')],
    response: [field('entries', 'array', true, '匹配的文件和目录。', '[]'), field('entries[].path', 'string', true, '项目相对路径。', 'README.md'),
      field('entries[].name', 'string', true, '文件或目录名。', 'README.md'), field('entries[].isDirectory', 'boolean', true, '是否目录。', 'false'),
      field('truncated', 'boolean', true, '是否达到扫描或结果限额。', 'false')],
    examples: [{ name: '搜索文件', body: { query: 'README' } }, { name: '列出候选', body: { query: '' } }],
    responseExample: { entries: [{ path: 'README.md', name: 'README.md', isDirectory: false }], truncated: false },
  },
  {
    id: 'sessions.list', module: 'sessions', name: '获取会话列表', method: 'GET', path: '/api/sessions', success: 200,
    description: '列出本机已保存的会话，查看所属模型、更新时间和当前运行状态。',
    note: '服务重启后，已保存的会话仍会出现在列表中。选择一个会话可直接继续检查。',
    request: [], examples: [],
    response: [field('sessions', 'array', true, '已保存的会话集合，空列表为 []。', '[]'),
      ...summary.map((item) => ({ ...item, name: `sessions[].${item.name}` })),
      field('sessions[].pinned', 'boolean', true, '是否置顶。', 'false'), field('sessions[].archived', 'boolean', true, '是否归档。', 'false'),
      field('sessions[].archivedAt', 'string', false, '本次归档的 ISO 8601 时间，仅已归档会话返回。', '2026-11-20T06:32:10.000Z'),
      field('sessions[].updatedAt', 'string', true, '最近更新时间，ISO 8601 日期。', '2026-11-17T08:07:31.000Z')],
    responseExample: { sessions: [{ ...sessionExample, pinned: false, archived: false, updatedAt: '2026-11-17T08:07:31.000Z' }] },
  },
  {
    id: 'sessions.get', module: 'sessions', name: '读取会话详情', method: 'GET', path: '/api/sessions/:id', success: 200,
    description: '打开已保存的会话，读取历史消息；生成中可查看当前文本快照。',
    note: '断流或刷新后用此接口核对结果。stream: 前缀代表临时快照，完成后以保存的消息 ID 为准；同一 turnId 组织一轮用户请求及其全部过程。phase=answer 只在 SDK 确认不再调用工具后出现，不能用首个文本增量猜测。retryMessageId 是可重试的最新用户消息；旧记录没有请求快照时省略。未知会话返回 404 SESSION_NOT_FOUND。',
    request: [id], examples: [],
    response: [...summary,
      field('retryMessageId', 'string', false, '可重放最新一轮的用户消息 ID；生成中禁用，调用 retry 时提交此值。', 'e2ab17'),
      field('messages', 'array', true, '用户、助手及工具消息，按对话顺序排列。', '[]'),
      field('messages[].id', 'string', true, '已保存消息 ID 重启后稳定；临时快照 ID 以 stream: 开头。', 'e2ab17'),
      field('messages[].turnId', 'string', false, '本次请求稳定轮次 ID，用户、过程、工具和最终回答共用。', 'turn-1'),
      field('messages[].phase', 'process | answer', false, '过程或已确认的最终回答，仅助手消息提供。', 'answer'),
      field('messages[].streaming', 'boolean', false, '当前助手消息仍在更新，临时快照中为 true。', 'true'),
      field('messages[].role', 'user | assistant | tool', true, '消息来源。', 'assistant'),
      field('messages[].elapsedSeconds', 'number', false, '已结束轮次的实际耗时（秒），仅在用户消息有完整起止记录时提供。', '186'),
      field('messages[].outcome', 'completed | aborted | failed', false, '已结束结果；用户消息上的结果表示整次请求结果。', 'completed'),
      field('messages[].content', 'array', true, '正文、可见思考文本或工具块数组。', '[]'),
      field('messages[].content[].type', 'text | thinking | tool | event', true, '正文、可见思考、工具或重试/上下文整理事件。', 'thinking'),
      field('messages[].content[].text', 'string', false, '正文、思考文本或工具结果说明；不含思考签名或加密数据。工具块可能省略。', '灯塔-731'),
      field('messages[].content[].callId', 'string', false, '工具块的调用 ID，用于关联工具执行。', 'read-1'),
      field('messages[].content[].name', 'string', false, '工具名称，或 event 的 retrying/compacting。', 'browser'),
      field('messages[].content[].status', 'running | completed | failed | stopped', false, '工具或过程事件状态；停止后未返回的工具标为 stopped。', 'completed'),
      field('messages[].content[].input', 'string', false, '模型实际提交的工具参数 JSON 文本；前端只展示，不执行。', '{"action":"snapshot"}'),
      field('messages[].content[].source', 'object', false, 'browser 或 web_fetch 成功读取的网页。', '{"id":"source-id","title":"Example Domain","url":"https://example.com/"}'),
      field('messages[].content[].source.id', 'string', false, '可供本轮回答引用的稳定 ID；旧网页记录可能省略。', 'source-id'),
      field('messages[].content[].source.title', 'string', false, '实际网页标题。', 'Example Domain'),
      field('messages[].content[].source.url', 'string', false, '实际访问的 HTTP(S) URL。', 'https://example.com/'),
      field('messages[].citations', 'array', false, '回答用 [来源](#plotloom-source-<id>) 显式引用并通过本轮校验的网页，按正文首次引用顺序去重。', '[]'),
      field('messages[].citations[].id', 'string', false, '与工具来源和正文链接对应的 ID。', 'source-id'),
      field('messages[].citations[].title', 'string', false, '被引用网页的实际标题。', 'Example Domain'),
      field('messages[].citations[].url', 'string', false, '被引用网页的实际访问地址。', 'https://example.com/'),
      field('messages[].attachments', 'array', false, '本轮用户实际发送的附件元信息；读取附件内容接口可预览，历史保留原始用户文字。', '[]'),
      ...ATTACHMENT_FIELDS.map(item => ({ ...item, name: `messages[].attachments[].${item.name}`, required: false })),
      field('messages[].references', 'array', false, '本轮文档引用和实际内容快照，原稿后续变化不改变历史。', '[]'),
      ...REFERENCE_FIELDS.map(item => ({ ...item, name: `messages[].references[].${item.name}`, required: false })),
      field('messages[].references[].content', 'string', false, '实际传入模型的指定版本全文或选区原文。', '林舟')],
    responseExample: { ...sessionExample, messages: [{ id: 'tool-1', role: 'tool', turnId: 'turn-1', content: [{ type: 'tool', name: 'web_fetch',
      callId: 'call-1', status: 'completed', source: { id: 'source-id', title: 'Example Domain', url: 'https://example.com/' } }] },
    { id: 'e2ab17', role: 'assistant', turnId: 'turn-1', phase: 'answer', content: [{ type: 'text', text: '该页面用于示例。[来源](#plotloom-source-source-id)' }],
      citations: [{ id: 'source-id', title: 'Example Domain', url: 'https://example.com/' }], outcome: 'completed' }] },
  },
  {
    id: 'sessions.get-config', module: 'sessions', name: '读取会话配置', method: 'GET', path: '/api/sessions/:id/config', success: 200,
    description: '读取会话自己的模型、思考档位、自动压缩开关及模型能力。', note: '不会修改全局默认值；没有凭据仍可读取已注册模型的信息。autoCompaction 与上下文查询一致。',
    request: [id], response: sessionConfig, examples: [], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.set-config', module: 'sessions', name: '修改会话配置', method: 'PUT', path: '/api/sessions/:id/config', success: 200,
    description: '修改当前会话的模型、思考强度或自动压缩开关，保留历史并持久保存。',
    note: '至少传一个配置项，未传项保持不变；provider/model 必须成对。autoCompaction 仅接受布尔值，单独修改不要求模型凭据，也不立即触发压缩。非法参数返回 400 INVALID_REQUEST；会话不存在返回 404 SESSION_NOT_FOUND；忙时返回 409 SESSION_BUSY，请等待或停止后重试。模型/档位错误返回 422，混合请求不会先修改开关。关闭仅禁用自动压缩，手动压缩仍可用。',
    request: [id, { ...provider, required: false }, { ...model, required: false }, optionalThinking, { ...autoCompaction, required: false }], response: sessionConfig,
    examples: [{ name: '调整思考档位', body: { thinkingLevel: 'low' } }, { name: '切换模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } },
      { name: '关闭自动压缩', body: { autoCompaction: false } }, { name: '开启自动压缩', body: { autoCompaction: true } }], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.rename', module: 'sessions', name: '修改会话名称', method: 'PUT', path: '/api/sessions/:id/name', success: 200,
    description: '为会话设置便于识别的名称，列表和详情同步显示。', note: '空会话也可命名并立即保存；忙时返回 409。',
    request: [id, name], response: summary, examples: [{ name: '命名会话', body: { name: '灯塔创作' } }], responseExample: sessionExample,
  },
  {
    id: 'sessions.tools', module: 'sessions', name: '读取会话工具', method: 'GET', path: '/api/sessions/:id/tools', success: 200,
    description: '查询注册工具、参数结构与当前启用情况。', note: '仅查询，不提供动态启停；parameters 是公开 JSON Schema。项目会话包含原生文件工具及平台终端，普通无项目会话不因此获得这些能力。项目工具直接执行，cwd 不是访问沙箱。',
    request: [id], examples: [], response: [id, field('tools', 'array', true, '会话注册工具。', '[]'),
      field('tools[].name', 'string', true, '调用工具的标识。', 'read_fixture'), field('tools[].description', 'string', true, '工具职责和使用说明。', '读取测试资料'),
      field('tools[].parameters', 'object', true, '工具参数 JSON Schema。', '{"type":"object"}'), field('tools[].active', 'boolean', true, '当前是否启用。', 'true')],
    responseExample: { id: sessionExample.id, tools: [{ name: 'read_fixture', description: '读取测试资料', parameters: { type: 'object' }, active: true }] },
  },
  {
    id: 'context.get', module: 'context', name: '读取上下文占用', method: 'GET', path: '/api/sessions/:id/context', success: 200,
    description: '查看上下文 token 估算、窗口大小、占用比例及自动压缩开关。', note: '这是 SDK 估算；tokens/percent 为 null 时表示未知，不表示没有占用。',
    request: [id], examples: [], response: [id, status, activity,
      field('tokens', 'number | null', true, '当前上下文 token 估算。', '1200'), field('contextWindow', 'number', true, '模型上下文窗口。', '128000'),
      field('percent', 'number | null', true, '占用百分比，非 0–1 比例。', '0.9375'), autoCompaction],
    responseExample: { id: sessionExample.id, status: 'idle', activity: 'idle', tokens: 1200, contextWindow: 128000, percent: 0.9375, autoCompaction: true },
  },
  {
    id: 'context.compact', module: 'context', name: '手动压缩上下文', method: 'POST', path: '/api/sessions/:id/compact', success: 200,
    description: '让模型摘要历史，降低后续对话上下文长度，完整历史仍可查询。',
    note: '请求等待压缩结束，可能持续较久；断开请求不取消后端任务。使用取消压缩接口停止。空会话或已压缩返回 409。',
    request: [id, field('instructions', 'string', false, '摘要补充要求，最多 2000 字符。', '保留人物和未解决线索')],
    examples: [{ name: '默认摘要', body: {} }, { name: '保留创作线索', body: { instructions: '保留人物、时间线和未解决线索。' } }],
    response: [id, field('status', 'idle', true, '请求结束时已释放会话。', 'idle'), field('outcome', 'completed | aborted', true, '实际完成或已取消。', 'completed'),
      field('summary', 'string', false, '成功时的摘要文本。', '保留灯塔线索'), field('tokensBefore', 'number', false, '压缩前估算 token。', '24000'),
      field('estimatedTokensAfter', 'number', false, '压缩后估算 token。', '8000'), ...usageFields],
    responseExample: { id: sessionExample.id, status: 'idle', outcome: 'completed', summary: '保留灯塔线索', tokensBefore: 24000, estimatedTokensAfter: 8000 },
  },
  {
    id: 'context.stop', module: 'context', name: '取消手动压缩', method: 'POST', path: '/api/sessions/:id/compact/stop', success: 200,
    description: '取消正在运行的手动压缩，等待任务释放会话。', note: '重复调用安全；普通生成不受此接口影响。取消时原压缩请求返回 outcome: aborted。',
    request: [id], response: [id, status], examples: [], responseExample: { id: sessionExample.id, status: 'idle' },
  },
  {
    id: 'context.stats', module: 'context', name: '读取累计用量', method: 'GET', path: '/api/sessions/:id/stats', success: 200,
    description: '读取会话消息、工具调用计数和 SDK 已保存的累计 token 用量。', note: '包括已记录的压缩用量；进行中的未落盘用量可能不在其中。不返回估算费用或供应商账单。',
    request: [id], examples: [], response: [id,
      ...['userMessages', 'assistantMessages', 'toolCalls', 'toolResults', 'totalMessages'].map((key, i) => field(key, 'number', true, ['用户消息数', '助手消息数', '工具调用数', '工具结果数', 'SDK 全部消息条目数，含其他内部角色，可能多于公开历史条数'][i], '2')), ...usageFields],
    responseExample: { id: sessionExample.id, userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, totalMessages: 2, usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 120 } },
  },
  {
    id: 'generation.send', module: 'generation', name: '发送消息', method: 'POST', path: '/api/sessions/:id/messages', success: 200, stream: true,
    description: '向指定会话提交一条消息，并实时接收文本、工具调用和最终状态。后端每轮按本机时区提供当前日期，内部日期上下文追加于历史末尾，不改写系统提示和旧消息，也不展示为用户正文。',
    note: '同一会话一次只处理一条请求。小说聊天自动获得当前书籍读取、搜索、审校与候选工具，生成记录可从 writing 查询；普通聊天没有小说工具。新章节及精确选区请用内容创作接口。技能从本次请求开始固定；skillIds 可显式加载已启用技能，不改变启用设置。不可用技能返回 422。断开订阅不会停止生成；要终止模型，请调用停止接口。',
    request: [id, field('text', 'string', false, '最多 100000 字符；文字、附件或文档引用至少有一项有效内容，纯附件/引用可省略。请求体上限 1 MiB。', '读取 scene 并给出 A、B 两个候选。'), field('skillIds', 'array', false, '本次显式加载说明的技能 ID，必须已启用且工具依赖可用；不传则按摘要自动选择。', '["skill-id"]'), ...SOURCE_REQUEST_FIELDS],
    response: [field('sessionId', 'string', true, '每一个 SSE 事件都有会话 ID。', '019…')],
    examples: [
      { name: '核对当前日期', body: { text: '今天是几号、星期几？请说明使用的时区。' } },
      { name: '读取资料与候选', body: { text: '请调用 read_fixture 读取 scene，写出核对标记并给出 A、B 两个行动候选，然后等待我选择。' } },
      { name: '继续上一轮', body: { text: '我选择 A。复述核对标记，再继续约 100 字，不重新调用工具。' } },
      { name: '测试长文本与停止', body: { text: '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。' } },
      { name: '显式使用已启用技能', body: { text: '请按所选技能处理这段对白。', skillIds: ['替换为已启用技能ID'] } },
      { name: '发送当前聊天附件', body: { text: '请根据附件整理线索。', attachmentIds: ['替换为附件ID'] } },
      { name: '访问浏览器并引用网页', body: { text: '使用 browser 打开 https://example.com，读取页面标题与正文，简要总结并在结论旁引用网页来源。' } },
      { name: '写项目文件', body: { text: '在当前项目创建 plotloom-check.md，写入「Plotloom 文件写入验证」，然后读取核对内容。' } },
      { name: '引用工作区文档', body: { text: '请核对这份资料。', references: [{ workspaceId: '替换为工作区ID', path: '角色/林舟.md', version: 'a'.repeat(64) }] } },
    ],
    responseExample: { event: 'text_delta', data: { sessionId: '019-example-session', delta: '灯塔-731。' } },
  },
  {
    id: 'generation.retry', module: 'generation', name: '重试最新一轮', method: 'POST', path: '/api/sessions/:id/retry', success: 200, stream: true,
    description: '保留历史，重新执行最新用户请求，包括原文字、附件、文档引用和显式技能；日期上下文取本次执行时的本机日期和时区，不沿用原请求日期。',
    note: '先读取会话的 retryMessageId 再提交。该操作会重新调用模型与工具，包括再次写文件或操作浏览器；不是撤销。使用当前会话模型和当前启用技能。400 INVALID_REQUEST 参数非法；404 SESSION_NOT_FOUND；409 SESSION_BUSY 正在运行，409 RETRY_UNAVAILABLE 目标不是最新请求或缺少请求快照；来源/模型校验失败沿用发送消息的 422/404/403。接受后 SSE 与发送消息一致，唯一结束事件 completed/failed/aborted；断开不停止。',
    request: [id, field('messageId', 'string', true, '会话详情 retryMessageId，必须仍是最新用户消息。', '替换为 retryMessageId')],
    response: [field('sessionId', 'string', true, '每个 SSE 事件均包含会话 ID。', '019…')],
    examples: [{ name: '重放最新请求', body: { messageId: '替换为 retryMessageId' } }],
    responseExample: { event: 'accepted', data: { sessionId: '019-example-session', messageId: 'new-user-message' } },
  },
  {
    id: 'generation.stop', module: 'generation', name: '停止生成', method: 'POST', path: '/api/sessions/:id/stop', success: 200,
    description: '主动停止指定会话的当前生成，等待结果保存后返回空闲状态。',
    note: '空闲会话重复停止仍返回 idle。也会取消手动压缩；消息流收到 aborted，压缩请求返回 outcome: aborted。',
    request: [id], response: [id, status], examples: [], responseExample: { id: '019-example-session', status: 'idle' },
  },
];

export const SSE_EVENTS: ReadonlyArray<{ name: string; description: string; fields: FieldDoc[] }> = [
  { name: 'accepted', description: '消息已接受并保存。', fields: [field('messageId', 'string', true, '已保存用户消息 ID，可在会话详情中找到。', 'e2ab17')] },
  { name: 'text_delta', description: '追加一段模型原文；网页引用标记可能跨增量，最终校验结果见会话详情的 citations。', fields: [field('delta', 'string', true, '本次增量，需要顺序追加。', '灯塔')] },
  { name: 'thinking_delta', description: '追加模型实际返回的可见思考文本，与正文分开展示。', fields: [field('delta', 'string', true, '只含文本；没有该事件不代表未进行推理。', '先整理线索')] },
  { name: 'tool_start', description: '工具开始执行。', fields: [field('callId', 'string', true, '工具调用 ID。', 'read-1'), field('name', 'string', true, '工具名称。', 'read_fixture')] },
  { name: 'tool_end', description: '工具执行结束，完整结果由会话查询读取。', fields: [field('callId', 'string', true, '关联开始事件。', 'read-1'), field('name', 'string', true, '工具名称。', 'read_fixture'), field('outcome', 'completed | failed', true, '工具执行结果。', 'completed')] },
  { name: 'retrying', description: '有限重试进行中，还不是最终失败。', fields: [field('attempt', 'number', true, '当前重试次数。', '1'), field('maxAttempts', 'number', true, '最大重试次数。', '2')] },
  { name: 'compacting', description: '自动压缩上下文，结束后继续等待最终事件。', fields: [field('phase', 'start | end', true, '压缩开始或结束。', 'start')] },
  { name: 'completed', description: '整轮请求最终完成。', fields: [field('usage', 'object', false, 'SDK 提供的整轮用量；缺失不代表无消耗。', '{}'),
    ...['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'].map((name, i) => field(`usage.${name}`, 'number', false, ['输入 token', '输出 token', '缓存读取 token', '缓存写入 token', '合计 token'][i], '100'))] },
  { name: 'aborted', description: '整轮请求已停止，无额外字段。', fields: [] },
  { name: 'failed', description: '整轮请求最终失败。', fields: [field('error.code', 'string', true, '公开错误码。', 'MODEL_FAILED'), field('error.message', 'string', true, '脱敏后的错误说明。', '模型生成失败，请检查本机模型配置后重试。')] },
];

export const API_ERRORS = [
  { status: '404', code: 'ATTACHMENT_NOT_FOUND / REFERENCE_NOT_FOUND', description: '附件不属于当前会话或指定文档版本不存在；重新查询附件或文档历史。' },
  { status: '403', code: 'REFERENCE_FORBIDDEN', description: '小说聊天不能引用其他工作区资料；普通聊天可显式引用已登记工作区。' },
  { status: '409', code: 'ATTACHMENT_IN_USE', description: '已发送附件必须保留以供历史读取，不能删除；可在下一轮不选用。' },
  { status: '422', code: 'ATTACHMENT_TYPE_UNSUPPORTED / ATTACHMENT_TOO_LARGE / ATTACHMENT_IMAGE_INVALID', description: '文件类型、大小或图片内容无效；检查允许类型及限额后重新上传。' },
  { status: '422', code: 'MODEL_IMAGE_UNSUPPORTED / MESSAGE_SOURCES_TOO_LARGE / MESSAGE_SOURCES_UNAVAILABLE', description: '模型不支持图片、引用超预算或宿主未配置资料能力；请求在 SSE 开始前拒绝，不写用户消息。' },
  { status: '500', code: 'ATTACHMENT_INVALID', description: '附件记录损坏或归属元数据不一致，请检查本机备份。' },
  { status: '422', code: 'NOVEL_SESSION_REQUIRED / WRITING_SOURCE_MISSING / WRITING_CONTEXT_TOO_LARGE', description: '创作需要小说聊天、存在的正式资料和预算内上下文。' },
  { status: '工具失败', code: 'WRITING_REVIEW_REQUIRED / WRITING_NEEDS_INPUT / WRITING_TARGET_MISMATCH / WRITING_OUTPUT_TOO_LARGE', description: '审校未完成、待确认冲突、目标不符或超预算时不生成候选；结果通过工具消息与创作查询查看。' },
  { status: '404', code: 'SKILL_NOT_FOUND / SKILL_FILE_NOT_FOUND', description: '技能或资源不存在；重新查询技能列表和资源路径。' },
  { status: '409', code: 'SKILL_NAME_EXISTS / SKILL_READ_ONLY / SKILL_VERSION_CONFLICT', description: '名称已存在、内置只读或版本已变化；换名、复制或重新读取。' },
  { status: '422', code: 'SKILL_IMPORT_FAILED / SKILL_UNAVAILABLE / SKILL_BINARY_RESOURCE', description: '导入目录不可读、显式技能未启用/依赖缺失，或资源不是 UTF-8 文本；检查来源、启用诊断或文件编码。' },
  { status: '500', code: 'SKILL_STATE_INVALID', description: '技能清单格式无效，请检查本机备份。' },
  { status: '400 / 404', code: 'INVALID_REQUEST / ASSET_NOT_FOUND', description: '资产参数、选区或路径无效，或资源不属于当前工作区。' },
  { status: '409', code: 'REVISION_CONFLICT / REFERENCE_CONFLICT', description: '原稿或参考资料已变化；重新读取并核对候选，不覆盖现稿。' },
  { status: '409', code: 'FILE_BUSY / FILE_UNWRITABLE / WORKSPACE_UNAVAILABLE', description: '文件被占用、上次写入进程仍在结束、权限不足或目录不可用；检查后重新读取。' },
  { status: '500', code: 'ASSET_INVALID', description: '工作区元数据格式无效，请核对本机备份。' },
  { status: '409', code: 'WORKSPACE_OVERLAP / BACKUP_EXISTS / CHANGE_RESOLVED', description: '目录归属冲突、备份目标已存在或差异已处理；选择独立目录或查看已有结果。' },
  { status: '409', code: 'COMMIT_UNCERTAIN', description: '提交尚未确认；查询工作区恢复信息，核对后显式保留当前磁盘。' },
  { status: '422', code: 'ENCODING_UNSUPPORTED / DIFF_TOO_COMPLEX / PLATFORM_UNSUPPORTED', description: '转换 UTF-8、缩小修改范围，或在已验证 Windows 平台执行文件写入。' },
  { status: '400', code: 'INVALID_REQUEST', description: '参数不合法：检查 JSON、字段类型、必填项或文本长度。' },
  { status: '403', code: 'ORIGIN_FORBIDDEN', description: '不允许跨站访问；请通过本机测试台代理访问。' },
  { status: '404', code: 'SESSION_NOT_FOUND / NOT_FOUND', description: '会话或路径不存在：重新获取会话列表。' },
  { status: '409', code: 'SESSION_BUSY', description: '会话忙：等待完成或停止后再发送。' },
  { status: '409', code: 'COMPACTION_UNAVAILABLE', description: '当前无可压缩内容，先继续对话。' },
  { status: '422', code: 'THINKING_LEVEL_UNSUPPORTED', description: '显式档位不受支持；查询模型能力后选择。' },
  { status: '422', code: 'MODEL_NOT_SELECTED / MODEL_NOT_FOUND / MODEL_NOT_CONFIGURED', description: '选择已注册模型，并在本机配置凭据。' },
  { status: '500', code: 'INTERNAL_ERROR / SESSION_INVALID', description: '服务或会话数据错误：检查本机日志。' },
  { status: '502', code: 'COMPACTION_FAILED', description: '压缩失败，原历史保留；检查配置后重试。' },
  { status: '503', code: 'SERVER_CLOSING', description: '服务正在关闭：重启后重新查询。' },
  { status: 'SSE', code: 'MODEL_FAILED', description: '模型生成失败：查看已保存消息后决定是否重新发送。' },
];
