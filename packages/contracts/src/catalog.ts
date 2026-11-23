import { WORKSPACE_CATALOG } from './workspace-catalog.ts';
import { SKILL_CATALOG } from './skill-catalog.ts';
import { WRITING_CATALOG } from './writing-catalog.ts';
import { SOURCE_CATALOG, SOURCE_REQUEST_FIELDS, ATTACHMENT_FIELDS, REFERENCE_FIELDS } from './source-catalog.ts';
import { CHARACTER_CARD_CATALOG } from './character-card-catalog.ts';
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
  module: 'models' | 'sessions' | 'generation' | 'context' | 'workspaces' | 'documents' | 'proposals' | 'skills' | 'skill-settings' | 'chats' | 'writing' | 'character-cards' | 'attachments' | 'projects' | 'agent-profile';
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
const approvalFields = (prefix: string) => [
  field(prefix + 'id', 'string', true, '本次待审批请求的唯一 ID。', '018cc233-92bc-7e51-abe9-63a0e8b3a30b'),
  field(prefix + 'turnId', 'string', true, '申请所属轮次。', 'turn-1'),
  field(prefix + 'callId', 'string', true, '关联的工具调用 ID。', 'write-1'),
  field(prefix + 'operation', 'create | overwrite | edit', true, '创建、覆盖或编辑项目或小说文件。', 'create'),
  field(prefix + 'path', 'string', true, '项目相对路径。', 'draft.md'),
  field(prefix + 'label', 'string', false, '小说专属文件操作标题。', '保存角色卡'),
  field(prefix + 'preview', 'string', true, '原内容和新内容的有限预览，过长时显式注明省略。', '写入后…'),
  field(prefix + 'expiresAt', 'string', true, '决定可提交的截止时间（ISO 8601）。', '2026-11-20T00:00:00.000Z'),
];
const questionId = '018cc233-92bc-7e51-abe9-63a0e8b3a30b';
const questionFields = (prefix: string) => [
  field(prefix + 'id', 'string', true, '本题唯一 ID，用于提交答案。', questionId),
  field(prefix + 'callId', 'string', true, '关联工具调用的 ID。', 'ask-user-1'),
  field(prefix + 'question', 'string', true, 'Agent 提出的问题。', '采用哪个叙事视角？'),
  field(prefix + 'options', 'array', true, '有序单选列表。提交序号从 1 开始。', '["第一人称","第三人称"]'),
];
const status = field('status', 'idle | running', true, 'idle 可写入；running 正在生成、改配置或压缩，此时写入返回 409。', 'idle');
const thinking = field('thinkingLevel', 'off | minimal | low | medium | high | xhigh | max', true, '实际生效的思考档位；可选值以模型 thinkingLevels 为准，不保证有可见思考。', 'low');
const optionalThinking = { ...thinking, required: false };
const autoCompaction = field('autoCompaction', 'boolean', true, '当前会话是否启用 Pi 自动压缩，默认 true；关闭不影响手动压缩，重启和资源重建后保留。', 'true');
const name = field('name', 'string', true, '会话名称，去除首尾空白后保存；请求为 1–120 字符且不能全空白。', '灯塔创作');
const projectId = field('projectId', 'string', true, '路径参数，来自项目列表或创建结果。', 'project-id');
const projectFields = [
  field('id', 'string', true, '项目唯一标识。', 'project-id'), field('name', 'string', true, '显示名称。', '我的作品'),
  field('path', 'string', true, '绑定的绝对目录。', 'D:/projects/story'), field('createdAt', 'string', true, '登记时间。', '2026-11-19T00:00:00.000Z'),
  field('pinned', 'boolean', false, '在侧栏项目分类中置顶，默认关闭。', 'true'),
  field('sidebarHidden', 'boolean', false, '仅隐藏侧栏分组，默认显示。', 'true'),
];
const projectPath = field('projectPath', 'string', false, '本机现存项目绝对目录。项目会话创建时规范化并固定，小说会话省略。项目文件变更需要审批。', 'D:/projects/example');
const activity = field('activity', 'idle | generating | awaiting_approval | awaiting_answer | configuring | compacting', true, '会话活动。awaiting_approval 待审批，awaiting_answer 待回答；两者均保持 running，可处理或停止。', 'idle');
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
const projectApprovalMode = field('projectApprovalMode', 'required | full_access', false, '项目和小说会话。required 为默认逐次审批；full_access 免通用文件工具逐次审批。交稿、角色卡、世界观等作者决定仍单独确认。', 'required');
const sessionConfig = [id, provider, model, thinking, autoCompaction, projectApprovalMode, field('capabilities', 'object', true, '当前模型能力。', '{}'), ...capabilities.map((item) => ({ ...item, name: `capabilities.${item.name}` }))];
const sessionConfigExample = { id: sessionExample.id, provider: configExample.provider, model: configExample.model, thinkingLevel: 'off', autoCompaction: true, capabilities: capabilityExample };

