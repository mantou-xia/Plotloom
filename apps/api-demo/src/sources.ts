import { SOURCE_LIMITS, type AttachmentType, type UploadAttachmentRequest } from '@plotloom/contracts/sources';
import { isObject } from './client.ts';

const mimeTypes: Record<string, AttachmentType> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown' };

/** 仅把用户选中的浏览器文件编码进可编辑草稿；上传仍由发送按钮显式触发。 */
export async function uploadDraft(file: File): Promise<UploadAttachmentRequest> {
  const mimeType = mimeTypes[file.name.split('.').at(-1)!.toLowerCase()];
  if (!mimeType) throw new Error('请选择 PNG、JPEG、WebP、TXT 或 Markdown。');
  const limit = mimeType.startsWith('image/') ? SOURCE_LIMITS.imageBytes : SOURCE_LIMITS.textBytes;
  if (!file.size || file.size > limit) throw new Error(`文件不能为空，且不得超过 ${limit / 1024 / 1024} MiB。`);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('文件读取失败，请重新选择。'));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType, data };
}

/** 预览仅接受约定的图片/文本 MIME，文件名与文本始终转义，不执行附件中的标记。 */
export function attachmentPreview(body: unknown, escape: (value: unknown) => string): string {
  if (!isObject(body) || typeof body.data !== 'string' || typeof body.mimeType !== 'string') return '';
  const heading = `<h3>附件预览 · ${escape(body.name)}</h3>`;
  if (['image/png', 'image/jpeg', 'image/webp'].includes(body.mimeType)) {
    return `<section class="generated">${heading}<img class="attachment-preview" alt="${escape(body.name)}" src="data:${body.mimeType};base64,${escape(body.data)}" /></section>`;
  }
  if (!['text/plain', 'text/markdown'].includes(body.mimeType)) return '';
  try {
    const bytes = Uint8Array.from(atob(body.data), char => char.charCodeAt(0));
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return `<section class="generated">${heading}<div class="generated-text">${escape(text)}</div></section>`;
  } catch { return '<p class="result-error">附件内容无法解码，请检查原始响应。</p>'; }
}

/** 将来源追加到发送草稿，不发送请求；保留用户文字和其他选中的来源。 */
export function appendSourceDraft(draft: string, key: 'attachmentIds' | 'references', source: unknown): string {
  const body: unknown = JSON.parse(draft);
  if (!isObject(body)) throw new Error('消息草稿必须是 JSON 对象。');
  const items = Array.isArray(body[key]) ? body[key] : [];
  if (!items.some(item => JSON.stringify(item) === JSON.stringify(source))) items.push(source);
  body[key] = items;
  return JSON.stringify(body, null, 2);
}
