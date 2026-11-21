import { useState } from 'react';
import { FormField } from '../form/form-field.tsx';
import { Textarea } from '../form/textarea.tsx';
import type { ExecutionEntry } from '../execution-timeline/types.ts';
import type { ToolCallData } from '../tool-call/tool-call-item.tsx';
import type { PreviewControls } from './controls.ts';

/** 直接编辑工具公开数据；省略字段通过开关恢复，不把空字符串误当成缺失。 */
function ToolFields({ data, onChange }: { data: ToolCallData; onChange: (data: ToolCallData) => void }) {
  const { source } = data;
  return <>
    <label>工具名称<input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} /></label>
    <label>操作摘要<input value={data.summary ?? ''} onChange={e => onChange({ ...data, summary: e.target.value })} /></label>
    <label>执行状态<select value={data.status} onChange={e => onChange({ ...data, status: e.target.value as ToolCallData['status'] })}>
      <option value="running">进行中</option><option value="awaiting_approval">待审批</option><option value="awaiting_answer">待回答</option><option value="completed">已完成</option><option value="failed">失败</option><option value="stopped">已停止</option>
    </select></label>
    {(['input', 'output'] as const).map(key => <div key={key}>
      <label className="pl-workbench__check"><input type="checkbox" checked={data[key] !== undefined} onChange={e => onChange({ ...data, [key]: e.target.checked ? '' : undefined })} />提供{key === 'input' ? '输入' : '结果'}</label>
      {data[key] !== undefined ? <FormField label={key === 'input' ? '工具输入' : '工具结果'}><Textarea rows={5} value={data[key]} onValueChange={value => onChange({ ...data, [key]: value })} /></FormField> : null}
    </div>)}
    <label className="pl-workbench__check"><input type="checkbox" checked={source !== undefined}
      onChange={e => onChange({ ...data, source: e.target.checked ? { title: '示例网页', url: 'https://example.com/' } : undefined })} />提供访问页面</label>
    {source ? <>
      <label>页面标题<input value={source.title} onChange={e => onChange({ ...data, source: { ...source, title: e.target.value } })} /></label>
      <label>页面地址<input value={source.url} onChange={e => onChange({ ...data, source: { ...source, url: e.target.value } })} /></label>
    </> : null}
  </>;
}

/** 阶段由公开参数明确指定；节点修改保持原 id 与位置。 */
export function AgentProcessControls({ component, controls, onChange }: { component: string; controls: PreviewControls; onChange: (patch: Partial<PreviewControls>) => void }) {
  const [index, setIndex] = useState(0);
  const item = controls.timelineItems[index];
  const updateItem = (next: ExecutionEntry) => onChange({ timelineItems: controls.timelineItems.map((entry, i) => i === index ? next : entry) });
  if (component === 'thinking-content') return <fieldset><legend>思考内容参数</legend>
    <label className="pl-workbench__check"><input type="checkbox" checked={controls.thinkingStreaming} onChange={e => onChange({ thinkingStreaming: e.target.checked })} />模拟思考流式输入</label>
    <FormField label="公开思考文本"><Textarea rows={10} value={controls.thinkingContent} onValueChange={value => onChange({ thinkingContent: value })} /></FormField>
    <p className="pl-workbench__hint">只展示一段公开思考；无独立滚动、阶段识别或整体折叠。</p>
  </fieldset>;
  if (component === 'tool-call-item') return <fieldset><legend>工具调用参数</legend><ToolFields data={controls.toolData} onChange={toolData => onChange({ toolData })} /></fieldset>;
  return <fieldset><legend>执行过程参数</legend>
    <label>过程阶段<select value={controls.timelinePhase} onChange={e => onChange({ timelinePhase: e.target.value as PreviewControls['timelinePhase'] })}>
      <option value="working">执行过程</option><option value="answering">最终回答</option><option value="completed">已完成</option><option value="stopped">已停止</option><option value="failed">失败</option>
    </select></label>
    <label>固定阅读高度（px）<input type="number" min="160" max="800" key={controls.timelineHeight} defaultValue={controls.timelineHeight}
      onBlur={e => { const next = Number.isFinite(e.target.valueAsNumber) ? Math.max(160, Math.min(800, Math.round(e.target.valueAsNumber))) : controls.timelineHeight; onChange({ timelineHeight: next }); e.target.value = String(next); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
    <label className="pl-workbench__check"><input type="checkbox" checked={controls.timelineStreaming} onChange={e => onChange({ timelineStreaming: e.target.checked })} />模拟过程流式输入</label>
    <label>编辑过程节点<select value={item ? index : ''} onChange={e => setIndex(Number(e.target.value))}>
      <option value="" disabled>选择节点</option>{controls.timelineItems.map((entry, i) => <option key={entry.id} value={i}>{i + 1} · {entry.type} · {entry.id}</option>)}
    </select></label>
    {item?.type === 'tool' ? <ToolFields data={item} onChange={data => updateItem({ ...item, ...data })} /> : null}
    {item && item.type !== 'tool' ? <>
      <label>节点标题<input value={item.title ?? ''} onChange={e => updateItem({ ...item, title: e.target.value })} /></label>
      <FormField label="节点内容"><Textarea rows={8} value={item.content ?? ''} onValueChange={content => updateItem({ ...item, content })} /></FormField>
    </> : null}
    <p className="pl-workbench__hint">同一 id 原位更新。整体负责阅读控制，最终回答在区域外；新任务重建组件。</p>
  </fieldset>;
}
