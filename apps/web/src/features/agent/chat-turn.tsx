import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CITATION_LINK_PREFIX, type ReplyFeedbackInput } from '@plotloom/contracts';
import { UserMessageBubble } from '@plotloom/ui/user-message-bubble';
import { AgentActivityHeader } from '@plotloom/ui/agent-activity-header';
import { ExecutionTimeline } from '@plotloom/ui/execution-timeline';
import { MarkdownRenderer } from '@plotloom/ui/markdown';
import { MessageActions } from '@plotloom/ui/message-actions';
import { FileChangeSummary } from '@plotloom/ui/file-change-summary';
import { AttachmentCard } from '@plotloom/ui/attachment-card';
import type { OpenTurnChanges } from '../workspace/chat-workspace';
import { MessageStatus } from '@plotloom/ui/message-status';
import { CitationMarker } from '@plotloom/ui/citation-marker';
import { SourceReference } from '@plotloom/ui/source-reference';
import { AttachmentPreview } from './attachment-preview';
import { SentChapterQuotes } from './chapter-quotes';
import type { ChatTurn as Turn } from './chat-turns';
import { notifyRequestError } from '../../utils/feedback';
import type { OpenCitations } from '../workspace/citation-sources-page';
import type { OpenDeliverable } from '../workspace/deliverable-page';
import { deliverableLinks } from './deliverable-links';

/** 过程说明可能包含未完成的回答增量；先隐藏保留标记，等待最终校验。 */
function hidePendingCitation(href: string) {
  return href.startsWith(CITATION_LINK_PREFIX) ? null : undefined;
}

/** 单轮业务组合：来源、重试目标来自公开契约，通用组件不感知会话或后端。 */
export function ChatTurn({ turn, onRetry, onFeedbackChange, busy, onOpenCitations, onOpenTurnChanges, onOpenDeliverable }: {
  turn: Turn; onRetry?: () => Promise<void>; busy: boolean; onOpenCitations: OpenCitations; onOpenTurnChanges: OpenTurnChanges;
  onFeedbackChange?: (turnId: string, feedback: ReplyFeedbackInput) => Promise<void>;
  onOpenDeliverable: OpenDeliverable;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const citations = turn.citations;
  const fileChanges = turn.fileChanges;
  const deliverables = useMemo(() => deliverableLinks(turn.answer), [turn.answer]);
  /** 文件链接与卡片共用工作区入口，引用标记继续由后端校验记录解析。 */
  const renderLink = useCallback((href: string, children: ReactNode) => {
    const file = deliverables.resolve(href);
    if (file) return <a href={href} title={file.path + '（Shift + 左键在外部打开）'} onClick={event => {
      event.preventDefault();
      onOpenDeliverable(file, event.shiftKey && event.detail > 0);
    }}>{children}</a>;
    if (!href.startsWith(CITATION_LINK_PREFIX)) return undefined;
    const source = citations.get(href.slice(CITATION_LINK_PREFIX.length));
    return source ? <CitationMarker index={source.index} sourceTitle={source.title}
      onActivate={() => onOpenCitations(citations, source.id)} /> : null;
  }, [citations, deliverables, onOpenCitations, onOpenDeliverable]);
  /** 文件行和整体入口共用当前轮次范围，只改变初始展开的写入记录。 */
  function viewChanges(path?: string) {
    if (!fileChanges) return;
    onOpenTurnChanges(turn.id, fileChanges.flatMap(file => file.writeIds),
      fileChanges.find(file => file.path === path)?.writeIds);
  }
  const working = turn.phase === 'working';
  const userText = turn.user?.content.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? '';
  const attachments = turn.user?.attachments ?? [];
  const quotedSelections = turn.user?.references?.filter(reference => reference.editComment !== undefined) ?? [];
  // 过程区提供运行反馈，回答下方的状态行只提供失败与停止后的恢复操作。
  const status = turn.phase === 'failed' ? 'failed' : turn.phase === 'stopped' ? 'stopped' : null;
  return <section className="plotloom-chat__turn" data-turn-id={turn.id}>
    {turn.user ? <UserMessageBubble text={userText}
      attachments={attachments.length || turn.fileReferences.length || quotedSelections.length ? <>
        {attachments.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment} />)}
        {quotedSelections.length ? <SentChapterQuotes references={quotedSelections} /> : null}
        {turn.fileReferences.length ? <SourceReference sources={turn.fileReferences} selectedId={selectedFile} onSelectedChange={setSelectedFile} /> : null}
      </> : undefined} /> : null}
    {userText.trim() && <MessageActions text={userText} subject="消息" style={{ marginInlineStart: 'auto' }}
      onError={(_action, error) => notifyRequestError(error, 'chat-actions')} />}
    <div className="plotloom-chat__response">
      <AgentActivityHeader phase={turn.phase} activity={turn.activity} visualHeight={240}>
        <ExecutionTimeline items={turn.process} streaming={working} phase={turn.phase} elapsedSeconds={turn.user?.elapsedSeconds}
          height={192} renderMessageLink={hidePendingCitation} />
      </AgentActivityHeader>
      {turn.answer ? <MarkdownRenderer content={turn.answer} renderLink={renderLink} transformLink={deliverables.transform} /> : null}
      {deliverables.files.length ? <section className="plotloom-chat__deliverables" aria-label="交付产物">
        <div className="plotloom-chat__deliverable-list">
          {deliverables.files.map(file => <AttachmentCard key={file.path} name={file.name}
            openHint={file.path + '（Shift + 左键在外部打开）'}
            onOpen={event => onOpenDeliverable(file, event.shiftKey && event.detail > 0)} />)}
        </div>
      </section> : null}
      {fileChanges?.length ? <div className="plotloom-chat__file-summary">
        <FileChangeSummary files={fileChanges} onViewChanges={viewChanges} onOpenFile={viewChanges} />
      </div> : null}
      {/* 回复正文与变更摘要后才显示操作，状态行只在需要恢复操作的终态出现。 */}
      <MessageActions text={turn.answer} onRegenerate={turn.phase === 'completed' ? onRetry : undefined} regenerateDisabled={busy}
        feedback={turn.feedback} feedbackDisabled={busy}
        onFeedbackChange={onFeedbackChange && turn.user && turn.phase === 'completed' && turn.answer.trim()
          ? feedback => onFeedbackChange(turn.id, feedback) : undefined}
        style={{ visibility: turn.phase === 'completed' ? undefined : 'hidden' }}
        onError={(_action, error) => notifyRequestError(error, 'chat-actions')} />
      {status ? <MessageStatus status={status} onRetry={onRetry} retryDisabled={busy}
        onRetryError={error => notifyRequestError(error, 'chat-retry')} /> : null}
    </div>
  </section>;
}
