import { useEffect, useState } from 'react';
import type { Attachment, AttachmentContent } from '@plotloom/contracts/sources';
import { Button } from '@plotloom/ui/button';
import { requestJson } from '../../utils/http';

/** 按用户展开操作读取原始资料；文本使用 React 转义，图片限服务端已校验的三种格式。 */
export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<AttachmentContent | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || content) return;
    const abort = new AbortController();
    setError('');
    void requestJson<AttachmentContent>(`/api/sessions/${encodeURIComponent(attachment.sessionId)}/attachments/${encodeURIComponent(attachment.id)}`,
      'GET', undefined, abort.signal).then(value => { if (!abort.signal.aborted) setContent(value); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '附件读取失败'); });
    return () => abort.abort();
  }, [attachment.id, attachment.sessionId, open, content, retry]);
  return <details className="plotloom-chat__attachment" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{attachment.name} · {Math.ceil(attachment.size / 1024)} KB</summary>
    {open ? content ? content.mimeType.startsWith('image/')
      ? <img src={`data:${content.mimeType};base64,${content.data}`} alt={content.name} />
      : <pre>{new TextDecoder().decode(Uint8Array.from(atob(content.data), char => char.charCodeAt(0)))}</pre>
      : error ? <p>{error} <Button variant="text" size="sm" onClick={() => setRetry(value => value + 1)}>重试</Button></p>
        : <p role="status">正在读取附件…</p> : null}
  </details>;
}
