import type { EndpointDoc, FieldDoc } from './catalog.ts';

const f = (name: string, type: string, required: boolean, description: string, example: string): FieldDoc => ({ name, type, required, description, example });
const card = [f('path', 'string', true, '角色卡阶段 Markdown 路径。', '角色卡/林舟/000004-stage.md'),
  f('character', 'string', true, '角色名称。', '林舟'), f('chapter', 'number', true, '阶段从哪一章开始适用。', '4'),
  f('note', 'string', true, '作者备注或 Agent 提取的变化关键词。', '黑化'), f('content', 'string', true, '五栏角色卡 Markdown 原文。', '# 林舟'),
  f('evidence', 'object', false, '角色变化对应的正文证据。初始角色卡没有此字段。', '{}'),
  f('evidence.path', 'string', false, '证据所在的本书章节路径。', '正文章节/第四章.md'),
  f('evidence.quote', 'string', false, '逐字摘录的角色变化依据。', '他把旧信折好，收进火盆。'),
  f('createdAt', 'string', true, '阶段初次保存时间，外部文稿为首次观察时间。', '2026-11-22T00:00:00.000Z'),
  f('version', 'string | null', true, '当前 Markdown 内容版本。', 'a'.repeat(64))];

export const CHARACTER_CARD_CATALOG: EndpointDoc[] = [
  { id: 'character-cards.list', module: 'character-cards', name: '查询角色卡阶段', method: 'GET', path: '/api/workspaces/:workspaceId/character-cards', success: 200,
    description: '列出角色卡全部历史阶段，并返回指定章节可用的每个角色最新阶段。', note: 'chapter 省略时返回全部角色的最新阶段；章节号之前的阶段按章节号排序。',
    request: [f('workspaceId', 'string', true, '工作区 ID。', 'workspace-id'), f('chapter', 'number', false, '目标章节号。', '4'), f('character', 'string', false, '只查询指定角色。', '林舟')],
    response: [f('cards', 'array', true, '筛选后的全部历史阶段。', '[]'), ...card.map(item => ({ ...item, name: `cards[].${item.name}` })), f('applicable', 'array', true, '目标章节每个角色实际适用的最新阶段。', '[]'), ...card.map(item => ({ ...item, name: `applicable[].${item.name}` }))],
    examples: [], responseExample: { cards: [], applicable: [] } },
  { id: 'character-cards.create', module: 'character-cards', name: '创建角色卡阶段', method: 'POST', path: '/api/workspaces/:workspaceId/character-cards', success: 201,
    description: '保存一份新的五栏角色卡阶段，章节号和备注由作者或 Agent 提供。', note: '提交 evidence 时先保存同章正文，quote 须唯一定位一个自然段。路径、章号或引文不符返回 400 INVALID_REQUEST。成功新增阶段并返回版本。',
    request: [f('workspaceId', 'string', true, '工作区 ID。', 'workspace-id'), f('character', 'string', true, '角色名称。', '林舟'), f('chapter', 'number', true, '阶段开始适用的章节号。', '4'), f('note', 'string', false, '阶段变化备注。', '黑化'), f('content', 'string', true, '包含细化五栏的角色卡 Markdown。', '## 性格特点\n### 表征\n自大。\n### 内在\n谨慎。'), f('evidence', 'object', false, '角色变化的正文依据，初始建卡可省略。', '{}'), f('evidence.path', 'string', false, '证据章节路径。', '正文章节/第四章.md'), f('evidence.quote', 'string', false, '证据原文。', '他把旧信折好，收进火盆。')],
    examples: [{ name: '保存第四章角色变化', body: { character: '林舟', chapter: 4, note: '黑化', evidence: { path: '正文章节/第四章.md', quote: '他把旧信折好，收进火盆。' }, content: '## 性格特点\n### 表征\n自大。\n### 内在\n谨慎。\n\n## 愿景\n### 明示\n安全。\n### 潜意识\n保护妹妹。\n\n## 社会背景\n\n## 外表特点\n\n## 特殊性\n### 心理特质\n警觉。\n### 口癖\n“您——”。\n### 禁忌\n不伤害弱者。' } }], response: card, responseExample: { path: '角色卡/林舟/000004-stage.md', character: '林舟', chapter: 4, note: '黑化', content: '# 林舟', createdAt: '2026-11-22T00:00:00.000Z', version: 'a'.repeat(64) } },
  { id: 'character-cards.read', module: 'character-cards', name: '读取角色卡阶段', method: 'POST', path: '/api/workspaces/:workspaceId/character-cards/read', success: 200,
    description: '按路径读取指定角色卡阶段及其版本。', note: '路径不存在或不是带阶段标记的角色卡返回 404。', request: [f('workspaceId', 'string', true, '工作区 ID。', 'workspace-id'), f('path', 'string', true, '角色卡 Markdown 路径。', '角色卡/林舟/000004-stage.md')], response: card, examples: [{ name: '读取阶段', body: { path: '角色卡/林舟/000004-stage.md' } }], responseExample: { path: '角色卡/林舟/000004-stage.md', character: '林舟', chapter: 4, note: '黑化', content: '# 林舟', createdAt: '2026-11-22T00:00:00.000Z', version: 'a'.repeat(64) } },
];
