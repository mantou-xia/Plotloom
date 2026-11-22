import { useEffect, useState } from 'react';
import type { DeliverableRequest, DeliverableResult } from '@plotloom/contracts';
import { MarkdownReaderFrame } from '@plotloom/ui/markdown-reader-frame';
import { ImageViewerFrame } from '@plotloom/ui/image-viewer-frame';
import type { DeliverableLink } from '../agent/deliverable-links';
import { requestJson } from '../../utils/http';

export type OpenDeliverable = (file: DeliverableLink, external: boolean) => void;

export function requestDeliverable(sessionId: string, body: DeliverableRequest, signal?: AbortSignal) {
  return requestJson<DeliverableResult>('/api/sessions/' + encodeURIComponent(sessionId) + '/deliverable', 'POST', body, signal);
}

/** 标签启动时读取文件。切换产物或离开标签时取消读取，旧结果不会覆盖当前预览。 */
export function DeliverablePage({ sessionId, file }: { sessionId: string; file: DeliverableLink }) {
  const [result, setResult] = useState<DeliverableResult>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    void requestDeliverable(sessionId, { path: file.path, action: 'preview' }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); });
    return () => controller.abort();
  }, [file.path, sessionId]);

  if (result?.kind === 'markdown') return <MarkdownReaderFrame fileName={file.name} filePath={file.path} content={result.content} />;
  if (result?.kind === 'image') return <ImageViewerFrame src={result.src} alt={file.name} />;
  return <section className="plotloom-deliverable-preview" aria-label="交付产物预览" aria-busy={!result && !error}>
    <p role="status">{error ?? (result?.kind === 'unsupported' ? '该文件类型目前不支持预览。' : '正在读取文件…')}</p>
  </section>;
}
