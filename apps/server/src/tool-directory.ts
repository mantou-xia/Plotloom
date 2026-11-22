import { PROJECT_TOOLS, BROWSER_TOOL, WEB_FETCH_TOOL, ASK_USER_TOOL, SETUP_AGENT_PROFILE, type AgentOptions } from '@plotloom/agent-pi';
import { WRITING_TOOLS } from '@plotloom/application/writing';
import type { ToolInfo, ToolScope } from '@plotloom/contracts/skills';

const descriptions: Record<string, [string, string]> = {
  write_chapter_part: ['按段号暂存本轮章节草稿，同号重写。', 'part、content；单段最多 1500 个 UTF-16 字符'],
  deliver_chapter: ['拼接已暂存的草稿，审校后交给作者确认。新章保存，重写生成候选。', 'partCount、reason'],
  import_chapters: ['从本轮 UTF-8 TXT/Markdown 附件导入旧章节，作者确认后写入。', '空对象；附件从本轮消息读取'],
  manuscript_workspace: ['操作小说正文和大纲，每次等待作者确认。', 'action；按操作填写 path、content 或 revisionId'],
  propose_world_rule: ['提交需作者确认的世界观设定，区分生效和揭示章节。', 'subject、fact、effective、revealed；章节变化另需 evidence'],
  propose_character_change: ['提交交稿后的角色卡变化建议，展示原卡、情节证据和新阶段，作者确认后才保存。', 'character、chapter、note、content、evidence'],
  read: ['读取项目内 UTF-8 文本。', 'path；可选 offset、limit'],
  ls: ['列出目录中的直接文件和子目录。', '可选 path、limit；默认从项目根目录列出'],
  find: ['按文件名模式查找项目文件。', 'pattern；可选 path、limit'],
  grep: ['按字面文本搜索项目文件内容并返回匹配位置。', 'pattern；可选 path、glob、ignoreCase、limit'],
  write: ['申请创建或覆盖项目内文本文件；父目录须已存在。', 'path、content'],
  edit: ['申请精确替换文件中的一处文本，原文须恰好匹配一次。', 'path、oldText、newText'],
  browser: ['操作聊天独立浏览器：访问和搜索网页、读取快照、点击、填写、滚动及切换标签页。', 'action；按操作提供 url、ref、selector、text、key、deltaY、tab'],
  web_fetch: ['直接抓取静态网页正文或纯文本，返回最终地址、标题和截断标志。', 'url：完整 HTTP(S) 地址'],
  ask_user: ['展示一道选择题，等待用户选择、自填或跳过。', 'question、options（2 至 5 项）'],
  setup_agent_profile: ['展示全局人设或跳过引导的确认卡，用户确认后才写入。', 'action；save 还需 name、style、preferences'],
  read_skill: ['按需读取本轮已加载技能的说明和参考资源。', 'skillId、path'],
  list_documents: ['列出当前小说工作区中的正式文档。', '空对象，无需参数'],
  read_document: ['读取小说文档内容和版本。', 'path'],
  search_documents: ['在小说文档中查找关键词与原文位置。', 'query；可选 paths'],
  review_writing: ['审校已读取资料的设定、视角及资料问题。', 'status：clear 或 needs_input；issues：含 kind、message、evidence 的问题列表'],
  propose_change: ['提出小说修改候选供用户采纳，不直接覆盖正式稿。', 'path、content、reason'],
  save_character_card: ['保存作者确认的细化五栏角色卡阶段，按章节号和备注形成历史版本。', 'character、chapter、note、content'],
};

/** 标记实际提供能力的模块，项目文件工具由 Plotloom 实现并交给 Pi 注册。 */
function toolProvider(name: string, injected: boolean): string {
  if (injected) return '服务启动配置';
  if (PROJECT_TOOLS.includes(name)) return 'Plotloom 项目文件工具';
  if (WRITING_TOOLS.includes(name)) return 'Plotloom 小说工作区';
  if (name === BROWSER_TOOL) return 'Plotloom 浏览器（Playwright）';
  if (name === WEB_FETCH_TOOL) return 'Plotloom 网页抓取';
  if (name === ASK_USER_TOOL) return 'Plotloom 聊天交互';
  if (name === SETUP_AGENT_PROFILE) return 'Plotloom Agent 人设';
  if (name === 'read_skill') return 'Plotloom 技能系统';
  return 'Plotloom';
}

/** 诊断和目录共用同一聊天工具集合；read_skill 表示具备按需加载能力，不保证当前已有技能。 */
export function toolDirectory(options: AgentOptions) {
  const names = (scope: ToolScope) => [...new Set([
    ...(scope === 'project' ? PROJECT_TOOLS
      : options.tools?.map(tool => tool.name) ?? []),
    BROWSER_TOOL, WEB_FETCH_TOOL, ASK_USER_TOOL, 'read_skill', ...(scope === 'novel' ? WRITING_TOOLS : []),
  ])];
  const scopes: ToolScope[] = ['project', 'novel'];
  const all = [...new Set(scopes.flatMap(names))];
  // 首用工具属于内置交互，不作为技能可依赖的常驻工具。
  const tools: ToolInfo[] = [...all, SETUP_AGENT_PROFILE].map(name => {
    const custom = options.tools?.find(tool => tool.name === name);
    const [description, parameters] = custom ? [custom.description, JSON.stringify(custom.parameters)] : descriptions[name];
    return { name, provider: toolProvider(name, custom !== undefined), description, parameters,
      availableIn: name === SETUP_AGENT_PROFILE ? scopes : scopes.filter(scope => names(scope).includes(name)),
      condition: name === 'read_skill' ? '本轮有满足条件且已启用的技能时注册；只能读取该轮快照。'
        : name === SETUP_AGENT_PROFILE ? '全局引导待完成的聊天轮次可用；写入前需用户确认。'
        : name === 'browser' ? '需本机浏览器可用；搜索通过浏览器页面操作，未接独立搜索 API。'
        : name === 'web_fetch' ? '不执行脚本、不使用登录态；20 秒超时、2 MiB 响应上限、正文最多 30000 字符。'
        : name === 'write' || name === 'edit' ? '仅项目内文本；按会话审批模式决定是否逐次请求批准。'
        : PROJECT_TOOLS.includes(name) ? '仅可访问已选项目内受支持的文件。'
        : name === 'import_chapters' ? '仅小说聊天且本轮带文本附件时可用。'
        : ['write_chapter_part', 'deliver_chapter'].includes(name) ? '仅小说聊天明确发起整章写作时可用，最终交稿须作者确认。'
        : WRITING_TOOLS.includes(name) ? '仅小说聊天装配对应业务资源后可用。' : '由当前聊天工具配置决定。' };
  });
  return { tools, names, all };
}
