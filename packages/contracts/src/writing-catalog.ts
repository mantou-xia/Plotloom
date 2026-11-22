import type { EndpointDoc, FieldDoc } from './catalog.ts';

const f = (name: string, type: string, description: string, example: string, required = true): FieldDoc => ({ name, type, description, example, required });
const nested = (prefix: string, fields: FieldDoc[]) => fields.map(v => ({ ...v, name: `${prefix}.${v.name}` }));
const path = f('path', 'string', '所属小说内的 .md 相对路径。', '章节/第一章.md');
const version = f('version', 'string', '实际读取的内容版本，不能使用示例占位值。', 'a'.repeat(64));
const selection = [f('start', 'number', 'UTF-16 起点，包含。', '0'), f('end', 'number', 'UTF-16 终点，不包含，不可切开 emoji。', '3'), f('text', 'string', '对应原文，必须精确匹配。', '旧句。')];
const target = [path, f('baseVersion', 'string | null', '目标基础版本；新文件为 null。', 'null'), f('selection', 'object', '仅 rewrite 传入；continue 由服务绑定末尾插入。', '{}', false), ...nested('selection', selection.map(v => ({ ...v, required: false })))];
const references = [path, version, f('role', 'string', 'outline/character/requirements/sample/history/other，说明资料用途。', 'character'),
  f('selection', 'object', '可选引用片段，未提供时使用完整文件。', '{}', false), ...nested('selection', selection.map(v => ({ ...v, required: false })))];
const chapterNumber = f('chapterNumber', 'number', '世界观适用章号为 1–999999 的整数。显式值优先，其次识别目标文件名或要求中的章号。创作未指明时按第一章，作者讨论未指明时查看全貌。', '4', false);
const request = [f('id', 'string', '已归属于小说的会话 ID，路径参数。', 'session-id'),
  f('task', 'chapter | continue | rewrite | enrich_outline | discuss', '生成章节、尾部续写、选区改写、大纲丰富或讨论。', 'chapter'),
  f('instructions', 'string', '作者本轮要求，非空且最多 10000 字符。', '按大纲写出码头告别场景。'),
  f('target', 'object', '除 discuss 外必填；服务固定目标，模型不能扩大范围。', '{}', false), ...nested('target', target.map(v => ({ ...v, required: false }))),
  f('outline', 'object', 'chapter 必填，引用已留档的正式大纲。', '{}', false), ...nested('outline', [path, version].map(v => ({ ...v, required: false }))),
  f('references', 'array', '最多 30 个参考文件，可选角色卡、样文、要求、历史片段。', '[]', false), ...nested('references[]', references.map(v => ({ ...v, required: false }))),
  f('maxOutputChars', 'number', '候选 UTF-16 字符上限，200–20000，默认 8000；非模型 token 配额。', '4000', false),
  f('skillIds', 'array', '本轮明确加载的已启用技能；不修改设置。', '["builtin-novel-writing"]', false), chapterNumber];
const source = [path, { ...version, type: 'string | null', description: '本轮正式文件版本，新建目标为 null。' }, f('content', 'string', '固定的实际原文快照。', '林舟站在码头。'),
  f('role', 'string', '资料用途；目标为 target。', 'target'), f('selection', 'object', '选定引用片段，若有。', '{}', false), ...nested('selection', selection.map(v => ({ ...v, required: false })))];
const context = [f('workspaceId', 'string', '从会话绑定的小说 ID。', 'workspace-id'), request[1], request[2], chapterNumber,
  f('target', 'object', '固定的目标及修改范围；讨论可无目标。', '{}', false), ...nested('target', target.map(v => ({ ...v, required: false }))),
  f('sources', 'array', '正式资料与版本，含目标、大纲、指定参考和后续实际读取资料。', '[]'), ...nested('sources[]', source),
  f('maxOutputChars', 'number', '候选硬性字符上限。', '8000'), f('inputChars', 'number', '要求及完整资料快照的字符总量。', '25'), f('inputLimit', 'number', '输入快照上限，超限明确拒绝，不静默截断。', '60000')];
const issue = [f('kind', 'setting | viewpoint | missing_material', '设定冲突、视角冲突或缺失材料。', 'setting'), f('message', 'string', '具体问题和需要作者说明的内容。', '人物卡禁止此行为，请说明触发原因。'),
  f('evidence', 'array', '来自本轮原文的证据；设定/视角问题不能为空。', '[]'), ...nested('evidence[]', [path, f('quote', 'string', '对应文件中的精确引文。', '不说谎')])];
const result = [f('id', 'string', '创作记录 ID，与候选 origin.requestId 对应。', 'request-id'), f('sessionId', 'string', '所属聊天 ID。', 'session-id'), f('createdAt', 'string', '开始时间。', '2026-11-18T00:00:00.000Z'),
  f('outcome', 'running | completed | aborted | failed', '本轮模型运行结果；completed 不等于已创建或采纳候选。中断记录查询为 aborted。', 'completed'),
  f('context', 'object', '固定资料及约束。', '{}'), ...nested('context', context), f('review', 'object | null', '模型审校记录；未审校为 null。不是全书语义保证。', 'null'),
  f('review.status', 'clear | needs_input', '无问题或需要用户澄清。', 'clear', false), f('review.issues', 'array', '问题及原文证据。', '[]', false), ...nested('review.issues[]', issue.map(v => ({ ...v, required: false }))),
  f('proposals', 'array', '本轮已经保存的 P2 完整候选；状态反映后续逐处采纳/拒绝。字段见候选接口。', '[]')];
