import { SidebarEntry, type SidebarEntryProps } from './item-base.tsx';
import { useLayoutEffect, useRef } from 'react';
import { Archive, CircleAlert, CircleCheck, Clock, LoaderCircle, MessageCircleQuestionMark, Pin, ShieldQuestionMark } from 'lucide-react';
import { SidebarActionButton } from './action-button.tsx';
import './session-item.css';

export type SessionItemStatus = 'running' | 'awaiting_approval' | 'awaiting_answer' | 'unread' | 'failed';
export interface SidebarSessionItemProps extends Omit<SidebarEntryProps, 'icon' | 'actions' | 'iconSize' | 'gap'> {
  /** 调用方提供相对时间文案，例如“3 分钟前”；组件不管理业务时间。 */
  timeLabel?: string;
  status?: SessionItemStatus;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onArchive?: () => void;
  /** 非空时展示禁用操作及原因；无需提供假的回调，条目本身仍可打开。 */
  pinDisabledReason?: string;
  archiveDisabledReason?: string;
}

const statusLabels = { running: '正在进行', awaiting_approval: '待审批', awaiting_answer: '等待用户回答', unread: '已完成未查看', failed: '失败' } as const;
const statusIcons = { running: LoaderCircle, awaiting_approval: ShieldQuestionMark, awaiting_answer: MessageCircleQuestionMark, unread: CircleCheck, failed: CircleAlert };

/** 只展示受控元数据并通知操作；独立按钮与标题同级，不触发打开会话或访问后端。 */
export function SidebarSessionItem({ className = '', timeLabel, status, pinned = false,
  onPinnedChange, onArchive, pinDisabledReason, archiveDisabledReason, disabled = false, ...props }: SidebarSessionItemProps) {
  const StatusIcon = status ? statusIcons[status] : undefined;
  const metadataRef = useRef<HTMLDivElement>(null);
  const showPin = Boolean(onPinnedChange || pinDisabledReason);
  const showArchive = Boolean(onArchive || archiveDisabledReason);
  const pinDisabled = disabled || Boolean(pinDisabledReason);
  const archiveDisabled = disabled || Boolean(archiveDisabledReason);
  const hasMetadata = Boolean(timeLabel || status || showPin || showArchive);
  useLayoutEffect(() => {
    const metadata = metadataRef.current;
    const actions = metadata?.parentElement;
    if (!metadata || !actions) return;
    const tags = [...metadata.querySelectorAll<HTMLElement>('.pl-session-metadata__tag')];
    const titleContent = metadata.closest('.pl-sidebar-session-item')?.querySelector<HTMLElement>('.pl-sidebar-entry__button > .plotloom-button__content');
    // 按整行的实际空间决定是否压缩只读文字。测量未受裁切的标签，以便拖宽后恢复全文。
    const fit = () => {
      const widths = tags.map(tag => tag.getBoundingClientRect().width);
      const gap = Number.parseFloat(getComputedStyle(metadata).getPropertyValue('--pl-session-tag-gap'));
      const expandedWidth = widths.reduce((total, width) => total + width, 0) + (tags.length - 1) * gap;
      const available = actions.getBoundingClientRect().width;
      // 给标题保留 24px 的展开余量，窄行优先展示状态、时间图标和完整操作按钮。
      metadata.toggleAttribute('data-compact', expandedWidth + 24 > available);
      // 禁用的图标按钮由 Tooltip 外层接收悬停，因此直接查找布局槽位。
      tags.forEach((tag, index) => tag.closest<HTMLElement>('.pl-session-metadata__slot')?.style.setProperty('--pl-tag-width', `${widths[index]}px`));
    };
    // 工具栏绝对定位覆盖标题；逐帧尺寸变化仅移动文字遮罩，不改变标题的布局宽度。
    const updateMask = () => {
      titleContent?.style.setProperty('--pl-session-metadata-width', `${metadata.getBoundingClientRect().width}px`);
    };
    fit();
    updateMask();
    const fitObserver = new ResizeObserver(fit);
    fitObserver.observe(actions);
    tags.forEach(tag => fitObserver.observe(tag));
    const maskObserver = new ResizeObserver(updateMask);
    maskObserver.observe(metadata);
    return () => {
      fitObserver.disconnect();
      maskObserver.disconnect();
      titleContent?.style.removeProperty('--pl-session-metadata-width');
    };
  }, [timeLabel, status, showPin, showArchive, pinDisabled, archiveDisabled]);
  return <SidebarEntry {...props} disabled={disabled} className={`pl-sidebar-session-item ${className}`}
    actions={hasMetadata ? <div ref={metadataRef} className="pl-session-metadata" aria-label="会话信息与操作">
      {/* 状态优先、时间其次，使任务结果在展开与叠放时都保持一致的阅读顺序。 */}
      {status && StatusIcon ? <span className="pl-session-metadata__slot" data-information><span className="pl-session-metadata__tag" data-status={status} title={statusLabels[status]} aria-label={statusLabels[status]}>
        <StatusIcon aria-hidden="true" /><span>{statusLabels[status]}</span>
      </span></span> : null}
      {timeLabel ? <span className="pl-session-metadata__slot" data-information><span className="pl-session-metadata__tag" title={timeLabel}>
        <Clock aria-hidden="true" /><span>{timeLabel}</span>
      </span></span> : null}
      {showPin ? <span className="pl-session-metadata__slot"><SidebarActionButton className="pl-session-metadata__tag"
        icon={<Pin fill={pinned ? 'currentColor' : 'none'} />} label={pinDisabledReason || (pinned ? '取消置顶' : '置顶会话')} aria-pressed={pinned}
        disabled={pinDisabled} onClick={() => onPinnedChange?.(!pinned)} /></span> : null}
      {showArchive ? <span className="pl-session-metadata__slot"><SidebarActionButton className="pl-session-metadata__tag"
        icon={<Archive />} label={archiveDisabledReason || '归档会话'} disabled={archiveDisabled} onClick={onArchive} /></span> : null}
    </div> : undefined} />;
}
