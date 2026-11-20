import { memo, type CSSProperties } from 'react';
import { MarkdownRenderer } from '../markdown/markdown-renderer.tsx';
import './thinking-content.css';

export interface ThinkingContentProps {
  /** 一段由接口公开的思考文本或摘要；增量由调用方累加，空白不展示。 */
  content: string;
  streaming?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 思考内容只负责排版；整轮过程的排序、折叠和滚动属于 ExecutionTimeline。 */
export const ThinkingContent = memo(function ThinkingContent({ content, streaming = false, className = '', style }: ThinkingContentProps) {
  if (!content.trim()) return null;
  return <div className={`pl-thinking-content ${className}`} style={style} aria-label="公开思考内容">
    <MarkdownRenderer content={content} streaming={streaming} />
  </div>;
});
