import { PROJECT_TOOLS, BROWSER_TOOL, WEB_FETCH_TOOL, type AgentOptions } from '@plotloom/agent-pi';
import { WRITING_TOOLS } from '@plotloom/application/writing';
import type { ToolInfo, ToolScope } from '@plotloom/contracts/skills';

const descriptions: Record<string, [string, string]> = {
  read: ['读取本机文件内容，支持文本和图片。', 'path；可选 offset、limit'],
  ls: ['列出目录中的文件和子目录。', 'path；可选 limit'],
  find: ['按文件名模式查找项目文件。', 'pattern；可选 path、limit'],
  grep: ['搜索文件内容并返回匹配位置。', 'pattern；可选 path、glob、ignoreCase、limit'],
  write: ['创建或覆盖文件，必要时创建父目录。', 'path、content'],
  edit: ['精确替换文件中的指定文本。', 'path、oldText、newText'],
  powershell: ['在项目工作目录执行 PowerShell 命令。', 'command；可选 timeout'],
  bash: ['在项目工作目录执行 Bash 命令。', 'command；可选 timeout'],
  browser: ['操作聊天独立浏览器：访问和搜索网页、读取快照、点击、填写、滚动及切换标签页。', 'action；按操作提供 url、ref、selector、text、key、deltaY、tab'],
  web_fetch: ['直接抓取静态网页正文或纯文本，返回最终地址、标题和截断标志。', 'url：完整 HTTP(S) 地址'],
  read_skill: ['按需读取本轮已加载技能的说明和参考资源。', 'skillId、path'],
  read_fixture: ['读取内置 scene 测试资料；不是通用文件读取。', 'document：scene'],
  list_documents: ['列出当前小说工作区中的正式文档。', '空对象，无需参数'],
  read_document: ['读取小说文档内容和版本。', 'path'],
  search_documents: ['在小说文档中查找关键词与原文位置。', 'query；可选 paths'],
  review_writing: ['审校已读取资料的设定、视角及资料问题。', 'status：clear 或 needs_input；issues：含 kind、message、evidence 的问题列表'],
  propose_change: ['提出小说修改候选供用户采纳，不直接覆盖正式稿。', 'path、content、reason'],
};

/** 诊断和目录共用同一聊天工具集合；read_skill 表示具备按需加载能力，不保证当前已有技能。 */
export function toolDirectory(options: AgentOptions) {
  const names = (scope: ToolScope) => [...new Set([
    ...(scope === 'project' ? PROJECT_TOOLS : []),
    ...(options.tools?.map(tool => tool.name) ?? (scope === 'ordinary' ? ['read_fixture'] : [])),
    BROWSER_TOOL, WEB_FETCH_TOOL, 'read_skill', ...(scope === 'novel' ? WRITING_TOOLS : []),
  ])];
  const scopes: ToolScope[] = ['ordinary', 'project', 'novel'];
  const all = [...new Set(scopes.flatMap(names))];
  const tools: ToolInfo[] = all.map(name => {
    const custom = options.tools?.find(tool => tool.name === name);
    const [description, parameters] = custom ? [custom.description, JSON.stringify(custom.parameters)] : descriptions[name];
    return { name, description, parameters, availableIn: scopes.filter(scope => names(scope).includes(name)),
      condition: name === 'read_skill' ? '本轮有满足条件且已启用的技能时注册；只能读取该轮快照。'
        : name === 'browser' ? '需本机浏览器可用；搜索通过浏览器页面操作，未接独立搜索 API。'
        : name === 'web_fetch' ? '不执行脚本、不使用登录态；20 秒超时、2 MiB 响应上限、正文最多 30000 字符。'
        : PROJECT_TOOLS.includes(name) ? '仅项目聊天；项目目录是默认工作目录，不是文件访问沙箱。'
        : WRITING_TOOLS.includes(name) ? '仅小说聊天装配对应业务资源后可用。' : '由当前聊天工具配置决定。' };
  });
  return { tools, names, all };
}
