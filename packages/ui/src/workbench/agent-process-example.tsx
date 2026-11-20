import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../button/button.tsx';
import { ThinkingContent } from '../thinking-content/thinking-content.tsx';
import { ToolCallItem } from '../tool-call/tool-call-item.tsx';
import { ExecutionTimeline, type ExecutionEntry } from '../execution-timeline/execution-timeline.tsx';
import type { PreviewControls } from './controls.ts';

/** 本地事件按序追加，工具结束更新原节点；暂停后保留记录，用于检查真实组件的阅读行为。 */
export function AgentProcessExample({ component, controls, style, onAction }: { component: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void }) {
  const [length, setLength] = useState(24);
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [extra, setExtra] = useState<ExecutionEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const stream = component === 'thinking-content' ? controls.thinkingStreaming : controls.timelineStreaming && controls.timelinePhase === 'working';
  const active = stream && !paused && (component !== 'thinking-content' || length < controls.thinkingContent.length);
  useEffect(() => {
    if (!active || component === 'tool-call-item') return;
    const timer = setTimeout(() => {
      if (component === 'thinking-content') setLength(value => value + 24);
      else setExtra(entries => nextDemoEvent(entries));
    }, component === 'thinking-content' ? 120 : 900);
    return () => clearTimeout(timer);
  }, [active, component, length, extra]);
  if (component === 'tool-call-item') return <ToolCallItem {...controls.toolData} expanded={expanded} onExpandedChange={value => { setExpanded(value); onAction(`onExpandedChange(${value})`); }} style={style} />;
  return <>
    <div className="pl-example-scroll-actions">
      <Button size="sm" variant="secondary" disabled={!stream} onClick={() => setPaused(value => !value)}>{paused ? '继续流式' : '暂停流式'}</Button>
      {component === 'execution-timeline' ? <Button size="sm" variant="text" onClick={() => { setExtra(entries => nextDemoEvent(entries)); onAction('推进一条过程事件'); }}>推进一条事件</Button> : null}
      <Button size="sm" variant="text" onClick={() => { setLength(24); setExtra([]); setPaused(false); setRevision(value => value + 1); onAction('新任务：重建过程组件'); }}>新任务</Button>
    </div>
    {component === 'thinking-content' ? <ThinkingContent content={controls.thinkingStreaming ? controls.thinkingContent.slice(0, length) : controls.thinkingContent} streaming={active && length < controls.thinkingContent.length} style={style} />
      : <ExecutionTimeline key={revision} items={[...controls.timelineItems, ...extra]} phase={controls.timelinePhase} streaming={active} height={controls.timelineHeight} style={style} />}
    <p style={{ marginTop: 24 }} data-process-after>示例后续内容：用于检查固定高度与展开行为。</p>
  </>;
}

/** 一个本地演示周期：说明 → 工具开始 → 原位结束 → 新思考；顺序不会按类型重新归组。 */
export function nextDemoEvent(entries: ExecutionEntry[]): ExecutionEntry[] {
  const last = entries.at(-1);
  if (last?.type === 'tool' && last.status === 'running') return entries.map(entry => entry === last ? { ...last, status: 'completed', output: '已完成检查，结果可用于后续处理。' } : entry);
  const id = `demo-${entries.length}`;
  if (last?.type === 'message') return [...entries, { id, type: 'tool', name: 'read', summary: '读取下一份任务资料', status: 'running', input: '{ "path": "notes.md" }' }];
  if (last?.type === 'tool') return [...entries, { id, type: 'thinking', content: '根据刚才读取的结果继续核对任务。', streaming: true }];
  if (last?.type === 'thinking' && last.streaming) return entries.map(entry => entry === last ? { ...last, content: `${last.content}\n\n资料已核对，继续处理下一项。`, streaming: false } : entry);
  return [...entries, { id, type: 'message', content: '继续检查下一份资料。' }];
}
