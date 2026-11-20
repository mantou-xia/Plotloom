import { SidebarEntry, type SidebarEntryProps } from './item-base.tsx';
import { useLayoutEffect, useRef } from 'react';
import { Archive, CircleAlert, CircleCheck, Clock, LoaderCircle, Pencil, Pin } from 'lucide-react';
import { SidebarActionButton } from './action-button.tsx';
import './session-item.css';

export type SessionItemStatus = 'running' | 'unread' | 'failed';
export interface SidebarSessionItemProps extends Omit<SidebarEntryProps, 'icon' | 'actions' | 'iconSize' | 'gap'> {
  /** 调用方提供相对时间文案，例如“3 分钟前”；组件不管理业务时间。 */
  timeLabel?: string;
  status?: SessionItemStatus;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onRename?: () => void;
  onArchive?: () => void;
  /** 非空时展示禁用操作及原因；无需提供假的回调，条目本身仍可打开。 */
  pinDisabledReason?: string;
  archiveDisabledReason?: string;
}

const statusLabels = { running: '正在进行', unread: '已完成未查看', failed: '失败' } as const;
const statusIcons = { running: LoaderCircle, unread: CircleCheck, failed: CircleAlert };

/** 只展示受控元数据并通知操作；独立按钮与标题同级，不触发打开会话或访问后端。 */
export function SidebarSessionItem({ className = '', timeLabel, status, pinned = false,
  onPinnedChange, onArchive, onRename, pinDisabledReason, archiveDisabledReason, disabled = false, ...props }: SidebarSessionItemProps) {
  const StatusIcon = status ? statusIcons[status] : undefined;
  const metadataRef = useRef<HTMLDivElement>(null);
  const showRename = Boolean(onRename);
  const showPin = Boolean(onPinnedChange || pinDisabledReason);
  const showArchive = Boolean(onArchive || archiveDisabledReason);
  const hasMetadata = Boolean(timeLabel || status || showRename || showPin || showArchive);
  // 测量自然宽度，使不同时间文案、状态与字体下都能从叠放平滑展开；卸载时释放观察器。
  useLayoutEffect(() => {
    const metadata = metadataRef.current;
    if (!metadata) return;
    const tags = metadata.querySelectorAll<HTMLElement>('.pl-session-metadata__tag');
    const titleContent = metadata.closest('.pl-sidebar-session-item')?.querySelector<HTMLElement>('.pl-sidebar-entry__button > .plotloom-button__content');
    // 工具栏绝对定位覆盖标题；逐帧尺寸变化仅移动文字遮罩，不改变标题的布局宽度。
    const measure = () => {
      tags.forEach((tag) => tag.parentElement?.style.setProperty('--pl-tag-width', `${tag.getBoundingClientRect().width}px`));
      titleContent?.style.setProperty('--pl-session-metadata-width', `${metadata.getBoundingClientRect().width}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    tags.forEach((tag) => observer.observe(tag));
    observer.observe(metadata);
    return () => { observer.disconnect(); titleContent?.style.removeProperty('--pl-session-metadata-width'); };
  }, [timeLabel, status, showRename, showPin, showArchive]);
  return <SidebarEntry {...props} disabled={disabled} className={`pl-sidebar-session-item ${className}`}
    actions={hasMetadata ? <div ref={metadataRef} className="pl-session-metadata" aria-label="会话信息与操作">
      {/* 状态优先、时间其次，使任务结果在展开与叠放时都保持一致的阅读顺序。 */}
      {status && StatusIcon ? <span className="pl-session-metadata__slot"><span className="pl-session-metadata__tag" data-status={status} title={statusLabels[status]} aria-label={statusLabels[status]}>
        <StatusIcon aria-hidden="true" /><span>{statusLabels[status]}</span>
      </span></span> : null}
      {timeLabel ? <span className="pl-session-metadata__slot"><span className="pl-session-metadata__tag" title={timeLabel}>
        <Clock aria-hidden="true" /><span>{timeLabel}</span>
      </span></span> : null}
      {onRename ? <span className="pl-session-metadata__slot"><SidebarActionButton className="pl-session-metadata__tag"
        icon={<Pencil />} label="重命名对话" disabled={disabled} onClick={onRename} /></span> : null}
      {showPin ? <span className="pl-session-metadata__slot" title={pinDisabledReason}><SidebarActionButton className="pl-session-metadata__tag"
        icon={<Pin fill={pinned ? 'currentColor' : 'none'} />} label={pinDisabledReason || (pinned ? '取消置顶' : '置顶会话')} aria-pressed={pinned}
        disabled={disabled || Boolean(pinDisabledReason)} onClick={() => onPinnedChange?.(!pinned)} /></span> : null}
      {showArchive ? <span className="pl-session-metadata__slot" title={archiveDisabledReason}><SidebarActionButton className="pl-session-metadata__tag"
        icon={<Archive />} label={archiveDisabledReason || '归档会话'} disabled={disabled || Boolean(archiveDisabledReason)} onClick={onArchive} /></span> : null}
    </div> : undefined} />;
}
