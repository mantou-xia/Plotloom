import { type CSSProperties, type ReactNode } from 'react';
import { AGENT_ACTIVITIES, type AgentActivity, type AgentPhase, type ParticleShape } from './activity.ts';
import { ActivityParticles } from './particles.tsx';
import './agent-activity.css';

export { AGENT_ACTIVITIES } from './activity.ts';
export type { AgentActivity, AgentPhase, ParticleShape } from './activity.ts';
export interface AgentActivityHeaderProps {
  activity?: AgentActivity;
  /** 最终回答由调用方明确判定，不能用首个正文增量代替。 */
  phase?: AgentPhase;
  label?: string;
  /** 隐藏运行中的状态行并保留其占位，结束反馈出现时执行过程仍留在原处。 */
  hideWorkingStatus?: boolean;
  shape?: ParticleShape;
  /** 左侧视觉区高度；默认 360px，右侧以此为最小高度，内容主动展开后可撑高。 */
  visualHeight?: number;
  elapsedSeconds?: number;
  /** 内容插槽始终保留；具体内容、滚动与结束后的折叠均由调用方管理。 */
  children?: ReactNode;
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 思考结束隐藏粒子和状态头部，保留同一内容插槽；Header 不拥有内容展开状态。 */
export function AgentActivityHeader({ activity = 'thinking', phase = 'working', label, hideWorkingStatus = false, shape, visualHeight = 360,
  elapsedSeconds, children,
  reducedMotion = false, className = '', style }: AgentActivityHeaderProps) {
  const working = phase === 'working';
  const animating = working && activity !== 'awaiting_approval' && activity !== 'awaiting_answer';
  const finished = phase === 'answering' || phase === 'completed';
  const preset = AGENT_ACTIVITIES[activity];
  const title = working ? label ?? preset.label : phase === 'failed' ? '执行失败' : '已停止';
  return <section className={`pl-agent-activity ${className}`} data-phase={phase} data-finished={finished} data-reduced-motion={reducedMotion || !animating}
    aria-label="Agent 活动与内容" style={{ ...style, '--pl-agent-height': `${visualHeight}px` } as CSSProperties}>
    <div className="pl-agent-activity__body">
      {!finished ? <div className="pl-agent-activity__visual"><ActivityParticles shape={shape ?? preset.shape} active={animating} reducedMotion={reducedMotion} /></div> : null}
      <div className="pl-agent-activity__right">
        {!finished ? <header className="pl-agent-activity__header" style={working && hideWorkingStatus ? { visibility: 'hidden' } : undefined}>
          <span className="pl-agent-activity__thinking-icon" aria-hidden="true">{Array.from({ length: 9 }, (_, i) =>
            <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
          <span className="pl-agent-activity__label" role="status">{title}</span>
          {elapsedSeconds !== undefined ? <span className="pl-agent-activity__time">{Math.max(0, elapsedSeconds).toFixed(1)}s</span> : null}
        </header> : null}
        <div className="pl-agent-activity__content">{children}</div>
      </div>
    </div>
  </section>;
}
