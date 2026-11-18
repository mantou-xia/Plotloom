import type { ReactNode } from 'react';
import './content.css';

export interface SidebarContentProps {
  /** 状态由调用方根据业务结果指定；不根据 children 数量猜测加载结果。 */
  contentState?: 'ready' | 'empty' | 'error';
  emptyText?: string;
  errorText?: string;
  children?: ReactNode;
}

/** 分组和分类共用状态提示；纯文本不提供 hover、选中或点击行为。 */
export function SidebarContent({ contentState = 'ready', emptyText = '暂无聊天', errorText = '加载失败', children }: SidebarContentProps) {
  if (contentState === 'ready') return children;
  return <p className="pl-sidebar-content-state" data-state={contentState} role={contentState === 'error' ? 'alert' : 'status'}>
    {contentState === 'error' ? errorText : emptyText}
  </p>;
}
