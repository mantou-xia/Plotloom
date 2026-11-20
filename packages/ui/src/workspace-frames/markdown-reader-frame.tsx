import type { CSSProperties, ReactNode } from 'react';
import { FileText, FolderOpen, LoaderCircle } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { MarkdownRenderer } from '../markdown/markdown-renderer.tsx';
import { FrameState } from './frame-state.tsx';
import './workspace-frames.css';

export interface MarkdownReaderFrameProps {
  fileName?: string;
  filePath?: string;
  /** undefined 表示尚未打开；空字符串表示已打开的空文件。框架不读取文件。 */
  content?: string;
  loading?: boolean;
  error?: string;
  onOpen?: () => void;
  onRetry?: () => void;
  actions?: ReactNode;
  /** 替换默认文件信息栏；null 可省略工具栏。 */
  toolbar?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 只读文本框架：文件获取由调用方负责，刷新中仍保留已读正文与滚动节点。 */
export function MarkdownReaderFrame({ fileName = 'Markdown 阅读器', filePath, content, loading = false, error,
  onOpen, onRetry, actions, toolbar, className = '', style }: MarkdownReaderFrameProps) {
  const hasDocument = content !== undefined;
  const status = loading ? '正在读取文档…' : error ? error : hasDocument ? '只读 · Markdown' : '尚未打开文档';
  return <section className={`pl-content-frame pl-markdown-reader ${className}`} aria-label="Markdown 阅读器" style={style}>
    {toolbar !== null ? <header className="pl-content-frame__toolbar">
      {toolbar === undefined ? <>
        <FileText size={18} aria-hidden="true" />
        <div className="pl-content-frame__identity">
          <strong title={fileName}>{fileName}</strong>
          <span title={filePath}>{filePath || 'Markdown 文档'}</span>
        </div>
        <div className="pl-content-frame__actions">
          {actions}
          <Button size="sm" variant="ghost" iconOnly aria-label="打开 Markdown 文件" title="打开 Markdown 文件" disabled={!onOpen || loading} onClick={onOpen}><FolderOpen /></Button>
        </div>
      </> : toolbar}
    </header> : null}
    <ScrollBox className="pl-content-frame__body pl-markdown-reader__reading" aria-label="Markdown 阅读内容" aria-busy={loading}>
      {hasDocument ? content.length ? <article className="pl-markdown-reader__document"><MarkdownRenderer content={content} /></article>
        : <FrameState icon={<FileText />} title="这个文档是空的">文件已打开，没有可显示的内容。</FrameState>
        : <FrameState icon={loading ? <LoaderCircle className="pl-content-frame__spinner" /> : <FileText />}
          title={loading ? '正在读取文档' : error ? '无法读取文档' : '尚未打开文档'}>
          {loading ? '内容准备好后将在这里显示。' : error || '打开一个 Markdown 文件，在这里阅读。'}
        </FrameState>}
    </ScrollBox>
    <footer className="pl-content-frame__statusbar">
      <span role="status" title={status}>{status}</span>
      <Button size="sm" variant="text" onClick={onRetry} disabled={loading || !error || !onRetry}
        style={{ visibility: error && onRetry ? 'visible' : 'hidden' }}>重试</Button>
    </footer>
  </section>;
}
