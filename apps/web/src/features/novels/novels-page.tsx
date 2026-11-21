import { useState } from 'react';
import type { Workspace } from '@plotloom/contracts/workspaces';
import { BookOpen, FolderOpen, Plus } from 'lucide-react';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { requestJson } from '../../utils/http';
import { runWithToast } from '../../utils/feedback';
import { NovelWorkbench } from './novel-workbench';
import './novels.css';

interface NovelsPageProps {
  workspaces: Workspace[];
  state: 'loading' | 'ready' | 'error';
  workspaceId: string | null;
  onOpen: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  onRegistered: (workspace: Workspace) => void;
  onSessionsChange: () => Promise<void>;
  onOpenChat: (id: string) => void;
}

/** 正式入口以已登记小说为准，地址中的工作区 ID 允许刷新后回到同一本书。 */
export function NovelsPage({ workspaces, state, workspaceId, onOpen, onRefresh, onRegistered, onSessionsChange, onOpenChat }: NovelsPageProps) {
  const [registering, setRegistering] = useState(false);
  const workspace = workspaces.find(book => book.id === workspaceId);
  if (workspace) return <NovelWorkbench key={workspace.id} workspace={workspace} onBack={() => onOpen(null)}
    onSessionsChange={onSessionsChange} onOpenChat={onOpenChat} />;

  return <PageLayout title="小说管理" style={{ height: '100%' }}
    actions={<Button startIcon={<Plus />} onClick={() => setRegistering(true)}>登记小说</Button>}>
    {state === 'loading' ? <p role="status">正在加载小说…</p> : null}
    {state === 'error' ? <Button variant="secondary" onClick={() => void onRefresh()}>重新加载小说</Button> : null}
    {state === 'ready' && workspaces.length === 0 ? <p className="plotloom-novel-muted">登记已有小说文件夹，即可编辑其中的 Markdown 文稿。</p> : null}
    {state === 'ready' && workspaceId ? <p role="status">找不到该小说，请从列表重新打开。</p> : null}
    <ul className="plotloom-novel-library" aria-label="已登记小说">
      {workspaces.map(book => <li key={book.id}>
        <div><h2>{book.title}</h2><p>{book.root}</p></div>
        <Button variant="secondary" startIcon={<BookOpen />} aria-label={'打开 ' + book.title} onClick={() => onOpen(book.id)}>打开</Button>
      </li>)}
    </ul>
    {registering ? <RegisterNovel onClose={() => setRegistering(false)} onRegistered={book => {
      onRegistered(book);
      setRegistering(false);
      onOpen(book.id);
    }} /> : null}
  </PageLayout>;
}

/** 小说登记只提交现有本机目录；目录归属和重叠检测由工作区接口处理。 */
function RegisterNovel({ onClose, onRegistered }: { onClose: () => void; onRegistered: (workspace: Workspace) => void }) {
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
  async function register() {
    setBusy('save');
    const result = await runWithToast(() => requestJson<Workspace>('/api/workspaces', 'POST', { title: title.trim(), root: root.trim() }),
      { loading: '正在登记小说…', success: '已登记小说' });
    setBusy(null);
    if (result.ok) onRegistered(result.value);
  }
  return <Dialog open title="登记小说" onOpenChange={open => { if (!open && !busy) onClose(); }}
    footer={<><Button variant="ghost" disabled={!!busy} onClick={onClose}>取消</Button>
      <Button loading={busy === 'save'} disabled={!!busy || !title.trim() || !root.trim()} onClick={() => void register()}>登记并打开</Button></>}>
    <div className="plotloom-novel-fields">
      <label>小说名称<Input autoFocus value={title} onValueChange={setTitle} disabled={!!busy} /></label>
      <label>本机文件夹<Input value={root} onValueChange={setRoot} disabled={!!busy} placeholder="输入已有文件夹的绝对路径" /></label>
      <Button startIcon={<FolderOpen />} variant="secondary" disabled={!!busy} loading={busy === 'pick'} onClick={() => void pick()}>选择文件夹</Button>
    </div>
  </Dialog>;
}
