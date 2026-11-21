import { useCallback, useState, type ReactNode } from 'react';
import { FileDiff, FileText, Globe, Image, Link2 } from 'lucide-react';
import { WorkspacePanel, type WorkspaceFeature } from '@plotloom/ui/workspace-panel';
import type { WorkspaceTab } from '@plotloom/ui/workspace-tabs';
import { BrowserPage } from './browser-page';
import { MarkdownPage } from './markdown-page';
import { ImagePage } from './image-page';
import { CitationSourcesPage, type OpenCitations } from './citation-sources-page';
import { FileChangesPage } from './file-changes-page';
import './workspace.css';

export type OpenTurnChanges = (turnId: string, writeIds: readonly string[], expandedWriteIds?: readonly string[]) => void;

// 此处决定聊天工作区有哪些功能入口。面板只消费配置与页面插槽。
const chatWorkspaceFeatures: readonly WorkspaceFeature[] = [
  { id: 'browser', title: '浏览器', icon: <Globe />, keywords: ['网页', '网址', 'web', 'url'], page: <BrowserPage /> },
  { id: 'markdown', title: 'Markdown 预览', icon: <FileText />, keywords: ['文档', '文件'], page: <MarkdownPage /> },
  { id: 'image', title: '图片预览', icon: <Image />, keywords: ['图像', '文件'], page: <ImagePage /> },
];

export function ChatWorkspace({ children, open, onOpenChange, sessionId, projectSession, updatedAt }: {
  children: (openCitations: OpenCitations, openTurnChanges: OpenTurnChanges) => ReactNode;
  open: boolean; onOpenChange: (open: boolean) => void; sessionId: string | null;
  projectSession: boolean; updatedAt?: string;
}) {
  const [requestedTab, setRequestedTab] = useState<{ sessionId: string | null; tab: WorkspaceTab }>();
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
  return <WorkspacePanel className="plotloom-workspace" features={[
    ...chatWorkspaceFeatures,
    { id: 'file-diff', title: '文件对比', icon: <FileDiff />, keywords: ['修改', '变更', 'diff'],
      page: <FileChangesPage key={sessionId} sessionId={projectSession ? sessionId : null} revision={updatedAt} /> },
  ]} open={open} onOpenChange={onOpenChange}
    requestedTab={requestedTab?.tab}>
    {children(openCitations, openTurnChanges)}
  </WorkspacePanel>;
}
