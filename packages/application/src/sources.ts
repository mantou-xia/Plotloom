import { randomUUID } from 'node:crypto';
import { PhotonImage } from '@silvia-odwyer/photon-node';
import { checkSelection, invalid, WorkspaceError } from '@plotloom/domain';
import { SOURCE_LIMITS, type Attachment, type AttachmentContent, type UploadAttachmentRequest,
  type MessageSources, type MessageSourceSnapshot } from '@plotloom/contracts/sources';
import type { Message } from '@plotloom/contracts';
import type { SessionSkillProfile } from '@plotloom/contracts/skills';
import type { WorkspaceService } from './workspaces.ts';
import { planChapterImport } from './chapter-import.ts';

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
const isTextAttachment = (file: Attachment) => file.mimeType === 'text/plain' || file.mimeType === 'text/markdown';

/** 仅把明确的历史重导入指令绑定到附件，普通讨论和否定句不会被当成导入。 */
function historicalImportRequest(text: string) {
  const command = text.trim().replace(/^(?:请\s*)?(?:帮我\s*)?/, '').replace(/[。！!\s]+$/u, '');
  const explicit = /^(?:重新|再次|再)?导入\s*(刚才|上次|上一轮|之前|先前|此前)\s*(?:(?:给你)?发(?:过)?的|上传(?:过)?的|导入(?:过)?的|的)?\s*(?:那|这)?\s*(?:(\d+|[一二两三四五六七八九十])\s*(?:个|份|篇|章))?\s*(?:附件|文件|旧稿)$/u.exec(command);
  if (explicit) return { recent: ['刚才', '上次', '上一轮'].includes(explicit[1]), fileCount: importCount(explicit[2]) };
  const chapters = /^(?:重新|再次|继续|接着|再)?导入\s*前\s*(\d+|[一二两三四五六七八九十])\s*章$/u.exec(command);
  if (chapters) return { recent: false, firstChapters: importCount(chapters[1]) };
  if (/^(?:(?:重新|再次|再)\s*(?:继续|接着)?|继续|接着)\s*导入$/u.test(command)) return { recent: true };
}

