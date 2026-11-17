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
  module: 'models' | 'sessions' | 'generation';
  name: string;
  method: 'GET' | 'POST' | 'PUT';
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
const status = field('status', 'idle | running', true, 'idle 可接收新消息；running 正在生成，同一会话再次提交返回 409。', 'idle');
const modelConfig = [
  field('provider', 'string | null', true, '默认供应商；尚未选择时为 null。', 'krill-ai-codex'),
  field('model', 'string | null', true, '默认模型；尚未选择时为 null。', 'gpt-5.6-sol'),
  field('configured', 'boolean', true, '是否存在模型及凭据；不代表已经验证供应商连通性。', 'true'),
];
const summary = [id, provider, model, status];
const configExample = { provider: 'krill-ai-codex', model: 'gpt-5.6-sol', configured: true };
const sessionExample = { id: '019-example-session', provider: 'krill-ai-codex', model: 'gpt-5.6-sol', status: 'idle' };

export const API_MODULES = [
  { id: 'models', name: '模型配置', description: '查看可用模型，选择默认模型', number: '01' },
  { id: 'sessions', name: '会话管理', description: '创建、查找和重新打开会话', number: '02' },
  { id: 'generation', name: '消息与生成', description: '发送消息、观察流式事件与停止', number: '03' },
] as const;

export const API_CATALOG: readonly EndpointDoc[] = [
  {
    id: 'models.list', module: 'models', name: '获取模型列表', method: 'GET', path: '/api/models', success: 200,
    description: '查看本机已注册的模型，以及每个模型是否已经配置凭据。',
    note: '仅返回公开模型信息，接口不会返回密钥、供应商地址或凭据路径。',
    request: [], examples: [],
    response: [field('models', 'array', true, '已注册的模型集合，可能包含尚未配置的模型。', '[]'),
      field('models[].provider', 'string', true, '供应商标识。', 'krill-ai-codex'),
      field('models[].id', 'string', true, '用于选择模型的标识，对应请求中的 model。', 'gpt-5.6-sol'),
      field('models[].name', 'string', true, '适合展示的模型名称。', 'gpt-5.6-sol · Krill AI'),
      field('models[].configured', 'boolean', true, '是否已配置本机凭据。', 'true')],
    responseExample: { models: [{ provider: 'krill-ai-codex', id: 'gpt-5.6-sol', name: 'gpt-5.6-sol · Krill AI', configured: true }] },
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
    request: [provider, model], response: modelConfig,
    examples: [{ name: '选择模型', body: { provider: 'krill-ai-codex', model: 'gpt-5.6-sol' } }], responseExample: configExample,
  },
  {
    id: 'sessions.create', module: 'sessions', name: '创建会话', method: 'POST', path: '/api/sessions', success: 201,
    description: '创建一个独立的 Agent 会话，用来开始对话、调用工具与保存生成结果。',
    note: '空会话也会立即保存。使用默认模型发送 {}；指定模型时，provider 与 model 必须同时提供。',
    request: [{ ...provider, required: false }, { ...model, required: false }], response: summary,
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
      field('messages[].content', 'array', true, '文本块或工具块数组。', '[]'),
      field('messages[].content[].type', 'text | tool', true, '内容块类别。', 'text'),
      field('messages[].content[].text', 'string', false, '文本正文或工具结果说明。工具块可能省略。', '灯塔-731'),
      field('messages[].content[].callId', 'string', false, '工具块的调用 ID，用于关联工具执行。', 'read-1'),
      field('messages[].content[].name', 'string', false, '工具名称，仅工具块具有此字段。', 'read_fixture'),
      field('messages[].content[].status', 'running | completed | failed', false, '工具执行状态，仅工具块具有此字段。', 'completed')],
    responseExample: { ...sessionExample, messages: [{ id: 'e2ab17', role: 'assistant', content: [{ type: 'text', text: '灯塔-731。A：检查台阶；B：修复电源。' }], outcome: 'completed' }] },
  },
  {
    id: 'generation.send', module: 'generation', name: '发送消息', method: 'POST', path: '/api/sessions/:id/messages', success: 200, stream: true,
    description: '向指定会话提交一条消息，并实时接收文本、工具调用和最终状态。',
    note: '同一会话一次只处理一条请求。断开订阅不会停止生成；要终止模型，请调用停止接口。',
    request: [id, field('text', 'string', true, '非空白文本，最多 100000 字符；请求体上限 1 MiB。', '读取 scene 并给出 A、B 两个候选。')],
    response: [field('sessionId', 'string', true, '每一个 SSE 事件都有会话 ID。', '019…')],
    examples: [
      { name: '读取资料与候选', body: { text: '请调用 read_fixture 读取 scene，写出核对标记并给出 A、B 两个行动候选，然后等待我选择。' } },
      { name: '继续上一轮', body: { text: '我选择 A。复述核对标记，再继续约 100 字，不重新调用工具。' } },
      { name: '测试长文本与停止', body: { text: '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。' } },
    ],
    responseExample: { event: 'text_delta', data: { sessionId: '019-example-session', delta: '灯塔-731。' } },
  },
  {
    id: 'generation.stop', module: 'generation', name: '停止生成', method: 'POST', path: '/api/sessions/:id/stop', success: 200,
    description: '主动停止指定会话的当前生成，等待结果保存后返回空闲状态。',
    note: '空闲会话重复停止仍返回 idle。正在订阅的消息流将收到 aborted 最终事件。',
    request: [id], response: [id, status], examples: [], responseExample: { id: '019-example-session', status: 'idle' },
  },
];

export const SSE_EVENTS: ReadonlyArray<{ name: string; description: string; fields: FieldDoc[] }> = [
  { name: 'accepted', description: '消息已接受并保存。', fields: [field('messageId', 'string', true, '已保存用户消息 ID，可在会话详情中找到。', 'e2ab17')] },
  { name: 'text_delta', description: '追加一段正文。', fields: [field('delta', 'string', true, '本次增量，需要顺序追加。', '灯塔')] },
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
  { status: '400', code: 'INVALID_REQUEST', description: '参数不合法：检查 JSON、字段类型、必填项或文本长度。' },
  { status: '403', code: 'ORIGIN_FORBIDDEN', description: '不允许跨站访问；请通过本机测试台代理访问。' },
  { status: '404', code: 'SESSION_NOT_FOUND / NOT_FOUND', description: '会话或路径不存在：重新获取会话列表。' },
  { status: '409', code: 'SESSION_BUSY', description: '会话忙：等待完成或停止后再发送。' },
  { status: '422', code: 'MODEL_NOT_SELECTED / MODEL_NOT_FOUND / MODEL_NOT_CONFIGURED', description: '选择已注册模型，并在本机配置凭据。' },
  { status: '500', code: 'INTERNAL_ERROR / SESSION_INVALID', description: '服务或会话数据错误：检查本机日志。' },
  { status: '503', code: 'SERVER_CLOSING', description: '服务正在关闭：重启后重新查询。' },
  { status: 'SSE', code: 'MODEL_FAILED', description: '模型生成失败：查看已保存消息后决定是否重新发送。' },
];
