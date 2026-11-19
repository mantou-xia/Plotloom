import type { Selection } from './workspaces.ts';

/** 上传和上下文限额属于公开契约，客户端可提前反馈，服务端仍独立校验。 */
export const SOURCE_LIMITS = { imageBytes: 10 * 1024 * 1024, textBytes: 1024 * 1024,
  attachmentCount: 10, totalBytes: 20 * 1024 * 1024, referenceCount: 20, inputChars: 100000 } as const;
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown'] as const;
export type AttachmentType = typeof ATTACHMENT_TYPES[number];
export interface UploadAttachmentRequest { name: string; mimeType: AttachmentType; data: string }
export interface Attachment { id: string; sessionId: string; name: string; mimeType: AttachmentType; size: number; createdAt: string }
/** data 是原始文件的标准 base64；不返回磁盘路径。 */
export interface AttachmentContent extends Attachment { data: string }
export interface DocumentReference { workspaceId: string; path: string; version: string; selection?: Selection }
/** 保存本轮实际引用的原文或选区，原稿后续变化不改变历史。 */
export interface DocumentReferenceContent extends DocumentReference { content: string }
export interface MessageSources { attachmentIds?: string[]; references?: DocumentReference[] }
export interface MessageSourceSnapshot { text: string; attachments: Attachment[]; references: DocumentReferenceContent[] }
