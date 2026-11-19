import { randomUUID } from 'node:crypto';
import { PhotonImage } from '@silvia-odwyer/photon-node';
import { checkSelection, invalid, WorkspaceError } from '@plotloom/domain';
import { SOURCE_LIMITS, type Attachment, type AttachmentContent, type UploadAttachmentRequest,
  type MessageSources, type MessageSourceSnapshot } from '@plotloom/contracts/sources';
import type { Message } from '@plotloom/contracts';
import type { SessionSkillProfile } from '@plotloom/contracts/skills';
import type { WorkspaceService } from './workspaces.ts';

export interface AttachmentStore {
  save(file: AttachmentContent): Promise<void>;
  list(sessionId: string): Promise<Attachment[]>;
  read(sessionId: string, id: string): Promise<AttachmentContent>;
  remove(sessionId: string, id: string): Promise<void>;
}
export interface SourceSessions {
  profile(id: string): Promise<SessionSkillProfile>;
  messages(id: string): Promise<Message[]>;
  idle<T>(id: string, operation: () => Promise<T>): Promise<T>;
}
/** 宿主编译的模型输入只包含通用文本与图片，不依赖 Pi SDK 类型。 */
export interface ResolvedMessageInput extends MessageSourceSnapshot {
  prompt: string;
  images: Array<{ mimeType: string; data: string }>;
}
const fail = (code: string, message: string, status = 422): never => { throw new WorkspaceError(code, message, status); };
const metadata = ({ data: _data, ...file }: AttachmentContent): Attachment => file;
const extensions: Record<string, string[]> = { 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'], 'text/plain': ['txt'], 'text/markdown': ['md', 'markdown'] };

/** 文本必须严格 UTF-8；拒绝常见二进制内容，保留 BOM 和换行作为原始资料。 */
function decodeText(bytes: Uint8Array): string {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return fail('ENCODING_UNSUPPORTED', '附件必须是有效 UTF-8 文本。'); }
  if (text.includes('\0')) fail('ENCODING_UNSUPPORTED', '文本附件不能包含二进制空字符。');
  return text;
}

/** 上传验证真实文件类型及可解码性，不以浏览器 MIME 或扩展名代替内容校验。 */
function validate(input: UploadAttachmentRequest): Buffer {
  if (!input.name.trim() || input.name.length > 200 || /[\\/\x00-\x1f]/.test(input.name)) invalid('附件名称不能为空、过长或包含路径。');
  const extension = input.name.split('.').at(-1)!.toLowerCase();
  if (!extensions[input.mimeType]?.includes(extension)) fail('ATTACHMENT_TYPE_UNSUPPORTED', '仅支持 PNG、JPEG、WebP、TXT 与 Markdown，类型必须与扩展名一致。');
  const image = input.mimeType.startsWith('image/');
  const limit = image ? SOURCE_LIMITS.imageBytes : SOURCE_LIMITS.textBytes;
  if (input.data.length > Math.ceil(limit / 3) * 4) fail('ATTACHMENT_TOO_LARGE', image ? '图片不得超过 10 MiB。' : '文本附件不得超过 1 MiB。');
  const bytes = Buffer.from(input.data, 'base64');
  if (!bytes.length || bytes.toString('base64') !== input.data) invalid('附件必须是非空文件的标准 base64 编码，不包含 data URL 前缀。');
  if (bytes.length > limit) fail('ATTACHMENT_TOO_LARGE', '附件超过允许大小。');
  if (!image) { decodeText(bytes); return bytes; }
  const detected = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : undefined;
  if (detected !== input.mimeType) fail('ATTACHMENT_TYPE_UNSUPPORTED', '图片实际格式与声明类型不符。');
  let decoded: PhotonImage | undefined;
  try { decoded = PhotonImage.new_from_byteslice(bytes); }
  catch { fail('ATTACHMENT_IMAGE_INVALID', '图片无法解码，请重新导出后上传。'); }
  finally { decoded?.free(); }
  return bytes;
}

