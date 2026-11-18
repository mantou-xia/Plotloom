import type { EndpointDoc, FieldDoc } from './catalog.ts';
const f = (name: string, type: string, description: string, example: string, required = true): FieldDoc => ({ name, type, description, example, required });
const nested = (prefix: string, fields: FieldDoc[]) => fields.map(v => ({ ...v, name: `${prefix}.${v.name}` }));
const skillId = f('skillId', 'string', '路径参数：技能列表或创建响应的 ID。', 'skill-id');
const workspaceId = f('workspaceId', 'string', '路径参数：小说工作区 ID。', 'workspace-id');
const sessionId = f('id', 'string', '路径参数：当前测试会话 ID。', 'session-id');
const content = f('content', 'string', 'UTF-8 技能文本；SKILL.md 必须含 YAML name/description，编辑资源不执行代码。', '---\nname: dialogue-polish\ndescription: 打磨对白\n---\n让不同人物的措辞有区别。');
const version = f('version', 'string', '整个技能目录内容的 SHA-256 版本。', 'a'.repeat(64));
const skillIds = f('skillIds', 'array', '完整启用列表，空数组关闭全部；只接受已安装技能 ID，最多 50 项。', '["skill-id"]');
const path = f('path', 'string', '技能内的相对文件路径，不能越界；保留 references/assets。', 'SKILL.md');
const skill = [f('id', 'string', '技能稳定 ID。', 'skill-id'), f('name', 'string', '小写英文、数字和连字符组成的唯一技能名称。', 'dialogue-polish'),
  f('description', 'string', '用途与触发场景。', '打磨对白'), version, f('source', 'builtin | custom | imported', '内置、自定义或导入副本。', 'custom'),
  f('origin', 'string', '来源说明或本机导入目录；导入后不依赖原目录。', '用户创建'), f('updatedAt', 'string', '最近发布版本时间。', '2026-11-18T00:00:00.000Z'),
  f('compatibility', 'string', '声明的环境要求，仅展示、不自动安装环境。', ''), f('declaredTools', 'array', 'allowed-tools 声明，不能授予工具权限。', '[]'),
  f('files', 'array', '全部资源相对路径，包含保留的二进制及脚本。', '["SKILL.md"]'), f('missingTools', 'array', '当前应用缺少的声明工具。', '[]'),
  f('warnings', 'array', '缺失工具、环境待核对、脚本不执行等说明。', '[]'), f('runnable', 'boolean', '是否满足已声明工具；不代表环境或技能效果已验证。', 'true')];
const skillExample = { id: 'skill-id', name: 'dialogue-polish', description: '打磨对白', version: 'a'.repeat(64), source: 'custom', origin: '用户创建', updatedAt: '2026-11-18T00:00:00.000Z', compatibility: '', declaredTools: [], files: ['SKILL.md'], missingTools: [], warnings: [], runnable: true };
const activation = [f('workspaceId', 'string | null', '聊天固定的小说归属，普通聊天为 null。', 'workspace-id'), f('skillIds', 'array | null', 'null 跟随工作区，数组完整覆盖；空数组关闭。', 'null'),
  f('mode', 'inherit | override', '当前是跟随还是聊天覆盖。', 'inherit'), f('effectiveSkillIds', 'array', '解析后的配置 ID，可能包含缺失依赖或已删除技能。', '[]'),
  f('skills', 'array', '尚在库中的已配置技能及诊断。', '[]'), ...nested('skills[]', skill), f('unavailable', 'array', '当前不能加载的条目。', '[]'),
  f('unavailable[].id', 'string', '不可用的技能 ID。', 'skill-id'), f('unavailable[].reason', 'string', '缺失工具或已移除原因。', '技能已移除')];
const activationExample = { workspaceId: null, skillIds: null, mode: 'inherit', effectiveSkillIds: [], skills: [], unavailable: [] };
const chat = [f('id', 'string', 'SDK 会话 ID。', 'session-id'), f('workspaceId', 'string | null', '固定小说归属，普通会话为 null。', 'workspace-id'),
  f('name', 'string', '聊天名称。', '第一章讨论'), f('provider', 'string', '供应商。', 'provider'), f('model', 'string', '模型。', 'model'),
  f('thinkingLevel', 'string', '思考档位。', 'off'), f('status', 'idle | running', '当前状态。', 'idle'), f('activity', 'string', '当前生成/配置/压缩活动。', 'idle')];
