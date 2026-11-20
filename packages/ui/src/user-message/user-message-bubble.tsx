import type { CSSProperties, ReactNode } from 'react';
import './user-message-bubble.css';

export interface UserMessageBubbleProps {
  /** 用户原文；不裁剪空白，不解析 Markdown 或 HTML。仅附件消息传空字符串。 */
  text: string;
  /** 附件展示插槽；上传、预览、文件类型识别等行为均由调用方提供。 */
  attachments?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 用户消息只负责原文与附件的布局；纯附件不补造正文，完全空消息不占位。 */
export function UserMessageBubble({ text, attachments, className = '', style }: UserMessageBubbleProps) {
  if (text === '' && !attachments) return null;
  return <article className={`pl-user-message ${className}`} aria-label="用户消息" style={style}>
    {attachments ? <div className="pl-user-message__attachments" role="group" aria-label="消息附件">{attachments}</div> : null}
    {text !== '' ? <div className="pl-user-message__text">{text}</div> : null}
  </article>;
}
