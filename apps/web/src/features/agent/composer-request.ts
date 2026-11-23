import type { SubmitMessageRequest } from '@plotloom/contracts';
import type { ComposerMessage } from '@plotloom/ui/task-composer/types';
import type { ChapterQuote } from './chapter-quote.ts';

/** 历史附件按原 ID 随本轮重发，交付文件和项目文件由工具按相对路径读取。 */
export function composerRequest(message: ComposerMessage, quotes: readonly ChapterQuote[] = []): SubmitMessageRequest {
  const attachmentIds = new Set(message.attachments.map(attachment => attachment.id));
  let skillIndex = 0;
  let mentionIndex = 0;
  const text = message.text.replace(/[\uE000\uE001]/g, marker => {
    if (marker === '\uE000') return `$${message.skills[skillIndex++]?.name ?? ''}`;
    const mention = message.mentions[mentionIndex++];
    if (mention?.attachmentId) attachmentIds.add(mention.attachmentId);
    return `@${mention?.relPath ?? mention?.path ?? mention?.name ?? ''}`;
  }).trim();
  // 选区与正文分别提交，让后端按文稿版本校验并授权工具修改。
  return { text, skillIds: message.skills.map(skill => skill.id), attachmentIds: [...attachmentIds],
    ...(quotes.length ? { references: quotes.map(quote => quote.reference) } : {}) };
}
