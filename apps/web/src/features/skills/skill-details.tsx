import type { SkillInfo, ToolInfo, ToolScope } from '@plotloom/contracts/skills';
import { Dialog } from '@plotloom/ui/dialog';

const scopeNames: Record<ToolScope, string> = { project: '项目聊天', novel: '小说聊天' };

/** 除声明依赖外，小说写作指南还会调用按任务启用的暂存、交稿和文稿工具。 */
const novelWritingWorkflowTools = ['write_chapter_part', 'deliver_chapter', 'manuscript_workspace'];

/** 只展示与该技能关联的业务工具，通用项目工具和技能读取工具仍由系统工具清单说明。 */
export function SkillDetails({ skill, tools, onClose }: {
  skill: SkillInfo; tools: ToolInfo[] | null; onClose: () => void;
}) {
  const relatedNames = new Set(skill.declaredTools);
  if (skill.id === 'builtin-novel-writing') {
    for (const name of novelWritingWorkflowTools) relatedNames.add(name);
  }
  // 当前公开目录中，项目会话提供通用工具，专用业务工具只在小说会话注册。
  const relatedTools = tools?.filter(tool => relatedNames.has(tool.name)
    && tool.availableIn.includes('novel') && !tool.availableIn.includes('project'));

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }} title={skill.name} description={skill.description} className="plotloom-skill-details">
    <p>全局状态：{skill.enabled ? '已启用' : '已停用'}。可在「设置 → 技能」中调整。</p>
    <p>适用聊天：{skill.availableIn.length ? skill.availableIn.map(scope => scopeNames[scope]).join('、') : '当前暂无适用聊天'}</p>
    <p className="plotloom-skill-details__muted">来源：{skill.origin} · {skill.files.length} 个资源文件</p>
    <h3>技能专用 ToolCall</h3>
    {relatedTools?.length ? <ul className="plotloom-skill-details__tools">
      {relatedTools.map(tool => <li key={tool.name}><code>{tool.name}</code><p>{tool.description}</p></li>)}
    </ul> : <p className="plotloom-skill-details__muted">{tools ? '此技能暂无专用 ToolCall。' : '暂时无法读取工具清单。'}</p>}
  </Dialog>;
}
