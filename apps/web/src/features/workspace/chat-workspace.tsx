import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { ManuscriptView } from '@plotloom/contracts/workspaces';
import { BookOpen, FileDiff, FileText, Globe, Image, Link2, ListChecks } from 'lucide-react';
import { WorkspacePanel, type WorkspaceFeature } from '@plotloom/ui/workspace-panel';
import type { WorkspaceTab } from '@plotloom/ui/workspace-tabs';
import { BrowserPage } from './browser-page';
import { MarkdownPage } from './markdown-page';
import { ImagePage } from './image-page';
import { CitationSourcesPage, type OpenCitations } from './citation-sources-page';
import { FileChangesPage } from './file-changes-page';
import { exportManuscript } from '../novels/novel-review';
import { ChapterWorkspace } from '../novels/chapter-workspace';
import { ChapterReviewWorkspace } from '../novels/chapter-candidate';
import { DeliverablePage, requestDeliverable, type OpenDeliverable } from './deliverable-page';
import { notifyRequestError } from '../../utils/feedback';
import type { ChapterQuote, ChapterQuoteDraft } from '../agent/chapter-quote';
import './workspace.css';

export type OpenTurnChanges = (turnId: string, writeIds: readonly string[], expandedWriteIds?: readonly string[]) => void;
const chapterReviewFeature = 'chapter-review';

// 此处决定聊天工作区有哪些功能入口。面板只消费配置与页面插槽。
const chatWorkspaceFeatures: readonly WorkspaceFeature[] = [
  { id: 'browser', title: '浏览器', icon: <Globe />, keywords: ['网页', '网址', 'web', 'url'], page: <BrowserPage /> },
  { id: 'markdown', title: 'Markdown 预览', icon: <FileText />, keywords: ['文档', '文件'], page: <MarkdownPage /> },
  { id: 'image', title: '图片预览', icon: <Image />, keywords: ['图像', '文件'], page: <ImagePage /> },
];

