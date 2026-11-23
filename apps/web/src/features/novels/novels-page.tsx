import { useState } from 'react';
import type { Workspace } from '@plotloom/contracts/workspaces';
import { FolderOpen, Plus } from 'lucide-react';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { Skeleton } from '@plotloom/ui/skeleton';
import { requestJson } from '../../utils/http';
import { runWithToast } from '../../utils/feedback';
import { NovelWorkbench } from './novel-workbench';
import { NovelShelf } from './novel-shelf';
import './novels.css';

interface NovelsPageProps {
  workspaces: Workspace[];
  state: 'loading' | 'ready' | 'error';
  workspaceId: string | null;
  onOpen: (id: string | null) => void;
  onUpdate: (book: Workspace) => void;
  onRefresh: () => Promise<void>;
  onCreate: () => void;
}

/** 正式入口以已登记小说为准，地址中的工作区 ID 允许刷新后回到同一本书。 */
export function NovelsPage({ workspaces, state, workspaceId, onOpen, onUpdate, onRefresh, onCreate }: NovelsPageProps) {
  const workspace = workspaces.find(book => book.id === workspaceId);
  if (workspace) return <NovelWorkbench key={workspace.id} workspace={workspace} onBack={() => onOpen(null)} />;

  return <PageLayout title="小说管理" gap={36} style={{ height: '100%' }}
    actions={<Button startIcon={<Plus />} onClick={onCreate}>新建小说</Button>}>
    {state === 'loading' && !workspaces.length ? <div className="plotloom-shelf-grid" aria-label="小说列表" aria-busy="true">
      <Skeleton style={{ blockSize: 'auto', aspectRatio: '5 / 7' }} />
      <Skeleton style={{ blockSize: 'auto', aspectRatio: '5 / 7' }} />
    </div> : null}
    {state === 'error' ? <Button variant="secondary" onClick={() => void onRefresh()}>重新加载小说</Button> : null}
    {state === 'ready' && workspaces.length === 0 ? <p className="plotloom-novel-muted">新建小说并绑定空文件夹，即可开始创作。</p> : null}
    {state === 'ready' && workspaceId ? <p role="status">找不到该小说，请从列表重新打开。</p> : null}
    {workspaces.length > 0 && <NovelShelf books={workspaces} onOpen={onOpen} onUpdate={onUpdate} />}
  </PageLayout>;
}

/** 两个建书入口共用此表单，由后端检查空目录并创建小说目录。 */
export function CreateNovelDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (workspace: Workspace) => void }) {
  const [title, setTitle] = useState('');
  const [root, setRoot] = useState('');
  const [busy, setBusy] = useState<'pick' | 'save' | null>(null);
  async function pick() {
    setBusy('pick');
    const result = await runWithToast(() => requestJson<{ path: string | null }>('/api/projects/select-folder', 'POST', {}),
      { loading: '请在系统窗口中选择文件夹…', success: value => value.path ? '已选择文件夹' : '已关闭文件夹选择' });
    if (result.ok && result.value.path) setRoot(result.value.path);
    setBusy(null);
  }
  async function create() {
    setBusy('save');
    const result = await runWithToast(() => requestJson<Workspace>('/api/workspaces', 'POST', { title: title.trim(), root: root.trim() }),
      { loading: '正在创建小说…', success: '小说已创建' });
    setBusy(null);
    if (result.ok) onCreated(result.value);
  }
  return <Dialog open title="新建小说" description="选择空文件夹，系统将在其中创建大纲、正文章节和角色卡目录。" onOpenChange={open => { if (!open && !busy) onClose(); }}
    footer={<><Button variant="ghost" disabled={!!busy} onClick={onClose}>取消</Button>
      <Button loading={busy === 'save'} disabled={!!busy || !title.trim() || !root.trim()} onClick={() => void create()}>创建并开始对话</Button></>}>
    <div className="plotloom-novel-fields">
      <label>小说名称<Input autoFocus value={title} onValueChange={setTitle} disabled={!!busy} /></label>
      <label>本机文件夹<Input value={root} onValueChange={setRoot} disabled={!!busy} placeholder="选择本机空文件夹或输入绝对路径" /></label>
      <Button startIcon={<FolderOpen />} variant="secondary" disabled={!!busy} loading={busy === 'pick'} onClick={() => void pick()}>选择文件夹</Button>
    </div>
  </Dialog>;
}
