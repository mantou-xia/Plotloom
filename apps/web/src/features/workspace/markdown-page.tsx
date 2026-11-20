import { MarkdownReaderFrame } from '@plotloom/ui/markdown-reader-frame';

/** Markdown 标签只负责文档阅读；项目文件打开接口在后续接入。 */
export function MarkdownPage() {
  return <MarkdownReaderFrame />;
}
