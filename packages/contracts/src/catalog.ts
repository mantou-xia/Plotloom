import { WORKSPACE_CATALOG } from './workspace-catalog.ts';
import { SKILL_CATALOG } from './skill-catalog.ts';
import { WRITING_CATALOG } from './writing-catalog.ts';
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
  module: 'models' | 'sessions' | 'generation' | 'context' | 'workspaces' | 'documents' | 'proposals' | 'skills' | 'skill-settings' | 'chats' | 'writing';
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
const name = field('name', 'string', true, '会话名称，去除首尾空白后保存；请求为 1–120 字符且不能全空白。', '灯塔创作');
const activity = field('activity', 'idle | generating | configuring | compacting', true, '当前正在执行的操作。', 'idle');
const capabilities = [
  field('reasoning', 'boolean', true, '模型定义是否支持思考能力；不代表上游必然公开思考文本。', 'true'),
  field('thinkingLevels', 'array', true, 'SDK 对该模型允许的档位。', '["off","low","high"]'),
  field('contextWindow', 'number', true, '模型定义的上下文窗口，单位 token。', '128000'),
  field('maxTokens', 'number', true, '模型定义的单次最大输出 token。', '16384'),
  field('input', 'array', true, '模型声明的输入类型；消息接口目前只接收文本。', '["text"]'),
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
const summary = [id, provider, model, status, activity, name, thinking];
const configExample = { provider: 'krill-ai-codex', model: 'gpt-5.6-sol', configured: true, thinkingLevel: 'off' };
const sessionExample = { id: '019-example-session', provider: 'krill-ai-codex', model: 'gpt-5.6-sol', status: 'idle', activity: 'idle', name: '灯塔创作', thinkingLevel: 'off' };
const sessionConfig = [id, provider, model, thinking, field('capabilities', 'object', true, '当前模型能力。', '{}'), ...capabilities.map((item) => ({ ...item, name: `capabilities.${item.name}` }))];
const sessionConfigExample = { id: sessionExample.id, provider: configExample.provider, model: configExample.model, thinkingLevel: 'off', capabilities: capabilityExample };

export const API_MODULES = [
  { id: 'writing', name: '内容创作', description: '大纲留档、上下文、创作与来源', number: '11' },
  { id: 'skills', name: '技能库', description: '内置、自定义与完整目录导入', number: '08' },
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

export const API_CATALOG: readonly EndpointDoc[] = [
  ...WRITING_CATALOG,
  ...SKILL_CATALOG,
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
    note: '空会话也会立即保存。使用默认模型发送 {}；指定模型时，provider 与 model 必须同时提供。',
    request: [{ ...provider, required: false }, { ...model, required: false }, optionalThinking, { ...name, required: false }], response: summary,
    examples: [{ name: '使用默认模型', body: {} }, { name: '指定模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }],
    responseExample: sessionExample,
  },
  {
    id: 'sessions.list', module: 'sessions', name: '获取会话列表', method: 'GET', path: '/api/sessions', success: 200,
    description: '列出本机已保存的会话，查看所属模型、更新时间和当前运行状态。',
    note: '服务重启后，已保存的会话仍会出现在列表中。选择一个会话可直接继续检查。',
    request: [], examples: [],
    response: [field('sessions', 'array', true, '已保存的会话集合，空列表为 []。', '[]'),
      ...summary.map((item) => ({ ...item, name: `sessions[].${item.name}` })),
      field('sessions[].updatedAt', 'string', true, '最近更新时间，ISO 8601 日期。', '2026-11-17T08:07:31.000Z')],
    responseExample: { sessions: [{ ...sessionExample, updatedAt: '2026-11-17T08:07:31.000Z' }] },
  },
  {
    id: 'sessions.get', module: 'sessions', name: '读取会话详情', method: 'GET', path: '/api/sessions/:id', success: 200,
    description: '打开已保存的会话，读取历史消息；生成中可查看当前文本快照。',
    note: '断流后用此接口核对结果。stream: 前缀代表临时快照，完成后以保存的消息 ID 为准。',
    request: [id], examples: [],
    response: [...summary,
      field('messages', 'array', true, '用户、助手及工具消息，按对话顺序排列。', '[]'),
      field('messages[].id', 'string', true, '已保存消息 ID 重启后稳定；临时快照 ID 以 stream: 开头。', 'e2ab17'),
      field('messages[].role', 'user | assistant | tool', true, '消息来源。', 'assistant'),
      field('messages[].outcome', 'completed | aborted | failed', false, '已结束结果；用户消息上的结果表示整次请求结果。', 'completed'),
      field('messages[].content', 'array', true, '正文、可见思考文本或工具块数组。', '[]'),
      field('messages[].content[].type', 'text | thinking | tool', true, '内容块类别；thinking 仅在模型实际返回可见文本时出现。', 'thinking'),
      field('messages[].content[].text', 'string', false, '正文、思考文本或工具结果说明；不含思考签名或加密数据。工具块可能省略。', '灯塔-731'),
      field('messages[].content[].callId', 'string', false, '工具块的调用 ID，用于关联工具执行。', 'read-1'),
      field('messages[].content[].name', 'string', false, '工具名称，仅工具块具有此字段。', 'read_fixture'),
      field('messages[].content[].status', 'running | completed | failed', false, '工具执行状态，仅工具块具有此字段。', 'completed')],
    responseExample: { ...sessionExample, messages: [{ id: 'e2ab17', role: 'assistant', content: [{ type: 'text', text: '灯塔-731。A：检查台阶；B：修复电源。' }], outcome: 'completed' }] },
  },
  {
    id: 'sessions.get-config', module: 'sessions', name: '读取会话配置', method: 'GET', path: '/api/sessions/:id/config', success: 200,
    description: '读取会话自己的模型、思考档位及模型能力。', note: '不会修改全局默认值；没有凭据仍可读取已注册模型的信息。',
    request: [id], response: sessionConfig, examples: [], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.set-config', module: 'sessions', name: '修改会话配置', method: 'PUT', path: '/api/sessions/:id/config', success: 200,
    description: '在已有会话中切换模型或思考强度，保留历史并保存到当前会话。',
    note: '至少传一个配置项；provider/model 必须成对。显式不支持档位返回 422；只换模型会按能力调整原档位。忙时返回 409。',
    request: [id, { ...provider, required: false }, { ...model, required: false }, optionalThinking], response: sessionConfig,
    examples: [{ name: '调整思考档位', body: { thinkingLevel: 'low' } }, { name: '切换模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }], responseExample: sessionConfigExample,
  },
  {
    id: 'sessions.rename', module: 'sessions', name: '修改会话名称', method: 'PUT', path: '/api/sessions/:id/name', success: 200,
    description: '为会话设置便于识别的名称，列表和详情同步显示。', note: '空会话也可命名并立即保存；忙时返回 409。',
    request: [id, name], response: summary, examples: [{ name: '命名会话', body: { name: '灯塔创作' } }], responseExample: sessionExample,
  },
  {
    id: 'sessions.tools', module: 'sessions', name: '读取会话工具', method: 'GET', path: '/api/sessions/:id/tools', success: 200,
    description: '查询注册工具、参数结构与当前启用情况。', note: '仅查询，不提供动态启停；parameters 是公开 JSON Schema。',
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
      field('percent', 'number | null', true, '占用百分比，非 0–1 比例。', '0.9375'), field('autoCompaction', 'boolean', true, '是否已启用 SDK 自动压缩。', 'true')],
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
    description: '向指定会话提交一条消息，并实时接收文本、工具调用和最终状态。',
    note: '同一会话一次只处理一条请求。小说聊天自动获得当前书籍读取、搜索、审校与候选工具，生成记录可从 writing 查询；普通聊天没有小说工具。新章节及精确选区请用内容创作接口。技能从本次请求开始固定；skillIds 可显式加载已启用技能，不改变启用设置。不可用技能返回 422。断开订阅不会停止生成；要终止模型，请调用停止接口。',
    request: [id, field('text', 'string', true, '非空白文本，最多 100000 字符；请求体上限 1 MiB。', '读取 scene 并给出 A、B 两个候选。'), field('skillIds', 'array', false, '本次显式加载说明的技能 ID，必须已启用且工具依赖可用；不传则按摘要自动选择。', '["skill-id"]')],
    response: [field('sessionId', 'string', true, '每一个 SSE 事件都有会话 ID。', '019…')],
    examples: [
      { name: '读取资料与候选', body: { text: '请调用 read_fixture 读取 scene，写出核对标记并给出 A、B 两个行动候选，然后等待我选择。' } },
      { name: '继续上一轮', body: { text: '我选择 A。复述核对标记，再继续约 100 字，不重新调用工具。' } },
      { name: '测试长文本与停止', body: { text: '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。' } },
      { name: '显式使用已启用技能', body: { text: '请按所选技能处理这段对白。', skillIds: ['替换为已启用技能ID'] } },
    ],
    responseExample: { event: 'text_delta', data: { sessionId: '019-example-session', delta: '灯塔-731。' } },
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
  { name: 'text_delta', description: '追加一段正文。', fields: [field('delta', 'string', true, '本次增量，需要顺序追加。', '灯塔')] },
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