const chatExample = { id: 'session-id', workspaceId: 'workspace-id', name: '第一章讨论', provider: 'provider', model: 'model', thinkingLevel: 'off', status: 'idle', activity: 'idle' };
const listChats = [f('sessions', 'array', '按最近更新时间倒序排列的聊天。', '[]'), ...nested('sessions[]', [...chat, f('updatedAt', 'string', 'SDK 会话文件更新时间。', '2026-11-18T00:00:00.000Z')])];
function endpoint(value: Omit<EndpointDoc, 'examples'> & { body?: Record<string, unknown> }): EndpointDoc {
  const { body, ...rest } = value; return { ...rest, examples: body ? [{ name: '参数示例', body }] : [] };
}
/** 每个管理/启用/聊天入口都有可编辑示例、字段和错误；页面只消费此公开目录。 */
export const SKILL_CATALOG: EndpointDoc[] = [
  endpoint({ id: 'skills.list', module: 'skills', name: '列出技能库', method: 'GET', path: '/api/skills', success: 200, description: '查看内置、自定义和导入技能及依赖诊断。', note: '无模型凭据也能管理；runnable 只校验声明工具，环境需人工核对。', request: [], response: [f('skills', 'array', '技能清单。', '[]'), ...nested('skills[]', skill)], responseExample: { skills: [skillExample] } }),
  endpoint({ id: 'skills.create', module: 'skills', name: '创建自定义技能', method: 'POST', path: '/api/skills', success: 201, description: '保存 SKILL.md 并校验名称和说明。', note: '坏格式 400；同名 SKILL_NAME_EXISTS；不会执行技能。', request: [content], body: { content: content.example }, response: skill, responseExample: skillExample }),
  endpoint({ id: 'skills.import', module: 'skills', name: '导入完整技能目录', method: 'POST', path: '/api/skills/import', success: 201, description: '复制已下载目录及 references/assets 到应用技能库。', note: '目录名须与 name 一致；拒绝链接；最多 500 文件/20 MiB；脚本保留但不执行，失败不发布到清单。', request: [f('root', 'string', '本机完整技能目录绝对路径。', 'D:/Skills/dialogue-polish')], body: { root: 'D:/Skills/dialogue-polish' }, response: skill, responseExample: { ...skillExample, source: 'imported' } }),
  endpoint({ id: 'skills.get', module: 'skills', name: '读取技能详情', method: 'GET', path: '/api/skills/:skillId', success: 200, description: '查询版本、资源路径、来源及依赖。', note: '不存在或已移除返回 SKILL_NOT_FOUND 404。', request: [skillId], response: skill, responseExample: skillExample }),
  endpoint({ id: 'skills.file', module: 'skills', name: '读取技能资源', method: 'POST', path: '/api/skills/:skillId/file', success: 200, description: '取回安装副本的文本或二进制资源。', note: '非 UTF-8 返回 base64；路径越界 400、未知文件 404；不执行文件。', request: [skillId, path], body: { path: 'SKILL.md' }, response: [path, f('content', 'string', 'UTF-8 原文或 base64 数据，由 encoding 区分。', content.example), f('encoding', 'utf8 | base64', '返回内容编码。', 'utf8'), version], responseExample: { path: 'SKILL.md', content: content.example, encoding: 'utf8', version: skillExample.version } }),
  endpoint({ id: 'skills.edit', module: 'skills', name: '编辑技能文本资源', method: 'PUT', path: '/api/skills/:skillId/file', success: 200, description: '新建或编辑副本中的文本资源，形成新版本。', note: '内置只读 409；过期版本 SKILL_VERSION_CONFLICT；编辑不改名，运行中请求仍用旧快照。', request: [skillId, path, content, { ...version, name: 'baseVersion', description: '刚读取的整个技能版本，防止覆盖其他编辑。' }], body: { path: 'references/dialogue.md', content: '通过身份与情绪区分人物措辞。', baseVersion: skillExample.version }, response: skill, responseExample: skillExample }),
  endpoint({ id: 'skills.copy', module: 'skills', name: '复制为自定义技能', method: 'POST', path: '/api/skills/:skillId/copy', success: 201, description: '复制全部资源并设置新名称，内置原件保持只读。', note: '非法名称 400、同名 409、未知源 404。', request: [skillId, f('name', 'string', '新的唯一技能名称。', 'my-dialogue-polish')], body: { name: 'my-dialogue-polish' }, response: skill, responseExample: skillExample }),
  endpoint({ id: 'skills.delete', module: 'skills', name: '移除技能', method: 'DELETE', path: '/api/skills/:skillId', success: 200, description: '移除自定义或导入副本，保留外部原目录。', note: '内置不可删除；工作区默认引用移除；聊天显式引用显示已移除，进行中请求保留旧快照。', request: [skillId], response: [f('deleted', 'boolean', '该安装副本已移除。', 'true')], responseExample: { deleted: true } }),
  endpoint({ id: 'skills.workspace-get', module: 'skill-settings', name: '查询小说默认技能', method: 'GET', path: '/api/workspaces/:workspaceId/skills', success: 200, description: '查询小说聊天继承的技能列表。', note: '未设置时含内置 novel-writing，在小说聊天可运行并自动加载；普通聊天缺少小说工具，不可运行该技能。未知工作区 404。', request: [workspaceId], response: [skillIds], responseExample: { skillIds: ['builtin-novel-writing'] } }),
  endpoint({ id: 'skills.workspace-set', module: 'skill-settings', name: '设置小说默认技能', method: 'PUT', path: '/api/workspaces/:workspaceId/skills', success: 200, description: '更新仍跟随工作区的聊天下一轮技能。', note: '完整替换列表；空数组关闭；未知技能 404，重复 400；不影响正在生成的请求。', request: [workspaceId, skillIds], body: { skillIds: [] }, response: [skillIds], responseExample: { skillIds: [] } }),
  endpoint({ id: 'skills.session-get', module: 'skill-settings', name: '查询聊天技能与诊断', method: 'GET', path: '/api/sessions/:id/skills', success: 200, description: '查看聊天归属、继承模式及下一轮可用技能。', note: '停用不清除旧聊天指令；实际资源访问以本轮启用清单为准。未知会话 404。', request: [sessionId], response: activation, responseExample: activationExample }),
  endpoint({ id: 'skills.session-set', module: 'skill-settings', name: '设置聊天技能或恢复跟随', method: 'PUT', path: '/api/sessions/:id/skills', success: 200, description: '聊天数组覆盖工作区；传 null 恢复跟随。', note: '允许生成中修改，只影响下一请求；普通聊天跟随时无默认技能。未知会话/技能 404。', request: [sessionId, { ...skillIds, type: 'array | null', description: 'null 恢复跟随，数组完整覆盖，空数组关闭。', example: 'null' }], body: { skillIds: null }, response: activation, responseExample: activationExample }),
  endpoint({ id: 'chats.list', module: 'chats', name: '查询最近聊天及归属', method: 'GET', path: '/api/chats', success: 200, description: '列出普通和小说聊天，保留各自小说归属。', note: '从 SDK 元信息查询，不复制完整消息。无凭据仍可查询。', request: [], response: listChats, responseExample: { sessions: [] } }),
  endpoint({ id: 'chats.workspace-list', module: 'chats', name: '查询小说聊天', method: 'GET', path: '/api/workspaces/:workspaceId/sessions', success: 200, description: '按固定小说归属筛选聊天并按最近更新时间排序。', note: '未知工作区 404；切换页面不会修改聊天归属。', request: [workspaceId], response: listChats, responseExample: { sessions: [] } }),
  endpoint({ id: 'chats.create', module: 'chats', name: '创建小说聊天', method: 'POST', path: '/api/workspaces/:workspaceId/sessions', success: 201, description: '创建 SDK 会话并固定小说归属，默认跟随小说技能。', note: '沿用默认模型；provider/model 必须成对；缺少凭据或模型返回 422。聊天消息和停止继续使用通用会话接口。', request: [workspaceId, f('name', 'string', '可选名称，默认 Plotloom。', '第一章讨论', false), f('provider', 'string', '可选供应商，须同时指定 model。', 'provider', false), f('model', 'string', '可选模型。', 'model', false), f('thinkingLevel', 'string', '可选思考档位，取模型能力。', 'off', false)], body: { name: '第一章讨论' }, response: chat, responseExample: chatExample }),
];