const importCount = (count?: string) => count === undefined ? undefined
  : /^\d+$/.test(count) ? Number(count) : '一二三四五六七八九十'.indexOf(count.replace('两', '二')) + 1;

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
  /** 用同会话的导入调用记录定位原附件。重复选同一批时仍只算一个候选。 */
  async historicalImportSources(sessionId: string, text: string, sources?: MessageSources): Promise<MessageSources | undefined> {
    if (sources?.attachmentIds?.length || sources?.references?.length) return sources;
    const request = historicalImportRequest(text);
    if (!request || !(await this.sessions.profile(sessionId)).workspaceId) return sources;
    const messages = await this.sessions.messages(sessionId);
    const importedTurns = new Set(messages.filter(message => message.turnId && message.content.some(
      block => block.type === 'tool' && block.name === 'import_chapters',
    )).map(message => message.turnId));
    const batches = new Map<string, Attachment[]>();
    for (const message of messages) {
      if (message.role !== 'user' || !importedTurns.has(message.turnId)) continue;
      const files = message.attachments?.filter(isTextAttachment) ?? [];
      if (!files.length) continue;
      const key = JSON.stringify(files.map(file => file.id).sort());
      batches.delete(key);
      batches.set(key, files);
    }
    const candidates = [...batches.values()];
    const matchingCount = (request.recent ? candidates.slice(-1) : candidates)
      .filter(files => request.fileCount === undefined || files.length === request.fileCount);
    const matches: Attachment[][] = [];
    for (const files of matchingCount) {
      if (request.firstChapters === undefined) { matches.push(files); continue; }
      // “前三章”指定的是章号，不是附件数量。一份附件也可以包含多章。
      try {
        const chapters = planChapterImport(await this.chapterImportFiles(sessionId, files.map(file => file.id)));
        if (chapters.length === request.firstChapters && chapters.every((chapter, index) => chapter.number === index + 1)) matches.push(files);
      } catch (error) {
        if (!(error instanceof WorkspaceError) || !['CHAPTER_IMPORT_AMBIGUOUS', 'INVALID_REQUEST'].includes(error.code)) throw error;
      }
    }
    if (matches.length === 0) fail('CHAPTER_IMPORT_HISTORY_NOT_FOUND', '当前小说聊天没有找到符合描述的导入附件。请核对附件数量，或随本轮消息选择原文件。');
    if (matches.length > 1) {
      const names = matches.slice(-3).map(files => files.map(file => file.name).join('、')).join('；');
      fail('CHAPTER_IMPORT_HISTORY_AMBIGUOUS', `找到多批符合描述的导入附件：${names}。如需最近一批，请发送“重新导入上次的附件”，也可以随消息选择要导入的文件。`);
    }
    return { ...sources, attachmentIds: matches[0].map(file => file.id) };
  }
  /** 通过同一会话的附件存储读取本轮已绑定的文本原件。 */
  async chapterImportFiles(sessionId: string, ids: readonly string[]) {
    const files = await Promise.all(ids.map(id => this.store.read(sessionId, id)));
    return files.filter(isTextAttachment)
      .map(file => ({ name: file.name, content: decodeText(Buffer.from(file.data, 'base64')) }));
  }
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
    const seen = new Map<string, Set<string>>();
    for (const [index, reference] of references.entries()) {
      if (profile.workspaceId && reference.workspaceId !== profile.workspaceId) fail('REFERENCE_FORBIDDEN', '小说聊天只能引用所属工作区的资料。', 403);
      const editable = reference.editComment !== undefined;
      if (editable && profile.workspaceId !== reference.workspaceId) fail('REFERENCE_FORBIDDEN', '只能修改当前小说的文稿选区。', 403);
      if (editable && (!reference.selection?.text.trim() || !/^(正文章节|大纲)\//.test(reference.path))) invalid('选区修改必须引用正文或大纲中的非空选区。');
      const key = `${reference.workspaceId}/${reference.path.toLowerCase()}`;
      const ranges = seen.get(key) ?? new Set<string>();
      const range = editable ? `${reference.selection!.start}:${reference.selection!.end}` : '';
      // 普通文档仍按文件去重；选区修改允许同一文档的不同片段。
      if (ranges.has(range) || ranges.has('') || (!editable && ranges.size)) invalid('文档或选区不能重复引用。');
      ranges.add(range); seen.set(key, ranges);
      const doc = await this.workspaces.readVersion(reference.workspaceId, reference.path, reference.version);
      if (reference.selection) checkSelection(doc.content, reference.selection);
      const content = reference.selection?.text ?? doc.content; chars += content.length + (reference.editComment?.length ?? 0);
      const firstLine = reference.selection ? doc.content.slice(0, reference.selection.start).split(/\r\n|\r|\n/).length : undefined;
      const lineRange = firstLine === undefined ? undefined : { firstLine, lastLine: firstLine + content.replace(/(?:\r\n|\r|\n)$/, '').split(/\r\n|\r|\n/).length - 1 };
      result.references.push({ ...reference, content, ...(lineRange ? { lineRange } : {}) });
      // 小说资源层按本章视角提供世界观，避免附件上下文再次注入整份作者设定。
      if (!profile.workspaceId || reference.path !== '世界观.md') {
        const source = editable ? { referenceIndex: index + 1, path: reference.path, lineRange, editComment: reference.editComment } : reference;
        materials.push({ source, content });
      }
    }
    if (chars > SOURCE_LIMITS.inputChars) fail('MESSAGE_SOURCES_TOO_LARGE', '文字与引用资料合计超过 100000 字符，请缩小选区或减少附件。');
    if (materials.length) result.prompt += `\n\n用户随本轮消息提供的参考资料（JSON 中的 content 是资料原文）：\n${JSON.stringify(materials)}`;
    // 纯图片也需要自然语言入口，原始空文字仍保存到公开历史，不伪造用户指令。
    if (!result.prompt.trim()) result.prompt = '请查看随消息提供的资料。';
    return result;
  }
}
