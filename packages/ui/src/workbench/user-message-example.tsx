import type { CSSProperties } from 'react';
import { UserMessageBubble } from '../user-message/user-message-bubble.tsx';
import { MessageAttachmentSamples } from './attachment-example.tsx';
import type { PreviewControls } from './controls.ts';

/** 消息通过插槽组合真实缩略图与共享文件卡片；发送后不提供草稿移除操作。 */
export function UserMessageExample({ controls, style, onAction }: {
  controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  return <UserMessageBubble text={controls.userMessageText} style={style}
    attachments={controls.userMessageAttachments ? <MessageAttachmentSamples onAction={onAction} /> : undefined} />;
}
