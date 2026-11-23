import { useId, type ReactNode } from 'react';
import { ContextActions } from '../action-menu/action-menu.tsx';
import './document-list-item.css';

export interface DocumentListItemProps {
  title: string; label?: string; category: string; extension?: string; date?: string; excerpt?: string;
  selected: boolean; onSelect: () => void; actions?: ReactNode;
  /** 行尾的状态或方向提示，整行共用一个点击目标。 */
  endContent?: ReactNode;
}

/** 文稿条目通过灰度和字重表达当前选择；右键菜单独立于左键选中。 */
export function DocumentListItem({ title, label = title, category, extension, date, excerpt, selected, onSelect, actions, endContent }: DocumentListItemProps) {
  const endId = useId();
  const row = <button type="button" className="pl-document-list-item" aria-label={label} aria-current={selected || undefined}
    title={endContent ? label : undefined} aria-describedby={endContent ? endId : undefined} onClick={onSelect}>
    <span className="pl-document-list-item__meta"><span title={endContent ? category : undefined}>{category}</span>{date && <span>{date}</span>}</span>
    <span className="pl-document-list-item__title"><strong>{title}</strong>{extension && <small>{extension}</small>}</span>
    {excerpt && <span className="pl-document-list-item__excerpt">{excerpt}</span>}
    {endContent && <span id={endId} className="pl-document-list-item__end">{endContent}</span>}
  </button>;
  return actions ? <ContextActions trigger={row} label={title + '操作'}>{actions}</ContextActions> : row;
}
