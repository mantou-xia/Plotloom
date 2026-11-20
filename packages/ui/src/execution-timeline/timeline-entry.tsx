import { memo } from 'react';
import { Brain, Info, MessageSquare } from 'lucide-react';
import { ProcessNode } from '../agent-process/process-node.tsx';
import { MarkdownRenderer, type MarkdownRendererProps } from '../markdown/markdown-renderer.tsx';
import { ThinkingContent } from '../thinking-content/thinking-content.tsx';
import { ToolCallItem } from '../tool-call/tool-call-item.tsx';
import type { ExecutionEntry } from './types.ts';

/** 根据公开展示类型组合组件；协议事件如何形成记录由调用方负责。 */
export const TimelineEntry = memo(function TimelineEntry({ item, streaming, onInspect, renderMessageLink }: {
  item: ExecutionEntry; streaming: boolean; onInspect: () => void; renderMessageLink?: MarkdownRendererProps['renderLink'];
}) {
  if (item.type === 'tool') return <ToolCallItem {...item} onExpandedChange={onInspect} />;
  if (item.type === 'thinking') return <ProcessNode title={item.title ?? '思考'} icon={<Brain />} defaultExpanded onExpandedChange={onInspect}>
    <ThinkingContent content={item.content} streaming={streaming && item.streaming === true} />
  </ProcessNode>;
  if (item.type === 'message') return <ProcessNode title={item.title ?? '过程说明'} icon={<MessageSquare />} defaultExpanded onExpandedChange={onInspect}>
    <MarkdownRenderer content={item.content} streaming={streaming && item.streaming === true} renderLink={renderMessageLink} />
  </ProcessNode>;
  return <ProcessNode title={item.title} description={item.description} status={item.status} icon={<Info />} onExpandedChange={onInspect}>
    {item.content ? <MarkdownRenderer content={item.content} /> : null}
  </ProcessNode>;
});