const contextExample = { workspaceId: 'workspace-id', task: 'discuss', instructions: '讨论人物', sources: [], maxOutputChars: 8000, inputChars: 4, inputLimit: 60000 };
const examples = [
  { name: '检查第四章世界观', body: { task: 'discuss', chapterNumber: 4, instructions: '核对主角已知的境界。' } },
  { name: '根据已留档大纲写章节', body: { task: 'chapter', instructions: '依据大纲和人物卡写第一章，不自行更改大纲。', target: { path: '章节/第一章.md', baseVersion: null }, outline: { path: '大纲/第一章.md', version: 'a'.repeat(64) }, references: [], maxOutputChars: 4000 } },
  { name: '丰富用户大纲', body: { task: 'enrich_outline', instructions: '请补充事件间的衔接，保留原定结局。', target: { path: '大纲/第一章.md', baseVersion: 'a'.repeat(64) } } },
  { name: '尾部续写', body: { task: 'continue', instructions: '续写下一小段对白。', target: { path: '章节/第一章.md', baseVersion: 'a'.repeat(64) } } },
  { name: '精确选区改写', body: { task: 'rewrite', instructions: '减少解释，通过动作表现情绪。', target: { path: '章节/第一章.md', baseVersion: 'a'.repeat(64), selection: { start: 0, end: 3, text: '旧句。' } } } },
  { name: '讨论并读取历史', body: { task: 'discuss', instructions: '请实际读取第三章，找到码头告别原文后讨论呼应。' } },
];
/** 全部创作接口及结果语义集中登记；沿用通用 SSE 与 P2 候选，不定义另一套前端协议。 */
export const WRITING_CATALOG: EndpointDoc[] = [
  { id: 'writing.outline', module: 'writing', name: '用户大纲原文留档', method: 'POST', path: '/api/workspaces/:workspaceId/outlines', success: 200,
    description: '将用户提供的大纲原样保存为正式 Markdown，不调用模型或要求采纳。', note: '已有大纲须使用读回版本；冲突 409。AI 丰富大纲应走创作候选，不能调用此接口绕过采纳。',
    request: [f('workspaceId', 'string', '目标小说 ID。', 'workspace-id'), path, target[1], f('content', 'string', '用户原文，最多 500000 字符，保留换行与 BOM。', '# 第一章\n码头告别。')],
    response: [path, version, f('content', 'string', '实际保存的原文。', '# 第一章\n码头告别。')], examples: [{ name: '留档用户大纲', body: { path: '大纲/第一章.md', content: '# 第一章\n码头告别。', baseVersion: null } }], responseExample: { path: '大纲/第一章.md', content: '# 第一章\n码头告别。', version: 'a'.repeat(64) } },
  { id: 'writing.context', module: 'writing', name: '预览创作上下文', method: 'POST', path: '/api/sessions/:id/writing/context', success: 200,
    description: '校验小说归属、目标、选区及引用版本，返回实际资料快照，不发模型请求。', note: '预览不锁定磁盘；发送时重新校验。项目聊天 422、缺目标/选区 400、过期版本 409、资料超限 422。', request, response: context, examples, responseExample: contextExample },
  { id: 'writing.send', module: 'writing', name: '开始内容创作', method: 'POST', path: '/api/sessions/:id/writing/messages', success: 200, stream: true,
    description: '依据固定上下文完成章节、续写、改写、大纲丰富或冲突讨论，实时返回工具与模型事件。与通用发送消息接口一致，后端按本机时区在本轮模型输入末尾提供当前日期，公开用户正文保持原样。', note: '复用全部 10 类 SSE 事件；completed 仅表示本轮结束，候选及审校另查创作结果。有冲突应提问，未采纳不改正式稿。停止用原会话 stop，断流不停止；无凭据 422、忙时 409。',
    request, response: [f('sessionId', 'string', '每个 SSE 事件所属会话。', 'session-id')], examples, responseExample: { event: 'completed', data: { sessionId: 'session-id' } } },
  { id: 'writing.results', module: 'writing', name: '查询创作来源与候选', method: 'GET', path: '/api/sessions/:id/writing', success: 200,
    description: '查询本聊天创作及小说讨论记录、资料版本、审校问题和候选，最近记录在前。', note: '重启保留；未完成运行显示 aborted，不自动续跑。项目聊天 422、未知会话 404。停止后已完成候选仍可查询，正文保持未采纳状态。',
    request: [request[0]], response: [f('requests', 'array', '创作与小说讨论记录。', '[]'), ...nested('requests[]', result)], examples: [], responseExample: { requests: [] } },
];
