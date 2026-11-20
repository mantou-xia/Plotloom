import type { ReactNode } from 'react';
import { FileText, Globe, Image } from 'lucide-react';
import { WorkspacePanel, type WorkspaceFeature } from '@plotloom/ui/workspace-panel';
import { BrowserPage } from './browser-page';
import { MarkdownPage } from './markdown-page';
import { ImagePage } from './image-page';
import './workspace.css';

// 此处决定聊天工作区有哪些功能入口。面板只消费配置与页面插槽。
const chatWorkspaceFeatures: readonly WorkspaceFeature[] = [
  { id: 'browser', title: '浏览器', icon: <Globe />, keywords: ['网页', '网址', 'web', 'url'], page: <BrowserPage /> },
  { id: 'markdown', title: 'Markdown 预览', icon: <FileText />, keywords: ['文档', '文件'], page: <MarkdownPage /> },
  { id: 'image', title: '图片预览', icon: <Image />, keywords: ['图像', '文件'], page: <ImagePage /> },
];

export function ChatWorkspace({ children, open, onOpenChange }: { children: ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <WorkspacePanel className="plotloom-workspace" features={chatWorkspaceFeatures} open={open} onOpenChange={onOpenChange}>
    {children}
  </WorkspacePanel>;
}