/** 附件归属当前会话；文档按显式版本编译，仅为本轮提供资料，不授予文件写权限。 */
export class MessageSourceService {
  private readonly store: AttachmentStore;
  private readonly workspaces: WorkspaceService;
  private readonly sessions: SourceSessions;
  constructor(store: AttachmentStore, workspaces: WorkspaceService, sessions: SourceSessions) {
    this.store = store; this.workspaces = workspaces; this.sessions = sessions;
  }
  async upload(sessionId: string, input: UploadAttachmentRequest): Promise<Attachment> {
    await this.sessions.profile(sessionId);
    const bytes = validate(input);
    const file: AttachmentContent = { id: randomUUID(), sessionId, name: input.name, mimeType: input.mimeType,
      size: bytes.length, createdAt: new Date().toISOString(), data: input.data };
    await this.store.save(file); return metadata(file);
  }
  async list(sessionId: string) { await this.sessions.profile(sessionId); return { attachments: await this.store.list(sessionId) }; }
  async read(sessionId: string, id: string) { await this.sessions.profile(sessionId); return this.store.read(sessionId, id); }
  /** 删除与消息准备共用互斥边界；已进入历史的文件保留，避免历史预览失效。 */
  async remove(sessionId: string, id: string) {
    return this.sessions.idle(sessionId, async () => {
      await this.store.read(sessionId, id);
      if ((await this.sessions.messages(sessionId)).some(message => message.attachments?.some(file => file.id === id))) {
        fail('ATTACHMENT_IN_USE', '附件已被消息引用，不能移除；可从下一条消息取消选择。', 409);
      }
      await this.store.remove(sessionId, id); return { id, deleted: true };
    });
  }
  /** 调用方在会话锁内编译，确保读取、提交消息和删除附件不会相互穿插。 */
  async resolve(sessionId: string, text: string, sources: MessageSources): Promise<ResolvedMessageInput> {
    const profile = await this.sessions.profile(sessionId);
    const result: ResolvedMessageInput = { text, prompt: text, attachments: [], references: [], images: [] };
    const attachments = sources.attachmentIds ?? [];
    const references = sources.references ?? [];
    if (attachments.length > SOURCE_LIMITS.attachmentCount || references.length > SOURCE_LIMITS.referenceCount
      || new Set(attachments).size !== attachments.length) invalid('附件或引用数量无效。');
    let bytes = 0;
    let chars = text.length;
    const materials: Array<{ source: unknown; content: string }> = [];
    for (const id of attachments) {
      const file = await this.store.read(sessionId, id); bytes += file.size;
      if (bytes > SOURCE_LIMITS.totalBytes) fail('MESSAGE_SOURCES_TOO_LARGE', '每轮附件合计不得超过 20 MiB。');
      result.attachments.push(metadata(file));
      if (file.mimeType.startsWith('image/')) result.images.push({ mimeType: file.mimeType, data: file.data });
      else {
        const content = decodeText(Buffer.from(file.data, 'base64')); chars += content.length;
        materials.push({ source: metadata(file), content });
      }
    }
    const seen = new Set<string>();
    for (const reference of references) {
      if (profile.workspaceId && reference.workspaceId !== profile.workspaceId) fail('REFERENCE_FORBIDDEN', '小说聊天只能引用所属工作区的资料。', 403);
      const key = `${reference.workspaceId}/${reference.path.toLowerCase()}`;
      if (seen.has(key)) invalid('同一文档不能重复引用。'); seen.add(key);
      const doc = await this.workspaces.readVersion(reference.workspaceId, reference.path, reference.version);
      if (reference.selection) checkSelection(doc.content, reference.selection);
      const content = reference.selection?.text ?? doc.content; chars += content.length;
      result.references.push({ ...reference, content });
      materials.push({ source: reference, content });
    }
    if (chars > SOURCE_LIMITS.inputChars) fail('MESSAGE_SOURCES_TOO_LARGE', '文字与引用资料合计超过 100000 字符，请缩小选区或减少附件。');
    if (materials.length) result.prompt += `\n\n用户随本轮消息提供的参考资料（JSON 中的 content 是资料原文）：\n${JSON.stringify(materials)}`;
    // 纯图片也需要自然语言入口，原始空文字仍保存到公开历史，不伪造用户指令。
    if (!result.prompt.trim()) result.prompt = '请查看随消息提供的资料。';
    return result;
  }
}
