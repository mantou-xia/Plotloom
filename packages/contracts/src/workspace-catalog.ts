import type { EndpointDoc, FieldDoc } from './catalog.ts';

const f = (name: string, type: string, description: string, example: string, required = true): FieldDoc => ({ name, type, description, example, required });
const workspaceId = f('workspaceId', 'string', '路径参数：登记工作区后返回的 ID。', 'workspace-id');
const path = f('path', 'string', '工作区内 .md 相对路径，使用 /，大小写与磁盘一致；不允许链接和越界。', '章节/0001.md');
const version = f('version', 'string | null', 'UTF-8 内容 SHA-256；null 代表文件不存在。', 'a'.repeat(64));
const baseVersion = { ...version, name: 'baseVersion', description: '预期磁盘版本。新建传 null；旧版本冲突返回 409，不覆盖当前文件。' };
const content = f('content', 'string', '原始 UTF-8 Markdown，保留换行和 BOM，最多 500000 个 Unicode 字符，同时受 HTTP 请求体大小限制。', '# 第一章\n灯塔亮了。');
const workspace = [f('id', 'string', '工作区唯一标识。', 'workspace-id'), f('title', 'string', '小说名称。', '灯塔'), f('root', 'string', '用户登记的本机绝对目录。', 'D:/Novels/灯塔'), f('createdAt', 'string', '登记时间，ISO 8601。', '2026-11-18T00:00:00.000Z')];
const document = [path, content, version];
const revision = [f('id', 'string', '历史记录 ID，恢复同样内容仍产生新记录。', 'revision-id'), path, version,
  f('source', 'observed | manual | accepted | restored', '观察到的外部内容、手工保存、采纳或恢复。', 'manual'),
  f('createdAt', 'string', '记录时间，非外部编辑器保存时间。', '2026-11-18T00:00:00.000Z'), f('restoredFrom', 'string', '恢复来源历史 ID，仅恢复时返回。', 'revision-id', false)];
const change = [f('id', 'string', '该处差异 ID，用于独立采纳/拒绝和幂等。', 'change-id'),
  f('start', 'number', '基础原稿的 UTF-16 起始位置（含）。', '0'), f('end', 'number', '基础原稿的 UTF-16 结束位置（不含）。', '3'),
  f('before', 'string', '该范围原文。', '旧稿'), f('after', 'string', '替换内容。', '新稿'), f('status', 'pending | accepted | rejected', '该处独立状态。', 'pending'),
  f('revisionId', 'string', '采纳形成的历史记录 ID；重复采纳不新增。', 'revision-id', false)];
const nested = (prefix: string, fields: FieldDoc[]) => fields.map((field) => ({ ...field, name: `${prefix}.${field.name}` }));
const ref = [path, { ...version, type: 'string', description: '实际引用时的资料版本，不允许 null。' }];
const proposal = [f('id', 'string', '候选 ID。', 'proposal-id'), path, baseVersion, f('baseContent', 'string', '生成时基础原稿；候选与正式稿分离。', '旧稿'), content,
  f('status', 'pending | partial | accepted | rejected | resolved', '未处理、部分处理、全采纳、全拒绝或混合处理完毕。', 'pending'),
  f('createdAt', 'string', '候选创建时间。', '2026-11-18T00:00:00.000Z'),
  f('changes', 'array', '按原文顺序排列的独立差异；前端无需重新计算位置。', '[]'), ...nested('changes[]', change),
  f('references', 'array', '实际参考资料，采纳前检查是否变化。', '[]'), ...nested('references[]', ref)];
const wsExample = { id: 'workspace-id', title: '灯塔', root: 'D:/Novels/灯塔', createdAt: '2026-11-18T00:00:00.000Z' };
const docExample = { path: '章节/0001.md', content: '# 第一章\n灯塔亮了。', version: 'a'.repeat(64) };
const proposalExample = { id: 'proposal-id', path: '章节/0001.md', baseVersion: null, baseContent: '', content: docExample.content, status: 'pending', createdAt: wsExample.createdAt,
  references: [], changes: [{ id: 'change-id', start: 0, end: 0, before: '', after: docExample.content, status: 'pending' }] };
