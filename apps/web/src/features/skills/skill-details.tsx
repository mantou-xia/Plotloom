import type { SkillInfo, ToolInfo, ToolScope } from '@plotloom/contracts/skills';
import { Dialog } from '@plotloom/ui/dialog';

const scopeNames: Record<ToolScope, string> = { project: '项目聊天', novel: '小说聊天' };

/** 业务弹窗只使用公开目录；声明依赖与环境能力分开展示，避免误导为技能授予权限。 */
export function SkillDetails({ skill, tools, onClose }: {
  skill: SkillInfo; tools: ToolInfo[]; onClose: () => void;
}) {
  const declared = skill.declaredTools.map(name => tools.find(tool => tool.name === name) ?? {
    name, description: '当前后端未注册该工具。', parameters: '未提供', availableIn: [], condition: '缺少此工具时技能不会加载。',
  });
  function toolRows(items: Array<Omit<ToolInfo, 'provider'>>) {
    return <ul className="plotloom-skill-details__tools">{items.map(tool => <li key={tool.name}>
      <h4><code>{tool.name}</code><span>{tool.availableIn.length ? tool.availableIn.map(scope => scopeNames[scope]).join(' · ') : '未注册'}</span></h4>
      <p>{tool.description}</p><p className="plotloom-skill-details__muted">参数：{tool.parameters}</p>
      <p className="plotloom-skill-details__muted">{tool.condition}</p>
    </li>)}</ul>;
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }} title={skill.name} description={skill.description} className="plotloom-skill-details">
    <p>全局状态：{skill.enabled ? '已启用' : '已停用'}。可在「设置 → 技能」中调整。</p>
    <p className="plotloom-skill-details__muted">关闭后所有聊天从下一轮起停止加载，当前生成不受影响。开启后，跟随默认设置且满足工具条件的聊天可自动选用；聊天独立选择仍会限制范围。</p>
    <p>适用环境：{skill.availableIn.length ? skill.availableIn.map(scope => scopeNames[scope]).join('、') : '当前无满足全部工具条件的聊天环境'}</p>
    <h3>技能声明的工具</h3>
    {declared.length ? toolRows(declared) : <p className="plotloom-skill-details__muted">此技能未声明特定工具依赖，按当前聊天实际提供的工具执行。</p>}
    <h3>聊天基础工具</h3>
    <p className="plotloom-skill-details__muted">技能不会额外授予工具权限。以下工具按聊天类型和条件提供，实际调用由任务决定。</p>
    {toolRows(tools.filter(tool => !skill.declaredTools.includes(tool.name)))}
    {skill.compatibility ? <p>环境要求：{skill.compatibility}</p> : null}
    <p className="plotloom-skill-details__muted">来源：{skill.origin} · {skill.files.length} 个资源文件</p>
  </Dialog>;
}
