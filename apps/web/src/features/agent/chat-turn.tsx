import { useCallback, useState } from 'react';
import { CITATION_LINK_PREFIX } from '@plotloom/contracts';
import { UserMessageBubble } from '@plotloom/ui/user-message-bubble';
import { AgentActivityHeader } from '@plotloom/ui/agent-activity-header';
import { ExecutionTimeline } from '@plotloom/ui/execution-timeline';
import { MarkdownRenderer } from '@plotloom/ui/markdown';
import { MessageActions } from '@plotloom/ui/message-actions';
import { MessageStatus } from '@plotloom/ui/message-status';
import { CitationMarker } from '@plotloom/ui/citation-marker';
import { SourceReference } from '@plotloom/ui/source-reference';
import { AttachmentPreview } from './attachment-preview';
import type { ChatTurn as Turn } from './chat-turns';
import { notifyRequestError } from '../../utils/feedback';

/** 过程说明可能包含未完成的回答增量；先隐藏保留标记，等待最终校验。 */
function hidePendingCitation(href: string) {
  return href.startsWith(CITATION_LINK_PREFIX) ? null : undefined;
}

/** 单轮业务组合：来源、重试目标来自公开契约，通用组件不感知会话或后端。 */
export function ChatTurn({ turn, onRetry, busy }: { turn: Turn; onRetry?: () => Promise<void>; busy: boolean }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const citations = turn.citations;
  /** 仅渲染后端校验的正文标记；无效标记省略，普通 Markdown 链接照常渲染。 */
  const renderCitation = useCallback((href: string) => {
    if (!href.startsWith(CITATION_LINK_PREFIX)) return undefined;
    const source = citations.get(href.slice(CITATION_LINK_PREFIX.length));
    return source ? <CitationMarker index={source.index} sourceTitle={source.title} active={selectedCitation === source.id}
      onActivate={() => setSelectedCitation(source.id)} /> : null;
  }, [citations, selectedCitation]);
  const working = turn.phase === 'working';
  const userText = turn.user?.content.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? '';
  const attachments = turn.user?.attachments ?? [];
  // 过程区提供运行反馈，回答下方的状态行只提供失败与停止后的恢复操作。
  const status = turn.phase === 'failed' ? 'failed' : turn.phase === 'stopped' ? 'stopped' : null;
  return <section className="plotloom-chat__turn" data-turn-id={turn.id}>
    {turn.user ? <UserMessageBubble text={userText}
      attachments={attachments.length || turn.fileReferences.length ? <>
        {attachments.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment} />)}
        {turn.fileReferences.length ? <SourceReference sources={turn.fileReferences} selectedId={selectedFile} onSelectedChange={setSelectedFile} /> : null}
      </> : undefined} /> : null}
    {userText.trim() && <MessageActions text={userText} subject="消息" style={{ marginInlineStart: 'auto' }}
      onError={(_action, error) => notifyRequestError(error, 'chat-actions')} />}
    <div className="plotloom-chat__response">
      <AgentActivityHeader phase={turn.phase} activity={turn.activity} visualHeight={240}>
        <ExecutionTimeline items={turn.process} streaming={working} phase={turn.phase} elapsedSeconds={turn.user?.elapsedSeconds}
          height={192} renderMessageLink={hidePendingCitation} />
      </AgentActivityHeader>
      {turn.answer ? <MarkdownRenderer content={turn.answer} renderLink={renderCitation} /> : null}
      {citations.size ? <SourceReference sources={[...citations.values()]} selectedId={selectedCitation} onSelectedChange={setSelectedCitation}
        overviewLabel={`引用来源 · ${citations.size}`} /> : null}
      {/* 回答结束后才显示工具条，保留尺寸以避免状态切换产生额外位移。 */}
      <MessageActions text={turn.answer} onRegenerate={turn.phase === 'completed' ? onRetry : undefined} regenerateDisabled={busy}
        style={{ visibility: turn.phase === 'completed' ? undefined : 'hidden' }}
        onError={(_action, error) => notifyRequestError(error, 'chat-actions')} />
      <MessageStatus status={status} onRetry={onRetry} retryDisabled={busy} onRetryError={error => notifyRequestError(error, 'chat-retry')} />
    </div>
  </section>;
}
