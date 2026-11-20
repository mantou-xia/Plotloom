import { AGENT_ACTIVITIES, type AgentActivity, type AgentPhase, type ParticleShape } from '../agent-activity/agent-activity-header.tsx';
import { FormField } from '../form/form-field.tsx';
import { Textarea } from '../form/textarea.tsx';
import type { PreviewControls } from './controls.ts';

/** 调试参数只通过公开 props 生效，不用选择器改组件内部尺寸。 */
export function AgentActivityControls({ controls, onChange }: { controls: PreviewControls; onChange: (patch: Partial<PreviewControls>) => void }) {
  return <fieldset><legend>Agent 过程参数</legend>
    <label>运行阶段<select value={controls.agentPhase} onChange={event => onChange({ agentPhase: event.target.value as AgentPhase })}>
      <option value="working">执行过程</option><option value="answering">最终回答</option><option value="completed">已完成</option><option value="failed">失败</option><option value="stopped">已停止</option>
    </select></label>
    <label>工具名称<input type="text" value={controls.agentTool} onChange={event => onChange({ agentTool: event.target.value })} /></label>
    <label>当前活动<select value={controls.agentActivity} onChange={event => onChange({ agentActivity: event.target.value as AgentActivity | 'auto' })}>
      <option value="auto">根据示例工具映射</option>{Object.entries(AGENT_ACTIVITIES).map(([value, preset]) => <option key={value} value={value}>{preset.label}</option>)}
    </select></label>
    <label>自定义文案<input type="text" value={controls.agentLabel} onChange={event => onChange({ agentLabel: event.target.value })} placeholder="留空使用活动预设" /></label>
    <label>粒子形态<select value={controls.agentShape} onChange={event => onChange({ agentShape: event.target.value as ParticleShape | 'auto' })}>
      <option value="auto">跟随活动</option><option value="book">书页</option><option value="pencil">笔</option><option value="magnifier">放大镜</option><option value="folder">文件夹</option><option value="robot">机械臂</option><option value="cube">魔方</option><option value="bricks">积木</option><option value="gift">礼物</option><option value="sphere">粒子球</option>
    </select></label>
    <label>视觉区高度（px）<input type="number" min="240" max="560" key={controls.agentHeight} defaultValue={controls.agentHeight}
      onBlur={event => { const value = event.target.value === '' ? controls.agentHeight : Math.max(240, Math.min(560, Math.round(Number(event.target.value)))); onChange({ agentHeight: value }); event.target.value = String(value); }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
    <label className="pl-workbench__check"><input type="checkbox" checked={controls.agentShowElapsed} onChange={event => onChange({ agentShowElapsed: event.target.checked })} />显示调用方耗时</label>
    <label>耗时（秒）<input type="number" min="0" step="0.1" value={controls.agentElapsed} onChange={event => onChange({ agentElapsed: Math.max(0, Number(event.target.value)) })} /></label>
    <label className="pl-workbench__check"><input type="checkbox" checked={controls.agentReducedMotion} onChange={event => onChange({ agentReducedMotion: event.target.checked })} />减少动态效果</label>
    <FormField label="过程中的思考段"><Textarea rows={8} value={controls.agentContent} onValueChange={value => onChange({ agentContent: value })} /></FormField>
    <p className="pl-workbench__hint">阶段和耗时均为演示输入。首段正文不会被当作最终回答；真实后端阶段识别尚未接入。</p>
  </fieldset>;
}
