import { memo, type CSSProperties } from 'react';
import { CodeBlockFrame } from './frame.tsx';
import { HighlightedCode } from './highlighted-code.tsx';

export interface CodeBlockProps {
  /** 原始代码；不裁剪缩进、空行或末尾换行，复制也使用这一份字符串。 */
  code: string;
  /** 语言名或高亮器支持的别名；省略、空字符串或未知语言均以纯文本展示。 */
  language?: string;
  /** 正在接收增量时为 true；完成或停止后设为 false，不管理网络或播放队列。 */
  streaming?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 独立代码展示入口；Markdown 与其他调用方共享高亮、复制和滚动，不执行源码。 */
export const CodeBlock = memo(function CodeBlock({ code, language = 'text', streaming = false, className, style }: CodeBlockProps) {
  const normalizedLanguage = language.trim().toLowerCase() || 'text';
  return <CodeBlockFrame code={code} language={normalizedLanguage} streaming={streaming} className={className} style={style}>
    <HighlightedCode code={code} language={normalizedLanguage} incomplete={streaming} />
  </CodeBlockFrame>;
});
