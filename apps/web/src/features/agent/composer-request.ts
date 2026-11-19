import type { SubmitMessageRequest } from '@plotloom/contracts';
import type { ComposerMessage } from '@plotloom/ui/task-composer/types';

/** 将编辑器标记还原为可读文字；项目引用是相对路径，由工具读取，不伪造内容快照。 */
export function composerRequest(message: ComposerMessage): SubmitMessageRequest {
  let skillIndex = 0;
  let mentionIndex = 0;
  const text = message.text.replace(/[\uE000\uE001]/g, marker => {
    if (marker === '\uE000') return `$${message.skills[skillIndex++]?.name ?? ''}`;
    const mention = message.mentions[mentionIndex++];
    return `@${mention?.relPath ?? mention?.path ?? mention?.name ?? ''}`;
  }).trim();
  return { text, skillIds: message.skills.map(skill => skill.id), attachmentIds: message.attachments.map(attachment => attachment.id) };
}