type Options = Omit<EndpointDoc, 'path' | 'request' | 'examples'> & { path: string; request?: FieldDoc[]; body?: Record<string, unknown> };
const endpoint = ({ body, request = [], ...rest }: Options): EndpointDoc => ({ ...rest,
  request: [...(rest.path.includes(':workspaceId') ? [workspaceId] : []), ...request], examples: body ? [{ name: '参数示例', body }] : [] });

/** 每条资产路由有用途、输入、输出和错误说明；只包含公开协议，不导入文件实现。 */
export const WORKSPACE_CATALOG: EndpointDoc[] = [
  endpoint({ id: 'workspaces.list', module: 'workspaces', name: '列出小说工作区', method: 'GET', path: '/api/workspaces', success: 200,
    description: '列出已登记的本机小说目录。', note: '不扫描未登记目录；不需要模型凭据。',
    response: [f('workspaces', 'array', '已登记工作区。', '[]'), ...nested('workspaces[]', workspace)], responseExample: { workspaces: [wsExample] } }),
  endpoint({ id: 'workspaces.create', module: 'workspaces', name: '打开并登记工作区', method: 'POST', path: '/api/workspaces', success: 201,
    description: '为已存在的小说文件夹建立归属，不修改其中的正文。', note: '目录必须已存在；重复或嵌套登记返回 WORKSPACE_OVERLAP。',
    request: [workspace[1], workspace[2]], body: { title: '灯塔', root: 'D:/Novels/灯塔' }, response: workspace, responseExample: wsExample }),
  endpoint({ id: 'workspaces.get', module: 'workspaces', name: '读取工作区', method: 'GET', path: '/api/workspaces/:workspaceId', success: 200,
    description: '读取小说登记信息，并核对上次未决提交。', note: '不存在返回 404；未决且磁盘发生变化返回 COMMIT_UNCERTAIN，请查询恢复信息。', response: workspace, responseExample: wsExample }),
  endpoint({ id: 'documents.list', module: 'documents', name: '列出 Markdown 文档', method: 'GET', path: '/api/workspaces/:workspaceId/documents', success: 200,
    description: '递归列出实际 .md 文件，不固定角色、章节或大纲目录名。', note: '忽略链接、.git、node_modules 和 .plotloom 管理目录；工作区失效返回 409。',
    response: [f('paths', 'array', '排序后的相对路径。', '["章节/0001.md"]')], responseExample: { paths: [docExample.path] } }),
  endpoint({ id: 'documents.read', module: 'documents', name: '读取当前 Markdown', method: 'POST', path: '/api/workspaces/:workspaceId/document/read', success: 200,
    description: '重新读取磁盘原文和版本，记录实际观察到的历史。', note: '不存在返回 version:null、content:""；非法路径 400，非 UTF-8 422。', request: [path], body: { path: docExample.path }, response: document, responseExample: docExample }),
  endpoint({ id: 'documents.save', module: 'documents', name: '手工保存 Markdown', method: 'PUT', path: '/api/workspaces/:workspaceId/document', success: 200,
    description: '按基础版本新建或保存正式文件，保存前保护外部改稿。', note: '版本冲突/写占用返回 409；无变化不重复版本。当前提交支持 Windows。AI 必须通过候选入口。',
    request: [path, baseVersion, content], body: { path: docExample.path, baseVersion: null, content: docExample.content }, response: document, responseExample: docExample }),
  endpoint({ id: 'documents.history', module: 'documents', name: '查询历史版本', method: 'POST', path: '/api/workspaces/:workspaceId/history', success: 200,
    description: '先观察当前磁盘，再返回该路径已记录历史。', note: '只包含应用实际观察或提交的版本；不声称记录外部每次保存。读取历史内容使用导出接口的 revisionId。',
    request: [path], body: { path: docExample.path }, response: [f('revisions', 'array', '按观察/提交顺序排列的版本。', '[]'), ...nested('revisions[]', revision)], responseExample: { revisions: [] } }),
  endpoint({ id: 'documents.restore', module: 'documents', name: '恢复历史 Markdown', method: 'POST', path: '/api/workspaces/:workspaceId/restore', success: 200,
    description: '复制历史内容形成新版本，保留恢复前稿。', note: '需当前磁盘版本；过期 409，其他工作区的版本 404；不恢复不存在的文件记录。',
    request: [path, f('revisionId', 'string', '本文件历史记录 ID。', 'revision-id'), baseVersion], body: { path: docExample.path, revisionId: 'revision-id', baseVersion: docExample.version }, response: document, responseExample: docExample }),
  endpoint({ id: 'proposals.list', module: 'proposals', name: '列出修改候选', method: 'GET', path: '/api/workspaces/:workspaceId/proposals', success: 200,
    description: '查看工作区所有已保存候选及每处处理状态。', note: '未采纳候选不成为正式文件；重启后仍保留。', response: [f('proposals', 'array', '候选列表。', '[]'), ...nested('proposals[]', proposal)], responseExample: { proposals: [proposalExample] } }),
  endpoint({ id: 'proposals.create', module: 'proposals', name: '创建修改候选', method: 'POST', path: '/api/workspaces/:workspaceId/proposals', success: 201,
    description: '后端计算真实差异，保存独立候选；可仅修改选区。', note: 'selection 存在时 content 只替换选区；范围外原文不变。基础/参考版本过期 409；无修改或错误选区 400；超时 422。',
    request: [path, baseVersion, content, f('selection', 'object', '可选 UTF-16 原文选区。', '{"start":0,"end":2,"text":"旧稿"}', false),
      f('selection.start', 'number', '起始偏移（含），不切开 emoji。', '0', false), f('selection.end', 'number', '结束偏移（不含）。', '2', false), f('selection.text', 'string', '该范围原文，需精确相同。', '旧稿', false),
      f('references', 'array', '实际参考资料的 path/version；不能含目标文件。', '[]', false), ...nested('references[]', ref).map((v) => ({ ...v, required: false }))],
    body: { path: '章节/新章节.md', baseVersion: null, content: docExample.content, references: [] }, response: proposal, responseExample: proposalExample }),
  endpoint({ id: 'proposals.get', module: 'proposals', name: '读取候选详情', method: 'GET', path: '/api/workspaces/:workspaceId/proposals/:proposalId', success: 200,
    description: '查看基础稿、候选稿和逐处差异。', note: '跨工作区或未知候选返回 404。', request: [f('proposalId', 'string', '路径参数：候选 ID。', 'proposal-id')], response: proposal, responseExample: proposalExample }),
  endpoint({ id: 'proposals.decide', module: 'proposals', name: '采纳或拒绝一处修改', method: 'POST', path: '/api/workspaces/:workspaceId/proposals/:proposalId/changes/:changeId', success: 200,
    description: '只处理指定差异，已采纳的其他内容保留。', note: '相同决定幂等；相反决定 CHANGE_RESOLVED；外部改稿 REVISION_CONFLICT；资料变化 REFERENCE_CONFLICT；拒绝不写原稿。',
    request: [f('proposalId', 'string', '路径参数：候选 ID。', 'proposal-id'), f('changeId', 'string', '路径参数：独立差异 ID。', 'change-id'), f('action', 'accept | reject', '本次明确决定。', 'accept')],
    body: { action: 'accept' }, response: proposal, responseExample: proposalExample }),
  endpoint({ id: 'documents.search', module: 'documents', name: '查找指定原文', method: 'POST', path: '/api/workspaces/:workspaceId/search', success: 200,
    description: '按原文子串查找历史情节，返回路径、版本与 UTF-16 位置。', note: '非语义检索；无结果返回空列表。至多 100 处命中；可指定章节路径缩小范围。',
    request: [f('query', 'string', '非空原文子串。', '灯塔'), f('paths', 'array', '可选文档路径列表，不传则搜索全部正式 .md。', '["章节/0001.md"]', false)], body: { query: '灯塔' },
    response: [f('matches', 'array', '实际原文命中。', '[]'), ...nested('matches[]', [path, { ...version, type: 'string' }, f('start', 'number', '命中起始位置（含）。', '6'), f('end', 'number', '命中结束位置（不含）。', '8'), f('text', 'string', '命中所在原文行供核对。', '灯塔亮了。')]), f('limit', 'number', '最大返回条数。', '100')], responseExample: { matches: [], limit: 100 } }),
  endpoint({ id: 'documents.export', module: 'documents', name: '导出原始 Markdown', method: 'POST', path: '/api/workspaces/:workspaceId/export', success: 200,
    description: '取回指定文件当前内容或已记录历史，保持原始 Markdown。', note: '不改磁盘、不转义语法；未知历史返回 404。每个文件独立标明实际版本。',
    request: [f('files', 'array', '按请求顺序导出的文件，1–100 项。', '[{"path":"章节/0001.md"}]'), ...nested('files[]', [path, f('revisionId', 'string', '可选历史记录 ID，不传取当前磁盘。', 'revision-id', false)])], body: { files: [{ path: docExample.path }] },
    response: [f('files', 'array', '逐文件原稿，可分别保存为 UTF-8 .md。', '[]'), ...nested('files[]', document)], responseExample: { files: [docExample] } }),
  endpoint({ id: 'workspaces.backup', module: 'workspaces', name: '备份 Markdown 与历史', method: 'POST', path: '/api/workspaces/:workspaceId/backup', success: 200,
    description: '写入新的备份目录，包含正式 Markdown、版本快照、候选和恢复说明。', note: '目标父目录需存在，目标目录不能已存在或与作品/内部数据重叠。不包含聊天、模型配置或凭据；备份期间请暂停外部编辑。失败保留不完整目录，使用新目录重试。',
    request: [f('destination', 'string', '本机新备份目录绝对路径。', 'D:/Backups/灯塔-20261118')], body: { destination: 'D:/Backups/灯塔-20261118' },
    response: [f('destination', 'string', '实际备份目录。', 'D:/Backups/灯塔-20261118'), f('files', 'number', '成功备份正式 Markdown 文件数。', '3')], responseExample: { destination: 'D:/Backups/灯塔-20261118', files: 3 } }),
  endpoint({ id: 'workspaces.recovery', module: 'workspaces', name: '查看未决文件提交', method: 'GET', path: '/api/workspaces/:workspaceId/recovery', success: 200,
    description: '查看中断提交及当前磁盘，用于核对未决状态。', note: 'pending:null 表示没有未决提交；有记录时请比较 current 和 intendedContent，不能把未确认提交当作已采纳。',
    response: [f('pending', 'object | null', '待确认的提交意图，无待处理时 null。', 'null'), ...nested('pending', [path, f('beforeVersion', 'string | null', '写入前预期版本。', 'null'), f('afterVersion', 'string', '预期目标版本。', 'a'.repeat(64)), f('revision', 'object', '预先保存的目标历史元数据。', '{}'), ...nested('revision', revision), f('proposalId', 'string', '关联候选 ID（采纳时）。', 'proposal-id', false), f('changeId', 'string', '关联差异 ID（采纳时）。', 'change-id', false)]).map((v) => ({ ...v, required: false })),
      f('current', 'object', '未决目标当前磁盘内容。', '{}', false), ...nested('current', document).map((v) => ({ ...v, required: false })), f('intendedContent', 'string', '提交前已保存的目标快照，供人工核对。', '新稿', false)], responseExample: { pending: null } }),
  endpoint({ id: 'workspaces.keep-current', module: 'workspaces', name: '保留现稿并结束未决提交', method: 'POST', path: '/api/workspaces/:workspaceId/recovery', success: 200,
    description: '用户核对后明确保留当前磁盘，记录观察版本并清除未决标记。', note: '不写正式稿，不自动采纳候选。version 必须等于刚查看的 current.version，期间变化返回 409。无未决记录时幂等。',
    request: [version], body: { version: docExample.version }, response: [f('pending', 'null', '未决标记已清除。', 'null')], responseExample: { pending: null } }),
];