export function ChatWorkspace({ children, open, onOpenChange, sessionId, workspaceId, draftRevision, updatedAt, onAccepted }: {
  children: (openCitations: OpenCitations, openTurnChanges: OpenTurnChanges, openManuscript: (view: ManuscriptView) => boolean,
    openDeliverable: OpenDeliverable, quoteDraft?: ChapterQuoteDraft) => ReactNode;
  open: boolean; onOpenChange: (open: boolean) => void; sessionId: string | null;
  workspaceId: string | null; draftRevision: number; updatedAt?: string; onAccepted: () => void;
}) {
  const quoteScope = JSON.stringify([workspaceId, sessionId, sessionId ? null : draftRevision]);
  const [quotes, setQuotes] = useState<{ scope: string; items: ChapterQuoteDraft['items'] }>({ scope: quoteScope, items: [] });
  const nextQuoteId = useRef(0);
  if (quotes.scope !== quoteScope) setQuotes({ scope: quoteScope, items: [] });
  const addQuote = useCallback((quote: ChapterQuote) => {
    const item = { ...quote, id: ++nextQuoteId.current };
    setQuotes(current => current.scope === quoteScope ? { ...current, items: [...current.items, item] } : current);
  }, [quoteScope]);
  // 发送过程中允许继续准备下一条，收到 accepted 时只移除本次实际提交的引用。
  function removeQuotes(ids: ReadonlySet<number>) {
    setQuotes(current => current.scope === quoteScope ? { ...current, items: current.items.filter(item => !ids.has(item.id)) } : current);
  }
  const quoteDraft: ChapterQuoteDraft | undefined = workspaceId ? {
    items: quotes.scope === quoteScope ? quotes.items : [],
    remove: id => removeQuotes(new Set([id])),
    clearSent: sent => { if (sent.length) removeQuotes(new Set(sent.map(item => item.id))); },
  } : undefined;
  const [requestedTab, setRequestedTab] = useState<{ sessionId: string | null; tab: WorkspaceTab }>();
  const previewRevision = useRef(0);
  const [manuscript, setManuscript] = useState<ManuscriptView>();
  const [review, setReview] = useState<{ workspaceId: string; featureId: string; proposalId: string; path: string; pending: boolean }>();
  const [reviewRevision, setReviewRevision] = useState(0);
  const reviewRequest = review?.workspaceId === workspaceId ? review : undefined;
  const reviewActivation = reviewRequest?.pending ? reviewRequest : undefined;

  /** Agent 的候选定位和编辑器入口共用同一个工作区功能标签。 */
  function openReview(view: Pick<ManuscriptView, 'workspaceId' | 'path'>, proposalId: string) {
    setReview({ workspaceId: view.workspaceId, featureId: chapterReviewFeature, proposalId, path: view.path, pending: true });
    onOpenChange(true);
  }

  function openManuscript(view: ManuscriptView) {
    if (view.workspaceId !== workspaceId) return false;
    if (view.mode === 'export_txt') {
      // 流事件和聊天快照可能先后到达；同一次确认只交给浏览器一次。
      const key = 'plotloom:chapter-download:' + view.downloadId;
      if (sessionStorage.getItem(key)) return true;
      sessionStorage.setItem(key, '1');
      void exportManuscript('/api/workspaces/' + encodeURIComponent(workspaceId), view.path, 'TXT');
      return true;
    }
    if (view.proposalId) {
      openReview(view, view.proposalId);
      return true;
    }
    setManuscript(view);
    onOpenChange(true);
    return true;
  }
  const manuscriptRequest = manuscript?.workspaceId === workspaceId ? manuscript : undefined;
  // 来自聊天的临时标签随聊天切换清除，手动打开的工作区标签继续保留。
  if (requestedTab && requestedTab.sessionId !== sessionId) setRequestedTab(undefined);
  const openCitations = useCallback<OpenCitations>((sources, selectedId) => {
    setRequestedTab({ sessionId, tab: {
      id: 'citation-sources', title: '引用来源', icon: <Link2 />,
      page: <CitationSourcesPage selection={{ sources, selectedId }} />,
    } });
    onOpenChange(true);
  }, [sessionId, onOpenChange]);
  const openTurnChanges = useCallback<OpenTurnChanges>((turnId, writeIds, expandedWriteIds) => {
    // 每次点击都应用新的展开选择，连点同一入口也会重新定位或收起。
    const selection = new Set(expandedWriteIds);
    setRequestedTab({ sessionId, tab: { id: 'turn-file-diff', title: '本轮文件对比', icon: <FileDiff />,
      page: <FileChangesPage key={turnId} sessionId={sessionId} writeIds={writeIds} selection={selection} />,
    } });
    onOpenChange(true);
  }, [sessionId, onOpenChange]);
  /** 普通点击选中工作区预览。组合键仅请求本机打开，失败由现有 toast 反馈。 */
  const openDeliverable = useCallback<OpenDeliverable>((file, external) => {
    if (!sessionId) return;
    if (external) {
      void requestDeliverable(sessionId, { path: file.path, action: 'open' })
        .catch(error => notifyRequestError(error, 'chat-deliverable-open'));
      return;
    }
    setRequestedTab({ sessionId, tab: { id: 'deliverable-preview', title: file.name, icon: <FileText />,
      page: <DeliverablePage key={++previewRevision.current} sessionId={sessionId} file={file} /> } });
    onOpenChange(true);
  }, [sessionId, onOpenChange]);
  return <WorkspacePanel className="plotloom-workspace" primaryFeatureId={workspaceId ? 'chapters' : undefined} primaryRequest={manuscriptRequest}
    featureRequest={reviewActivation} features={[
    ...(workspaceId ? [
      { id: 'chapters', title: '正文章节', icon: <BookOpen />, keywords: ['小说', '文稿', '编辑'],
        page: <ChapterWorkspace key={workspaceId} workspaceId={workspaceId} request={manuscriptRequest} revision={reviewRevision} onQuote={addQuote}
          reviewPath={reviewRequest?.path} onReviewCandidate={reviewRequest ? () => openReview(reviewRequest, reviewRequest.proposalId) : undefined} /> },
      { id: chapterReviewFeature, title: '候选章节审阅', icon: <ListChecks />, keywords: ['候选', '差异', '采纳', '拒绝'], singleton: true,
        page: <ChapterReviewWorkspace key={workspaceId} workspaceId={workspaceId} request={reviewActivation} onOpened={() => {
          setReview(current => current && current === reviewActivation ? { ...current, pending: false } : current);
        }} onAccepted={() => {
          setReviewRevision(value => value + 1);
          onAccepted();
        }} /> },
    ] : []),
    ...chatWorkspaceFeatures,
    { id: 'file-diff', title: '文件对比', icon: <FileDiff />, keywords: ['修改', '变更', 'diff'],
      page: <FileChangesPage key={sessionId} sessionId={sessionId} revision={updatedAt} /> },
  ]} open={open} onOpenChange={onOpenChange}
    requestedTab={requestedTab?.tab}>
    {children(openCitations, openTurnChanges, openManuscript, openDeliverable, quoteDraft)}
  </WorkspacePanel>;
}
