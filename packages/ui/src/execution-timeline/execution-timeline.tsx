import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ChevronsUpDown, ChevronsDownUp, Logs } from 'lucide-react';
import { DisclosureTrigger } from '../disclosure/disclosure-trigger.tsx';
import type { AgentPhase } from '../agent-activity/activity.ts';
import { Button } from '../button/button.tsx';
import type { MarkdownRendererProps } from '../markdown/markdown-renderer.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { TimelineEntry } from './timeline-entry.tsx';
import type { ExecutionEntry } from './types.ts';
import './execution-timeline.css';

export type { ExecutionEntry } from './types.ts';
export type { ProcessStatus } from '../agent-process/types.ts';
export interface ExecutionTimelineProps {
  /** 已按实际发生顺序排列的记录。id 唯一且稳定，更新输入/结果时保持原 id 和位置。 */
  items: readonly ExecutionEntry[];
  /** 过程说明中的 Markdown 链接可以由宿主处理。 */
  renderMessageLink?: MarkdownRendererProps['renderLink'];
  /** 正在接收过程增量；控制整体跟随及记录上显式标记的文本流式效果。 */
  streaming?: boolean;
  /** 最终回答由调用方明确判定；首个正文增量不能作为该阶段的依据。 */
  phase?: AgentPhase;
  /** 固定阅读模式的整体高度（含 36px 工具栏），默认 312px；展开全部时取消限制。 */
  height?: number;
  elapsedSeconds?: number;
  className?: string;
  style?: CSSProperties;
}

/** 整个 Agent 过程只有一个阅读视口；新任务用 key 重建，不推测最终回答或业务事件。 */
export function ExecutionTimeline({ items, renderMessageLink, streaming = false, phase = 'working', height = 312, elapsedSeconds,
  className = '', style }: ExecutionTimelineProps) {
  const seconds = Math.floor(elapsedSeconds ?? 0);
  const duration = elapsedSeconds === undefined ? '执行过程' : `用时 ${seconds >= 60 ? Math.floor(seconds / 60) + '分钟 ' : ''}${seconds % 60}秒`;
  const finished = phase === 'answering' || phase === 'completed';
  const active = streaming && phase === 'working';
  // 不为未公开的思考或空消息制造节点；其余记录保留调用方给定的顺序。
  const entries = items.filter(item => (item.type !== 'thinking' && item.type !== 'message') || item.content.trim());
  const hasContent = entries.length > 0;
  const [reachedAnswer, setReachedAnswer] = useState(finished);
  const [open, setOpen] = useState(!finished);
  const [full, setFull] = useState(false);
  const [away, setAway] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLOListElement>(null);
  const follow = useRef(true);
  const savedTop = useRef(0);
  const contentId = useId();

  // 每个任务只自动折叠一次；回答期间失败/停止仍保留用户选择和重新展开入口。
  // 在提交 DOM 前同步，避免先展示一帧展开内容再折叠。新任务由 key 重置。
  if (finished && !reachedAnswer) {
    setReachedAnswer(true);
    setOpen(false);
    setFull(false);
  }

  useLayoutEffect(() => {
    const element = viewport.current;
    const inner = body.current;
    if (!element || !inner || !open || full) return;
    element.scrollTop = savedTop.current;
    // 同时观察 Markdown 的异步排版与视口尺寸，不只在字符串追加时追随。
    // 用户向上阅读时不写 scrollTop；只在 active 且仍跟随时移动内部滚动区。
    const sync = () => {
      if (active && follow.current) element.scrollTop = element.scrollHeight;
      setAway(element.scrollHeight - element.clientHeight - element.scrollTop > 24);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [active, open, full, hasContent]);

  const rememberScroll = () => {
    const element = viewport.current;
    if (!element || !open || full) return;
    const atBottom = element.scrollHeight - element.clientHeight - element.scrollTop <= 24;
    follow.current = atBottom;
    savedTop.current = element.scrollTop;
    setAway(!atBottom);
  };
  const latest = () => {
    const element = viewport.current;
    if (!element) return;
    follow.current = true;
    element.scrollTop = element.scrollHeight;
    savedTop.current = element.scrollTop;
    setAway(false);
    // 隐藏按钮前把焦点交还阅读区，避免键盘焦点遗留在不可见入口。
    element.focus({ preventScroll: true });
  };
  const toggleFull = () => {
    if (!full && viewport.current) savedTop.current = viewport.current.scrollTop;
    setFull(value => !value);
  };
  // 详情展开是主动阅读，不能被 ResizeObserver 当成新进展而拉到列表末尾。
  const pauseFollowing = useCallback(() => { follow.current = false; }, []);

  // 运行时用等高空态承接首条记录，不伪造思考节点；结束后没有记录就不占位。
  if (!hasContent) return phase === 'working' ? <div className={`pl-execution-timeline__empty ${className}`}
    style={{ ...style, height }}>
    <Logs aria-hidden="true" />
    <span className="pl-execution-timeline__empty-title">暂无过程内容</span>
    <p>公开的思考与操作记录会显示在这里。</p>
  </div> : null;
  return <section className={`pl-execution-timeline ${className}`} aria-label="Agent 执行过程"
    data-phase={phase} data-open={open} data-full={full}
    style={{ ...style, '--pl-process-height': `${height}px` } as CSSProperties}>
    <div className="pl-execution-timeline__toolbar">
      {reachedAnswer ? <DisclosureTrigger open={open} className="pl-execution-timeline__title"
        aria-controls={contentId} aria-label={open ? '收起执行过程' : '展开执行过程'}
        onClick={() => setOpen(value => !value)}>{duration}</DisclosureTrigger>
        : <span className="pl-execution-timeline__label">执行过程</span>}
      <div className="pl-execution-timeline__actions" style={{ visibility: open ? 'visible' : 'hidden' }}>
        <Button variant="text" size="sm" iconOnly aria-label="回到最新过程" title="回到最新过程"
          className="pl-execution-timeline__latest" style={{ visibility: open && !full && away ? 'visible' : 'hidden' }}
          onClick={latest}><ArrowDown /></Button>
        <Button variant="text" size="sm" iconOnly className="pl-execution-timeline__expand" aria-pressed={full}
          aria-label={full ? '恢复定高' : '展开全部'} title={full ? '恢复定高' : '展开全部'}
          aria-controls={contentId} onClick={toggleFull}>{full ? <ChevronsDownUp /> : <ChevronsUpDown />}</Button>
      </div>
    </div>
    <div id={contentId} hidden={!open} className="pl-execution-timeline__body">
      <ScrollBox ref={viewport} role="region" aria-label="过程记录" className="pl-execution-timeline__viewport" onScroll={rememberScroll}>
        <ol ref={body} className="pl-execution-timeline__list" aria-label="按发生顺序排列的记录">
          {entries.map(item => <li key={item.id} className="pl-execution-timeline__item" data-entry-id={item.id} data-entry-type={item.type}>
            <TimelineEntry item={item} streaming={active && open} onInspect={pauseFollowing} renderMessageLink={renderMessageLink} />
          </li>)}
        </ol>
      </ScrollBox>
    </div>
  </section>;
}
