import { useEffect, useState } from 'react';
import type { DocumentView, ExportResult, Revision } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Select } from '@plotloom/ui/select';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

/** 导出正式稿直接下载接口返回的 Markdown，保留原文和行尾。 */
export async function exportManuscript(base: string, path: string) {
  await runWithToast(async () => {
    const { files: [file] } = await requestJson<ExportResult>(base + '/export', 'POST', { files: [{ path }] });
    if (!file) throw new Error('没有可导出的文稿。');
    const url = URL.createObjectURL(new Blob([file.content], { type: 'text/markdown;charset=UTF-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').at(-1) ?? '文稿.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, { loading: '正在导出 Markdown…', success: '已开始下载 Markdown' });
}

/** 先选择并查看历史原文，再用当前文稿的版本恢复；外部变化仍由接口做冲突校验。 */
export function NovelHistory({ base, document, initialId, canRestore, onClose, onRestored }: {
  base: string; document: DocumentView; initialId?: string; canRestore: boolean; onClose: () => void; onRestored: (value: DocumentView) => void;
}) {
  const { path, version } = document;
  const [revisions, setRevisions] = useState<Revision[]>();
  const [id, setId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string }>();
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ revisions: Revision[] }>(base + '/history', 'POST', { path }, controller.signal).then(result => {
      if (!controller.signal.aborted) { setRevisions(result.revisions); setId(result.revisions.find(item => item.id === initialId)?.id ?? result.revisions.at(-1)?.id ?? null); }
    }).catch(cause => notifyRequestError(cause, 'novel-history'));
    return () => controller.abort();
  }, [base, path, initialId]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void requestJson<ExportResult>(base + '/export', 'POST', { files: [{ path, revisionId: id }] }, controller.signal)
      .then(({ files }) => { if (!controller.signal.aborted && files[0]) setPreview({ id, content: files[0].content }); })
      .catch(cause => notifyRequestError(cause, 'novel-history-preview'));
    return () => controller.abort();
  }, [base, path, id]);

  async function restore() {
    if (!id || preview?.id !== id) return;
    setRestoring(true);
    const result = await runWithToast(() => requestJson<DocumentView>(base + '/restore', 'POST', { path, baseVersion: version, revisionId: id }),
      { loading: '正在恢复版本…', success: '已恢复所选定稿' });
    setRestoring(false);
    if (result.ok) onRestored(result.value);
  }

  return <Dialog open title="定稿记录" description={path} className="plotloom-novel-review"
    onOpenChange={open => { if (!open && !restoring) onClose(); }}
    footer={<><Button variant="ghost" disabled={restoring} onClick={onClose}>关闭</Button>
      <Button disabled={!canRestore || !id || preview?.id !== id || restoring} loading={restoring} onClick={() => void restore()}>恢复所选定稿</Button></>}>
    <div className="plotloom-novel-fields">
      <Select aria-label="定稿记录" value={id} clearable={false} disabled={restoring}
        options={(revisions ?? []).map(revision => ({ value: revision.id, label:
          new Date(revision.createdAt).toLocaleString('zh-CN', { hour12: false }) }))} onValueChange={setId} />
      <pre aria-label="定稿预览" className="plotloom-novel-preview">{preview?.id === id ? preview.content :
        revisions?.length === 0 ? '此文稿还没有定稿。' : '正在读取定稿…'}</pre>
    </div>
  </Dialog>;
}
