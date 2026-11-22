import { useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import type { DocumentListEntry, DocumentView } from '@plotloom/contracts/workspaces';
import { ActionMenuItem } from '@plotloom/ui/action-menu';
import { DocumentListItem } from '@plotloom/ui/document-list-item';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

/** 两个目录共享选中、定位与回收的交互。确认框位于目录浮层外，避免移开指针时随其收起。 */
export function useManuscriptDirectory(base: string, onRecycle: (path: string) => void) {
  const [deleting, setDeleting] = useState<DocumentView>();
  const [busy, setBusy] = useState(false);
  async function requestDelete(path: string) {
    try { setDeleting(await requestJson<DocumentView>(base + '/document/read', 'POST', { path })); }
    catch (cause) { notifyRequestError(cause, 'chapter-delete'); }
  }
  async function recycle() {
    if (!deleting || busy) return;
    setBusy(true);
    const result = await runWithToast(() => requestJson(base + '/chapter/recycle', 'POST', { path: deleting.path, baseVersion: deleting.version }),
      { loading: '正在移入回收站…', success: '章节已移入回收站' });
    setBusy(false);
    setDeleting(undefined);
    if (result.ok) onRecycle(deleting.path);
  }
  function row({ path, title, category, selected, onSelect, entry, note, label }: {
    path: string; title: string; category: string; selected: boolean; onSelect: () => void;
    entry?: DocumentListEntry; note?: string; label?: string;
  }) {
    return <DocumentListItem title={title} label={label} category={category} extension=".md" selected={selected}
      date={entry && new Date(entry.modifiedAt).toLocaleDateString('zh-CN')} excerpt={note || entry?.excerpt} onSelect={onSelect}
      actions={entry && <><ActionMenuItem icon={<FolderOpen />} onSelect={() => void runWithToast(() => requestJson(base + '/document/reveal', 'POST', { path }),
        { loading: '正在定位文稿…', success: '已在资源管理器中定位' })}>在资源管理器中打开</ActionMenuItem>
        {path.startsWith('正文章节/') && <ActionMenuItem icon={<Trash2 />} danger onSelect={() => void requestDelete(path)}>删除章节</ActionMenuItem>}</>} />;
  }
  const dialog = deleting && <Dialog open title="删除章节" onOpenChange={value => { if (!value && !busy) setDeleting(undefined); }}
    footer={<><Button variant="ghost" disabled={busy} onClick={() => setDeleting(undefined)}>取消</Button>
      <Button loading={busy} onClick={() => void recycle()}>移入回收站</Button></>}>
    <p>将「{deleting.path}」移入回收站？已留档的定稿记录会保留。</p>
  </Dialog>;
  return { row, dialog };
}