export const API_MODULES = [
  { id: 'agent-profile', name: 'Agent 人设', description: '首用引导和全局协作偏好', number: '14' },
  { id: 'projects', name: '项目', description: '系统选择文件夹、登记项目及切换已有项目', number: '13' },
  { id: 'attachments', name: '聊天附件', description: '上传、读取及移除当前会话资料', number: '12' },
  { id: 'writing', name: '内容创作', description: '大纲留档、分章世界观、创作与来源', number: '11' },
  { id: 'character-cards', name: '五栏角色卡', description: '创建阶段卡片、查询适用角色和历史版本', number: '15' },
  { id: 'skills', name: '技能库', description: '内置、自定义与本机文件夹选择导入', number: '08' },
  { id: 'skill-settings', name: '技能启用', description: '工作区默认、聊天覆盖和依赖诊断', number: '09' },
  { id: 'chats', name: '小说聊天', description: '聊天归属与最近列表', number: '10' },
  { id: 'workspaces', name: '小说工作区', description: '绑定空目录新建小说、备份及恢复提交', number: '05' },
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
const projectWriteExample = { id: '2ac5774e-45da-474e-b34d-e8c7c960605a', path: 'README.md', operation: 'edit', createdAt: '2026-11-21T08:00:00.000Z' };
const projectWriteFields = [
  field('id', 'string', true, '单次 Agent 写入记录 ID。', projectWriteExample.id),
  field('path', 'string', true, '会话绑定目录内的相对路径，统一使用 /。', projectWriteExample.path),
  field('operation', 'create | overwrite | edit', true, '新建、覆盖或局部编辑。', 'edit'),
  field('createdAt', 'string', true, '写入记录时间，ISO 8601。', projectWriteExample.createdAt),
];

const agentPersonaFields = [
  field('name', 'string', true, 'Agent 的称呼。最多 40 字符，留空沿用默认。', '小舟'),
  field('style', 'string', true, '沟通风格。最多 160 字符，留空沿用默认。', '简洁直率'),
  field('preferences', 'string', true, '协作偏好。最多 1000 字符，留空沿用默认。', '先列出分歧，再给出选项。'),
];
const agentProfileResponse = [
  field('setup', 'pending | skipped | configured', true, '首用状态，分别表示待引导、已跳过和已保存。', 'pending'),
  ...agentPersonaFields,
];
const agentPersonaExample = { name: '小舟', style: '简洁直率', preferences: '先列出分歧，再给出选项。' };

export const API_CATALOG: EndpointDoc[] = [
  { id: 'agent-profile.get', module: 'agent-profile', name: '读取全局人设', method: 'GET', path: '/api/agent-profile', success: 200,
    description: '读取所有项目会话与小说会话共用的 Agent 人设及首用状态。',
    note: '全新本机数据目录返回 pending 和空字段。异源浏览器请求返回 403 ORIGIN_FORBIDDEN。',
    request: [], response: agentProfileResponse, examples: [], responseExample: { setup: 'pending', name: '', style: '', preferences: '' } },
  { id: 'agent-profile.update', module: 'agent-profile', name: '保存人设或跳过引导', method: 'PUT', path: '/api/agent-profile', success: 200,
    description: '保存全局人设，或结束首用引导。配置写入本机，下一轮新请求开始时读取。',
    note: 'save 全量提交三项字段，skip 仅提交 action 且只结束未完成引导。无效操作、缺字段、多余字段或超长文本返回 400 INVALID_REQUEST。异源请求返回 403 ORIGIN_FORBIDDEN。',
    request: [field('action', 'save | skip', true, '保存人设或跳过首用引导。', 'save'),
      ...agentPersonaFields.map(item => ({ ...item, required: false, description: 'save 时必填。' + item.description }))],
    response: agentProfileResponse, examples: [{ name: '保存全局人设', body: { action: 'save', ...agentPersonaExample } },
      { name: '跳过首用引导', body: { action: 'skip' } }], responseExample: { setup: 'configured', ...agentPersonaExample } },
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
      ...projectFields.map(f => ({ ...f, name: 'projects[].' + f.name }))],
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
    id: 'projects.update', module: 'projects', name: '修改项目分组', method: 'PUT', path: '/api/projects/:projectId', success: 200,
    description: '修改项目显示名称、侧栏置顶或分组可见性。', note: '只更新提供的字段。参数无效 400，空白名称 422 PROJECT_NAME_INVALID，未知项目 404 PROJECT_NOT_FOUND。隐藏保留登记、源文件与聊天。',
    request: [projectId, ...projectFields.filter(f => ['name', 'pinned', 'sidebarHidden'].includes(f.name)).map(f => ({ ...f, required: false }))],
    response: projectFields, examples: [{ name: '置顶', body: { pinned: true } }, { name: '重命名', body: { name: '新名称' } }, { name: '从侧栏移除', body: { sidebarHidden: true } }],
    responseExample: { id: 'project-id', name: '我的作品', path: 'D:/projects/story', createdAt: '2026-11-19T00:00:00.000Z', pinned: true },
  },
  {
    id: 'projects.open-folder', module: 'projects', name: '打开项目文件夹', method: 'POST', path: '/api/projects/:projectId/open-folder', success: 200,
    description: '在本机 Windows 资源管理器中打开此项目登记的目录。', note: '未知项目 404，目录失效 422，启动失败 500，非 Windows 系统 501。',
    request: [projectId], response: [field('opened', 'boolean', true, '系统已启动资源管理器。', 'true')], examples: [{ name: '打开目录', body: {} }], responseExample: { opened: true },
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
    id: 'sessions.create', module: 'sessions', name: '创建项目会话', method: 'POST', path: '/api/sessions', success: 201,
    description: '创建绑定本机目录的项目会话。小说会话使用 /api/workspaces/:workspaceId/sessions。',
    note: '空会话立即保存。未指定名称时显示“新聊天”，首轮按原始提示词前 16 个字符命名。provider/model 必须同时提供。缺少 projectPath 返回 400 INVALID_REQUEST；目录必须是已存在且可访问的绝对目录，否则返回 422 PROJECT_PATH_INVALID。可用项目工具和条件见 GET /api/tools。目录固定，切换需新建聊天。',
    request: [{ ...provider, required: false }, { ...model, required: false }, optionalThinking, { ...name, required: false }, { ...projectPath, required: true }], response: summary.map(value => value.name === 'projectPath' ? { ...value, required: true } : value),
    examples: [{ name: '使用默认模型', body: { projectPath: 'D:/projects/example' } }, { name: '指定模型', body: { projectPath: 'D:/projects/example', provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }],
    responseExample: { ...sessionExample, projectPath: 'D:/projects/example' },
  },
  {
    id: 'sessions.project-files', module: 'sessions', name: '搜索项目文件', method: 'POST', path: '/api/sessions/:id/project-files', success: 200,
    description: '按相对路径关键词搜索当前项目，为聊天 @ 引用提供文件和目录候选。',
    note: 'query 可为空，大小写不敏感，返回最多 40 项、扫描最多 5000 项；跳过依赖目录、构建目录、隐藏与敏感名称、链接及应用数据。truncated 表示达到限额。未绑定目录 409 PROJECT_NOT_SELECTED；未知会话 404 SESSION_NOT_FOUND；项目不可用 422 PROJECT_PATH_INVALID；禁止访问 403 PROJECT_FILES_UNAVAILABLE；非法请求 400 INVALID_REQUEST。返回相对路径和名称，内容由 Agent 工具实际读取。',
    request: [id, field('query', 'string', true, '路径关键词，最多 200 字符，空字符串列出候选。', 'README')],
    response: [field('entries', 'array', true, '匹配的文件和目录。', '[]'), field('entries[].path', 'string', true, '项目相对路径。', 'README.md'),
      field('entries[].name', 'string', true, '文件或目录名。', 'README.md'), field('entries[].isDirectory', 'boolean', true, '是否目录。', 'false'),
      field('truncated', 'boolean', true, '是否达到扫描或结果限额。', 'false')],
    examples: [{ name: '搜索文件', body: { query: 'README' } }, { name: '列出候选', body: { query: '' } }],
    responseExample: { entries: [{ path: 'README.md', name: 'README.md', isDirectory: false }], truncated: false },
  },
  {
    id: 'sessions.deliverable', module: 'sessions', name: '预览或打开交付产物', method: 'POST', path: '/api/sessions/:id/deliverable', success: 200,
    description: '在会话绑定的项目或小说目录内读取交付文件预览，或显式交给本机默认应用打开。',
    note: '预览支持不超过 8 MiB 的 UTF-8 Markdown 和常见光栅图片。其他格式返回 unsupported。外部打开适用于 Windows 上允许的文档、数据和媒体文件。400 INVALID_REQUEST 表示请求或路径格式错误；404 SESSION_NOT_FOUND / DELIVERABLE_UNAVAILABLE 表示会话或文件不可用；409 PROJECT_NOT_SELECTED 表示会话无关联目录；422 DELIVERABLE_TOO_LARGE / DELIVERABLE_UNREADABLE / DELIVERABLE_OPEN_UNSUPPORTED / DELIVERABLE_OPEN_FAILED 表示预览超限、读取失败、无法外部打开此类型或系统关联打开失败；501 DELIVERABLE_OPEN_UNAVAILABLE 表示缺少 Windows 桌面。',
    request: [id, field('path', 'string', true, '会话绑定目录内的相对文件路径。', 'README.md'),
      field('action', 'string', true, 'preview 读取预览；open 请求在系统默认应用中打开。', 'preview')],
    response: [field('kind', 'string', true, '结果类型，取 markdown、image、unsupported 或 opened。', 'markdown'),
      field('content', 'string', false, 'kind 为 markdown 时返回 UTF-8 文档内容。', '# 项目说明'),
      field('src', 'string', false, 'kind 为 image 时返回 Base64 图像地址。', 'data:image/png;base64,iVBORw0KGgo=')],
    examples: [{ name: '预览项目文档', body: { path: 'README.md', action: 'preview' } },
      { name: '预览小说章节', body: { path: '正文章节/第四章.md', action: 'preview' } },
      { name: '外部打开文件', body: { path: 'README.md', action: 'open' } },
      { name: '文件不存在', body: { path: '不存在.md', action: 'preview' } }],
    responseExample: { kind: 'markdown', content: '# 项目说明' },
  },
  {
    id: 'sessions.project-writes', module: 'sessions', name: '列出 Agent 文件写入', method: 'GET', path: '/api/sessions/:id/project-writes', success: 200,
    description: '查询当前项目或小说会话成功写入的文件记录，按写入顺序排列。',
    note: '同一文件连续写入时生成独立记录。待审批、拒绝、取消及未执行的写入不出现。旧会话从开始记录起可查询；无记录返回空数组。未知会话返回 404 SESSION_NOT_FOUND，未绑定目录返回 409 PROJECT_NOT_SELECTED，参数非法返回 400 INVALID_REQUEST。',
    request: [id], examples: [],
    response: [field('changes', 'array', true, '成功写入记录的摘要列表。', '[]'),
      ...projectWriteFields.map(value => ({ ...value, name: 'changes[].' + value.name }))],
    responseExample: { changes: [projectWriteExample] },
  },
  {
    id: 'sessions.project-write-diff', module: 'sessions', name: '读取单次文件对比', method: 'GET', path: '/api/sessions/:id/project-writes/:writeId', success: 200,
    description: '对比当前会话一条写入记录的修改前后内容，不读取文件当前版本。',
    note: '未知会话返回 404 SESSION_NOT_FOUND，未知或其他会话的记录返回 404 PROJECT_WRITE_NOT_FOUND，未绑定目录返回 409 PROJECT_NOT_SELECTED，非法参数返回 400 INVALID_REQUEST，计算超时返回 422 PROJECT_DIFF_TOO_COMPLEX。',
    request: [id, field('writeId', 'string', true, '从当前会话的文件写入列表获取。', projectWriteExample.id)], examples: [],
    response: [...projectWriteFields,
      field('added', 'number', true, '新增行总数。', '1'), field('removed', 'number', true, '删除行总数。', '1'),
      field('blocks', 'array', true, '按文件内容顺序排列的差异块。', '[]'),
      field('blocks[].kind', 'context | added | removed', true, '未变更、新增或删除。', 'added'),
      field('blocks[].beforeStart', 'number | null', true, '修改前的起始行号，从 1 开始；新增块为 null。', 'null'),
      field('blocks[].afterStart', 'number | null', true, '修改后的起始行号，从 1 开始；删除块为 null。', '1'),
      field('blocks[].lines', 'array', true, '该块每行文本，包含原始行尾换行符。', '["新内容\\n"]'),
      field('blocks[].lines[]', 'string', true, '单行原文。', '新内容')],
    responseExample: { ...projectWriteExample, added: 1, removed: 1, blocks: [
      { kind: 'removed', beforeStart: 1, afterStart: null, lines: ['旧内容\n'] },
      { kind: 'added', beforeStart: null, afterStart: 1, lines: ['新内容\n'] },
    ] },
  },
  {
    id: 'sessions.list', module: 'sessions', name: '获取会话列表', method: 'GET', path: '/api/sessions', success: 200,
    description: '列出本机已保存的会话，查看所属模型、更新时间和当前运行状态。',
    note: '项目和小说会话重启后保留，包括已归档会话。升级时会清理没有项目或小说归属的旧会话及其专属数据。',
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
    note: '断流或刷新后用此接口核对结果。stream: 前缀代表临时快照，完成后以保存的消息 ID 为准；同一 turnId 组织一轮用户请求及其全部过程。phase=answer 只在 SDK 确认不再调用工具后出现，不能用首个文本增量猜测。retryMessageId 是可重试的最新用户消息；旧记录没有请求快照时省略。包含已结束且有实际写入的轮次文件摘要；行级计算超时的文件统计为 null。未知会话返回 404 SESSION_NOT_FOUND。',
    request: [id], examples: [],
    response: [...summary,
      field('pendingApprovals', 'array', false, '当前会话待审批请求。刷新后从这里恢复审批入口。', '[]'),
      ...approvalFields('pendingApprovals[].').map(item => ({ ...item, required: false })),
      field('pendingQuestion', 'object', false, '当前待回答问题。刷新后从这里恢复。', '{"id":"question-id","callId":"ask-user-1","question":"采用哪个叙事视角？","options":["第一人称","第三人称"]}'),
      ...questionFields('pendingQuestion.').map(item => ({ ...item, required: false })),
      field('manuscriptRequest', 'object', false, '最近一次右侧文稿定位或候选审阅请求，含请求 id、createdAt 和 view，用于刷新或断流后去重恢复。候选定位包含 proposalId。', '{}'),
      field('fileChanges', 'array', false, '包含成功写入的已结束轮次；生成中及无记录时省略对应轮次。', '[]'),
      field('fileChanges[].turnId', 'string', false, '与同轮消息一致的轮次 ID。', 'turn-1'),
      field('fileChanges[].files', 'array', false, '按首次写入顺序排列，一个文件仅出现一次。', '[]'),
      field('fileChanges[].files[].path', 'string', false, '项目相对路径。', 'README.md'),
      field('fileChanges[].files[].added', 'number | null', false, '连续写入合并后的新增行数，超时返回 null。', '8'),
      field('fileChanges[].files[].removed', 'number | null', false, '连续写入合并后的删除行数，超时返回 null。', '2'),
      field('fileChanges[].files[].writeIds', 'array', false, '该文件本轮实际写入 ID，按写入顺序排列。', '[]'),
      field('fileChanges[].files[].writeIds[]', 'string', false, '可查单次文件差异的写入记录标识。', projectWriteExample.id),
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
      field('messages[].references[].content', 'string', false, '实际传入模型的指定版本全文或选区原文。', '林舟'),
      field('messages[].references[].lineRange', 'object', false, '选区所在的首末行，行号从 1 起算且包含首尾。', '{"firstLine":1,"lastLine":1}')],
    responseExample: { ...sessionExample, fileChanges: [{ turnId: 'turn-1', files: [{ path: 'README.md', added: 8, removed: 2,
      writeIds: [projectWriteExample.id] }] }], messages: [{ id: 'tool-1', role: 'tool', turnId: 'turn-1', content: [{ type: 'tool', name: 'web_fetch',
      callId: 'call-1', status: 'completed', source: { id: 'source-id', title: 'Example Domain', url: 'https://example.com/' } }] },
    { id: 'e2ab17', role: 'assistant', turnId: 'turn-1', phase: 'answer', content: [{ type: 'text', text: '该页面用于示例。[来源](#plotloom-source-source-id)' }],
      citations: [{ id: 'source-id', title: 'Example Domain', url: 'https://example.com/' }], outcome: 'completed' }] },
  },
  {
    id: 'sessions.get-config', module: 'sessions', name: '读取会话配置', method: 'GET', path: '/api/sessions/:id/config', success: 200,
    description: '读取会话的模型、思考档位、自动压缩、模型能力和项目审批模式。', note: '审批模式仅在项目会话返回；历史项目会话默认为 required。autoCompaction 与上下文查询一致。',
    request: [id], response: sessionConfig, examples: [], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.set-config', module: 'sessions', name: '修改会话配置', method: 'PUT', path: '/api/sessions/:id/config', success: 200,
    description: '修改并保存当前会话的模型、思考强度、自动压缩或项目审批模式。',
    note: '至少传一个配置项，provider/model 必须成对。autoCompaction 和 projectApprovalMode 可独立修改。两类会话共用文件审批设置。非法参数返回 400 INVALID_REQUEST；会话不存在返回 404 SESSION_NOT_FOUND；忙碌或待审批时返回 409 SESSION_BUSY。模型或档位错误返回 422。关闭自动压缩仍可手动压缩。',
    request: [id, { ...provider, required: false }, { ...model, required: false }, optionalThinking, { ...autoCompaction, required: false }, projectApprovalMode], response: sessionConfig,
    examples: [{ name: '调整思考档位', body: { thinkingLevel: 'low' } }, { name: '切换模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } },
      { name: '关闭自动压缩', body: { autoCompaction: false } }, { name: '开启自动压缩', body: { autoCompaction: true } },
      { name: '项目写入需要审批', body: { projectApprovalMode: 'required' } }, { name: '项目写入免逐次审批', body: { projectApprovalMode: 'full_access' } }], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.rename', module: 'sessions', name: '修改会话名称', method: 'PUT', path: '/api/sessions/:id/name', success: 200,
    description: '为会话设置便于识别的名称，列表和详情同步显示。', note: '空会话也可命名并立即保存；忙时返回 409。',
    request: [id, name], response: summary, examples: [{ name: '命名会话', body: { name: '灯塔创作' } }], responseExample: sessionExample,
  },
  {
    id: 'sessions.tools', module: 'sessions', name: '读取会话工具', method: 'GET', path: '/api/sessions/:id/tools', success: 200,
    description: '查询注册工具、参数结构与当前启用情况。', note: 'parameters 是公开 JSON Schema；供查询使用。普通、项目和小说会话均提供 browser、web_fetch。文件工具限制在所选项目或小说目录内，写入变更需要审批。未知会话返回 404 SESSION_NOT_FOUND。',
    request: [id], examples: [], response: [id, field('tools', 'array', true, '会话注册工具。', '[]'),
      field('tools[].name', 'string', true, '调用工具的标识。', 'read'), field('tools[].description', 'string', true, '工具职责和使用说明。', '读取项目文本文件'),
      field('tools[].parameters', 'object', true, '工具参数 JSON Schema。', '{"type":"object"}'), field('tools[].active', 'boolean', true, '当前是否启用。', 'true')],
    responseExample: { id: sessionExample.id, tools: [{ name: 'read', description: '读取项目文本文件', parameters: { type: 'object' }, active: true }] },
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
    note: '同一会话一次只处理一条请求。全局人设待设置时，Agent 可通过 user_answer_required 请求确认，确认前不写入人设。小说聊天支持审校与候选，可从 writing 查询创作记录。导入旧稿或交付新章时，新增正文使用正文章节/第4章.md 这样的阿拉伯数字章号路径，已存在的章节保留原路径。引用含 editComment 时，本轮仅开放精确选区写入。模型可调用 edit_quoted_selections 并通过 tool_approval_required 发起审批，批准且版本相符时仅替换所选字符。格式或选区错误返回 400，跨工作区或项目聊天尝试选区修改返回 403，版本不存在返回 404。审批时版本变化会在工具结果中报告冲突。成功的 tool_end 带有稿件刷新指令。技能从本次请求开始固定，skillIds 不改变启用设置，不可用技能返回 422。流以 completed、aborted 或 failed 结束。断开订阅不会停止生成，要终止模型请调用停止接口。',
    request: [id, field('text', 'string', false, '最多 100000 字符；文字、附件或文档引用至少有一项有效内容，纯附件/引用可省略。请求体上限 1 MiB。', '读取 scene 并给出 A、B 两个候选。'), field('skillIds', 'array', false, '本次显式加载说明的技能 ID，必须已启用且工具依赖可用；不传则按摘要自动选择。', '["skill-id"]'), ...SOURCE_REQUEST_FIELDS],
    response: [field('sessionId', 'string', true, '每一个 SSE 事件都有会话 ID。', '019…')],
    examples: [
      { name: '核对当前日期', body: { text: '今天是几号、星期几？请说明使用的时区。' } },
      { name: '读取资料与候选', body: { text: '请读取项目中的 README.md，根据内容给出 A、B 两个行动候选，然后等待我选择。' } },
      { name: '继续上一轮', body: { text: '我选择 A。复述核对标记，再继续约 100 字，不重新调用工具。' } },
      { name: '测试长文本与停止', body: { text: '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。' } },
      { name: '显式使用已启用技能', body: { text: '请按所选技能处理这段对白。', skillIds: ['替换为已启用技能ID'] } },
      { name: '发送当前聊天附件', body: { text: '请根据附件整理线索。', attachmentIds: ['替换为附件ID'] } },
      { name: '小说聊天导入旧章节', body: { text: '请调用 import_chapters 导入本轮旧稿附件并让我确认。', attachmentIds: ['替换为TXT或Markdown附件ID'] } },
      { name: '小说聊天写新章', body: { text: '写第四章：林舟抵达码头，发现渡船提前离开。' } },
      { name: '提醒为关键人物建卡', body: { text: '请核对本聊天已交付的章节，若有影响后续剧情且缺卡的人物，请引用原句提醒我建卡。先核对称呼，等我选择后再起草。' } },
      { name: '交稿后复核角色变化', body: { text: '请复核本聊天刚交付的第四章。逐一对照出场角色的适用卡片，引用证据段提出变化；如有变化请逐项让我确认。' } },
      { name: '新章交付后核对重大世界观变化', body: { text: '写第二十三章：旧航海时代终结，潮门永久封闭导致全海岸从此无法通航。请交稿，引用正式章稿说明对后续剧情的持续影响，并请我确认世界观建议。' } },
      { name: '聊天导出第四章 TXT', body: { text: '请将本书第四章最新保存的正文导出为 TXT。' } },
      { name: '修改小说文稿并在右侧采纳', body: { text: '请读取本书第一章，将「林舟走到码头。」改成「林舟跑到码头。」。调用 manuscript_workspace 的 edit 提交候选。' } },
      { name: '审校润色并打开候选', body: { text: '请读取本书第一章，润色环境描写。审校通过后调用 propose_change 提交候选，在右侧审阅。' } },
      { name: '分段起草第四章并确认整章', body: { text: '完成第四章，大纲如下：林舟抵达码头，从前一章的约定展开。分段暂存，整章写完后交给我确认。' } },
      { name: '访问浏览器并引用网页', body: { text: '使用 browser 打开 https://example.com，读取页面标题与正文，简要总结并在结论旁引用网页来源。' } },
      { name: '写项目文件', body: { text: '在当前项目创建 plotloom-check.md，写入「Plotloom 文件写入验证」，然后读取核对内容。' } },
      { name: '让 Agent 提问', body: { text: '请调用 ask_user 询问我想采用「第一人称」还是「第三人称」，等我回答后再写一句示例。' } },
      { name: '首次对话设定 Agent 人设', body: { text: '你好！我想叫你小舟。请用简洁的语气跟我协作，先给结论。' } },
      { name: '引用工作区文档', body: { text: '请核对这份资料。', references: [{ workspaceId: '替换为工作区ID', path: '角色/林舟.md', version: 'a'.repeat(64) }] } },
      { name: '审批后修改章节选区', body: { references: [{ workspaceId: '替换为当前小说ID', path: '正文章节/第一章.md', version: 'a'.repeat(64),
        selection: { start: 0, end: 2, text: '林舟' }, editComment: '请将选区改成“陆舟”。' }] } },
      { name: '只删除选区中点名的短语', body: { references: [{ workspaceId: '替换为当前小说ID', path: '正文章节/第一章.md', version: 'a'.repeat(64),
        selection: { start: 0, end: '第二声没喊全，他就哭得弯下了腰'.length, text: '第二声没喊全，他就哭得弯下了腰' }, editComment: '第二声没喊全可以删掉' }] } },
    ],
    responseExample: { event: 'text_delta', data: { sessionId: '019-example-session', delta: '灯塔-731。' } },
  },
  {
    id: 'generation.answer-question', module: 'generation', name: '回答 Agent 提问', method: 'POST',
    path: '/api/sessions/:id/questions/:questionId/answer', success: 200,
    description: '提交选择、自填答案或跳过。首用人设确认卡选择第一项后，原工具负责保存或结束引导。答案仅接收一次，原生成流继续运行并最终发送 completed、aborted 或 failed。',
    note: '从 user_answer_required 事件或会话详情 pendingQuestion 取得题目 ID。400 INVALID_REQUEST 参数错误，404 SESSION_NOT_FOUND 会话未知，409 QUESTION_UNAVAILABLE 问题已回答、已取消或不属于当前会话，422 INVALID_QUESTION_OPTION 选项不存在。',
    request: [id, field('questionId', 'string', true, '待回答问题 ID。', questionId),
      field('kind', 'option | custom | skip', true, '选项、自填或跳过。', 'option'),
      field('index', 'number', false, '仅 option 必填，当前题目从 1 开始的整数序号。', '1'),
      field('text', 'string', false, '仅 custom 必填，非空，最多 2000 字符。', '结合书信体叙述')],
    response: [field('id', 'string', true, '已回答的问题 ID。', questionId),
      field('kind', 'option | custom | skip', true, '已接收的回答方式。', 'option')],
    examples: [{ name: '选择第一项', body: { kind: 'option', index: 1 } },
      { name: '自行回答', body: { kind: 'custom', text: '结合书信体叙述' } }, { name: '跳过', body: { kind: 'skip' } }],
    responseExample: { id: questionId, kind: 'option' },
  },
  {
    id: 'generation.retry', module: 'generation', name: '重试最新一轮', method: 'POST', path: '/api/sessions/:id/retry', success: 200, stream: true,
    description: '保留历史并重新执行最新用户请求。通用消息重放文字、附件、文档引用和显式技能。结构化创作重放任务、目标与选区、大纲、参考资料版本和字符预算，并沿用已保存的模型、思考档位和压缩设置。日期上下文取本次执行时的本机日期和时区，不沿用原请求日期。',
    note: '先读取会话的 retryMessageId 再提交。重新调用模型与工具，项目写入重新请求批准。通用消息和无配置快照的旧创作轮次使用当前模型与启用技能。400 INVALID_REQUEST 参数非法；404 SESSION_NOT_FOUND；409 SESSION_BUSY 正在运行，409 RETRY_UNAVAILABLE 目标过期、缺少原请求或创作技能版本/配置不可重现，409 REVISION_CONFLICT 创作目标或资料的版本已变化；来源、技能与模型错误沿用原发送接口。SSE 与发送消息一致，唯一结束事件 completed/failed/aborted；断开不停止。',
    request: [id, field('messageId', 'string', true, '会话详情 retryMessageId，必须仍是最新用户消息。', '替换为 retryMessageId')],
    response: [field('sessionId', 'string', true, '每个 SSE 事件均包含会话 ID。', '019…')],
    examples: [{ name: '重放最新请求', body: { messageId: '替换为 retryMessageId' } },
      { name: '重放最近一次结构化创作', body: { messageId: '替换为创作会话的 retryMessageId' } }],
    responseExample: { event: 'accepted', data: { sessionId: '019-example-session', messageId: 'new-user-message' } },
  },
  {
    id: 'generation.tool-approval', module: 'generation', name: '决定工具审批', method: 'POST',
    path: '/api/sessions/:id/tool-approvals/:approvalId', success: 200,
    description: '批准一次文件变更或拒绝。响应代表决定已接收，工具结果见原消息流或会话详情。',
    note: '使用 tool_approval_required 或会话详情中的待审批 ID。非法参数 400，未知会话 404，已决定、取消、过期或会话不符返回 409 TOOL_APPROVAL_UNAVAILABLE。',
    request: [id, field('approvalId', 'string', true, '待审批请求路径参数。', '018cc233-92bc-7e51-abe9-63a0e8b3a30b'),
      field('decision', 'approve | deny', true, '允许一次或拒绝。', 'approve')],
    response: [field('id', 'string', true, '已决定的审批 ID。', '018cc233-92bc-7e51-abe9-63a0e8b3a30b'),
      field('decision', 'approve | deny', true, '已接受的决定。', 'approve')],
    examples: [{ name: '允许一次', body: { decision: 'approve' } }, { name: '拒绝', body: { decision: 'deny' } }],
    responseExample: { id: '018cc233-92bc-7e51-abe9-63a0e8b3a30b', decision: 'approve' },
  },
  {
    id: 'generation.stop', module: 'generation', name: '停止生成', method: 'POST', path: '/api/sessions/:id/stop', success: 200,
    description: '主动停止指定会话的当前生成，等待结果保存后返回空闲状态。',
    note: '空闲会话重复停止仍返回 idle。取消待回答问题、待审批请求或手动压缩；消息流收到 aborted，压缩请求返回 outcome: aborted。',
    request: [id], response: [id, status], examples: [], responseExample: { id: '019-example-session', status: 'idle' },
  },
];

API_CATALOG.push(...CHARACTER_CARD_CATALOG);

export const SSE_EVENTS: ReadonlyArray<{ name: string; description: string; fields: FieldDoc[] }> = [
  { name: 'accepted', description: '消息已接受并保存。', fields: [field('messageId', 'string', true, '已保存用户消息 ID，可在会话详情中找到。', 'e2ab17')] },
  { name: 'text_delta', description: '追加一段模型原文；网页引用标记可能跨增量，最终校验结果见会话详情的 citations。', fields: [field('delta', 'string', true, '本次增量，需要顺序追加。', '灯塔')] },
  { name: 'thinking_delta', description: '追加模型实际返回的可见思考文本，与正文分开展示。', fields: [field('delta', 'string', true, '只含文本；没有该事件不代表未进行推理。', '先整理线索')] },
  { name: 'tool_start', description: 'SDK 开始处理工具调用；写入可能进入待审批。', fields: [field('callId', 'string', true, '工具调用 ID。', 'read-1'), field('name', 'string', true, '工具名称。', 'read')] },
  { name: 'tool_approval_required', description: '项目或小说文件变更等待一次性审批；停止会取消等待。', fields: approvalFields('approval.') },
  { name: 'user_answer_required', description: 'Agent 等待用户回答，消息流保持开启；提交答案、跳过或停止可结束等待。', fields: questionFields('question.') },
  { name: 'tool_end', description: '工具执行结束，完整结果由会话查询读取。选区修改若误删点名短语以外的文字、留下孤立标点或违反明确的精简要求，会在请求审批前返回工具失败。', fields: [field('callId', 'string', true, '关联开始事件。', 'read-1'), field('name', 'string', true, '工具名称。', 'read'), field('outcome', 'completed | failed', true, '工具执行结果。', 'completed'),
    field('manuscriptView', 'object', false, '右侧文稿定位，含 workspaceId、path、mode（edit、preview、history、refresh、discard 或 export_txt）。edit 可带 proposalId，直接打开待审候选，只有采纳才写正式稿。定稿定位可带 revisionId。刷新目录时 path 为空。export_txt 的 downloadId 用于下载去重。', '{}')] },
  { name: 'retrying', description: '有限重试进行中，还不是最终失败。', fields: [field('attempt', 'number', true, '当前重试次数。', '1'), field('maxAttempts', 'number', true, '最大重试次数。', '2')] },
  { name: 'compacting', description: '自动压缩上下文，结束后继续等待最终事件。', fields: [field('phase', 'start | end', true, '压缩开始或结束。', 'start')] },
  { name: 'completed', description: '整轮请求最终完成。', fields: [field('usage', 'object', false, 'SDK 提供的整轮用量；缺失不代表无消耗。', '{}'),
    ...['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'].map((name, i) => field(`usage.${name}`, 'number', false, ['输入 token', '输出 token', '缓存读取 token', '缓存写入 token', '合计 token'][i], '100'))] },
  { name: 'aborted', description: '整轮请求已停止，无额外字段。', fields: [] },
  { name: 'failed', description: '整轮请求最终失败。', fields: [field('error.code', 'string', true, '公开错误码。', 'MODEL_FAILED'), field('error.message', 'string', true, '脱敏后的错误说明。供应商无可用上游账号时会明确提示。', '模型服务商当前没有可用的上游账号，请稍后重试或切换模型。')] },
];

export const API_ERRORS = [
  { status: '422', code: 'INVALID_QUESTION_OPTION', description: '选项序号超出当前题目范围。' },
  { status: '409', code: 'QUESTION_UNAVAILABLE', description: '问题已处理、已取消或不属于当前会话。' },
  { status: '404', code: 'ATTACHMENT_NOT_FOUND / REFERENCE_NOT_FOUND', description: '附件不属于当前会话或指定文档版本不存在；重新查询附件或文档历史。' },
  { status: '403', code: 'REFERENCE_FORBIDDEN', description: '小说聊天不能引用其他工作区资料；项目聊天可显式引用已登记工作区。' },
  { status: '409', code: 'ATTACHMENT_IN_USE', description: '已发送附件必须保留以供历史读取，不能删除；可在下一轮不选用。' },
  { status: '422', code: 'ATTACHMENT_TYPE_UNSUPPORTED / ATTACHMENT_TOO_LARGE / ATTACHMENT_IMAGE_INVALID', description: '文件类型、大小或图片内容无效；检查允许类型及限额后重新上传。' },
  { status: '422', code: 'MODEL_IMAGE_UNSUPPORTED / MESSAGE_SOURCES_TOO_LARGE / MESSAGE_SOURCES_UNAVAILABLE', description: '模型不支持图片、引用超预算或宿主未配置资料能力；请求在 SSE 开始前拒绝，不写用户消息。' },
  { status: '500', code: 'ATTACHMENT_INVALID', description: '附件记录损坏或归属元数据不一致，请检查本机备份。' },
  { status: '422', code: 'NOVEL_SESSION_REQUIRED / WRITING_SOURCE_MISSING / WRITING_CONTEXT_TOO_LARGE', description: '创作需要小说聊天、存在的正式资料和预算内上下文。' },
  { status: '404', code: 'CHARACTER_CARD_NOT_FOUND', description: '指定角色卡阶段不存在或文件缺少阶段元数据。' },
  { status: '工具失败', code: 'WRITING_REVIEW_REQUIRED / WRITING_NEEDS_INPUT / WRITING_TARGET_MISMATCH / WRITING_OUTPUT_TOO_LARGE', description: '审校未完成、待确认冲突、目标不符或超预算时不生成候选；结果通过工具消息与创作查询查看。' },
  { status: '404', code: 'SKILL_NOT_FOUND / SKILL_FILE_NOT_FOUND', description: '技能或资源不存在；重新查询技能列表和资源路径。' },
  { status: '409', code: 'SKILL_NAME_EXISTS / SKILL_READ_ONLY / SKILL_VERSION_CONFLICT', description: '名称已存在、内置只读或版本已变化；换名、复制或重新读取。' },
  { status: '422', code: 'SKILL_IMPORT_FAILED / SKILL_UNAVAILABLE / SKILL_BINARY_RESOURCE', description: '导入目录不可读、显式技能未启用/依赖缺失，或资源不是 UTF-8 文本；检查来源、启用诊断或文件编码。' },
  { status: '500', code: 'SKILL_STATE_INVALID', description: '技能清单格式无效，请检查本机备份。' },
  { status: '400 / 404', code: 'INVALID_REQUEST / ASSET_NOT_FOUND', description: '资产参数、选区或路径无效，或资源不属于当前工作区。' },
  { status: '409', code: 'REVISION_CONFLICT / REFERENCE_CONFLICT', description: '原稿或参考资料已变化；重新读取并核对候选，不覆盖现稿。' },
  { status: '409', code: 'CHAPTER_IMPORT_CONFLICT', description: '旧稿导入遇到同章已有不同文件或正文，保留现稿。聊天工具在 SSE 中报告失败。' },
  { status: '422', code: 'CHAPTER_IMPORT_AMBIGUOUS', description: '旧稿章标题不明确、章号重复或没有正文，需核对附件后重试。聊天工具在 SSE 中报告失败。' },
  { status: '409', code: 'FILE_BUSY / FILE_UNWRITABLE / WORKSPACE_UNAVAILABLE', description: '文件被占用、上次写入进程仍在结束、权限不足或目录不可用；检查后重新读取。' },
  { status: '500', code: 'ASSET_INVALID', description: '工作区元数据格式无效，请核对本机备份。' },
  { status: '409', code: 'WORKSPACE_NOT_EMPTY', description: '新建小说只能绑定空文件夹，请另选目录。' },
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
