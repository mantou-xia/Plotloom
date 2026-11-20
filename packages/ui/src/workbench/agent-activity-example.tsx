import { useEffect, useState, type CSSProperties } from 'react';
import { AgentActivityHeader, type AgentActivity, type AgentPhase } from '../agent-activity/agent-activity-header.tsx';
import { Button } from '../button/button.tsx';
import { MarkdownRenderer } from '../markdown/markdown-renderer.tsx';
import { ExecutionTimeline, type ExecutionEntry } from '../execution-timeline/execution-timeline.tsx';
import { processSamples } from './agent-process-samples.ts';
import type { PreviewControls } from './controls.ts';

/** 这里只演示工具映射；真实业务映射以后由 apps/web 按公开工具名维护。 */
const TOOL_ACTIVITIES: Record<string, AgentActivity> = { read: 'reading', read_skill: 'reading', write: 'writing', edit: 'editing', grep: 'searching', find: 'searching', ls: 'browsing', powershell: 'executing', bash: 'executing' };
const DEMO_TOOLS = ['read', 'grep', 'write', 'powershell'];
const ANSWER = '这是最终回答的流式示例。活动 Header 已隐藏；展开执行过程只展示过程记录，不会重新显示粒子和状态栏。';

/** 示例使用明确的阶段按钮和本地演示数据，不宣称已识别真实后端最终回答。 */
export function AgentActivityExample({ controls, style, onAction }: { controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void }) {
  const [phaseOverride, setPhaseOverride] = useState<AgentPhase | null>(null);
  const [toolOverride, setToolOverride] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [extra, setExtra] = useState('');
  const [events, setEvents] = useState<ExecutionEntry[]>([]);
  const [answerLength, setAnswerLength] = useState(0);
  const [empty, setEmpty] = useState(false);
  useEffect(() => { setPhaseOverride(null); setPlaying(false); }, [controls.agentPhase]);
  useEffect(() => { setToolOverride(null); }, [controls.agentTool]);
  const phase = phaseOverride ?? controls.agentPhase;
  const tool = toolOverride ?? controls.agentTool;
  const activity = controls.agentActivity === 'auto' ? TOOL_ACTIVITIES[tool] ?? 'processing' : controls.agentActivity;
  useEffect(() => {
    if (!playing || phase !== 'working') return;
    const timer = setTimeout(() => {
      const next = step + 1;
      const nextTool = DEMO_TOOLS[next % DEMO_TOOLS.length];
      setStep(next); setToolOverride(nextTool);
      // 结束上一个工具时原位更新；新的工具开始才追加节点，保留完整执行顺序。
      setEvents(items => [...items.map(item => item.type === 'tool' && item.status === 'running' ? { ...item, status: 'completed' as const, output: '操作完成。' } : item),
        { id: `tool-${next}`, type: 'tool', name: nextTool, status: 'running', summary: `处理任务步骤 ${next}`, input: '本地模拟输入' }]);
    }, 2200);
    return () => clearTimeout(timer);
  }, [playing, phase, step]);
  useEffect(() => {
    if (phase !== 'answering' || answerLength >= ANSWER.length) return;
    const timer = setTimeout(() => setAnswerLength(value => value + 2), 120);
    return () => clearTimeout(timer);
  }, [phase, answerLength]);
  const enterAnswer = () => { setPlaying(false); setPhaseOverride('answering'); setAnswerLength(0); onAction('phase=answering：明确进入最终回答'); };
  const items: ExecutionEntry[] = [{ id: 'initial-thinking', type: 'thinking', content: controls.agentContent + extra }, ...processSamples.default.slice(1, 3),
    ...events.map(item => item.type === 'tool' && phase !== 'working' && item.status === 'running' ? { ...item, status: phase === 'failed' || phase === 'stopped' ? phase : 'completed' as const } : item)];
  return <>
    <div className="pl-example-scroll-actions">
      <Button size="sm" variant="text" onClick={() => setEmpty(value => !value)}>{empty ? '显示过程内容' : '查看无过程空态'}</Button>
      <Button size="sm" variant="secondary" disabled={phase !== 'working'} onClick={() => setPlaying(value => !value)}>{playing ? '暂停工具演示' : '模拟工具过程'}</Button>
      <Button size="sm" variant="text" onClick={() => setExtra(value => value + '\n\n新增的思考内容，用于验证流式追加时保持当前展开状态。')}>追加思考内容</Button>
      <Button size="sm" variant="text" onClick={enterAnswer}>开始最终回答</Button>
      <Button size="sm" variant="text" onClick={() => { setPlaying(false); setPhaseOverride('completed'); setAnswerLength(ANSWER.length); }}>完成回答</Button>
      <Button size="sm" variant="text" onClick={() => { setRevision(value => value + 1); setPhaseOverride('working'); setPlaying(false); setExtra(''); setEvents([]); setStep(0); setToolOverride(null); setAnswerLength(0); }}>新任务</Button>
    </div>
    <AgentActivityHeader key={revision} activity={activity} phase={phase} label={controls.agentLabel || undefined}
      shape={controls.agentShape === 'auto' ? undefined : controls.agentShape} visualHeight={controls.agentHeight}
      elapsedSeconds={controls.agentShowElapsed ? controls.agentElapsed : undefined} reducedMotion={controls.agentReducedMotion}
      style={style}>
      {/* C05 统一管理全部过程的阅读与折叠，默认高度扣除 C03 的 48px 状态栏。 */}
      <ExecutionTimeline items={empty ? [] : items} phase={phase} streaming={phase === 'working'} elapsedSeconds={controls.agentShowElapsed ? controls.agentElapsed : undefined} height={controls.agentHeight - 48} />
    </AgentActivityHeader>
    {phase === 'answering' || phase === 'completed' ? <div style={{ paddingTop: 24 }}><MarkdownRenderer content={phase === 'completed' ? ANSWER : ANSWER.slice(0, answerLength)} streaming={phase === 'answering' && answerLength < ANSWER.length} /></div> : null}
  </>;
}
