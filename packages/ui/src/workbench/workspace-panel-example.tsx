import { useState, type CSSProperties } from 'react';
import { BookOpen, FileText, Globe } from 'lucide-react';
import { WorkspacePanel, type WorkspaceFeature } from '../workspace-panel/workspace-panel.tsx';
import { Button } from '../button/button.tsx';

const features: readonly WorkspaceFeature[] = [
  { id: 'web', title: '网页', icon: <Globe />, page: <p>网页内容插槽</p> },
  { id: 'file', title: '文档', icon: <FileText />, keywords: ['文件'], page: <p>文档内容插槽</p> },
  { id: 'outline', title: '目录', icon: <BookOpen />, page: <p>目录内容插槽</p> },
];

export function WorkspacePanelExample({ state, style, onAction }: { state: string; style: CSSProperties; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(true);
  const [featureRequest, setFeatureRequest] = useState<{ featureId: string }>();
  const single = state === 'feature-request';
  return <WorkspacePanel open={open} style={style} featureRequest={featureRequest}
    features={state === 'limited' ? features.slice(0, 1) : single ? features.map(item => ({ ...item, singleton: item.id === 'file' })) : features}
    onOpenChange={next => { setOpen(next); onAction(`onOpenChange(${next})`); }}>
    {single ? <Button onClick={() => { setFeatureRequest({ featureId: 'file' }); setOpen(true); }}>定位文档标签</Button> : <p>主内容插槽</p>}
  </WorkspacePanel>;
}
