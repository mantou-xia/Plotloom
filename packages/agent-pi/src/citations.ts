import { randomUUID } from 'node:crypto';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { CITATION_LINK_PREFIX, type Message, type WebCitation } from '@plotloom/contracts';

/** ID 随工具结果持久化，刷新会话时无需重新访问网页。 */
export function webCitation(url: string, title: string): WebCitation {
  return { id: randomUUID(), title: title || url, url };
}

interface MarkdownNode { type: string; url?: string; children?: readonly MarkdownNode[] }

/** 按正文顺序解析真实 Markdown 链接，代码示例里的标记不会成为引用。 */
function collectCitations(node: MarkdownNode, available: ReadonlyMap<string, WebCitation>, cited: Map<string, WebCitation>) {
  if (node.type === 'link' && node.url?.startsWith(CITATION_LINK_PREFIX)) {
    const source = available.get(node.url.slice(CITATION_LINK_PREFIX.length));
    if (source) cited.set(source.id, source);
  }
  for (const child of node.children ?? []) collectCitations(child, available, cited);
}

/** 只接受本轮正文之前已成功返回的来源，防止借用历史轮次或模型编造的 ID。 */
export function attachCitations(messages: Message[]) {
  const available = new Map<string, WebCitation>();
  let turnId: string | undefined;
  for (const message of messages) {
    if (message.turnId !== turnId || message.role === 'user') {
      turnId = message.turnId;
      available.clear();
    }
    if (message.role === 'tool') {
      for (const block of message.content) {
        if (block.type === 'tool' && block.status === 'completed' && block.source?.id) {
          const { id, title, url } = block.source;
          available.set(id, { id, title, url });
        }
      }
    }
    if (message.role !== 'assistant' || message.phase !== 'answer' || !available.size) continue;
    const cited = new Map<string, WebCitation>();
    for (const block of message.content) {
      if (block.type === 'text' && block.text.includes(CITATION_LINK_PREFIX)) {
        collectCitations(fromMarkdown(block.text), available, cited);
      }
    }
    if (cited.size) message.citations = [...cited.values()];
  }
}
