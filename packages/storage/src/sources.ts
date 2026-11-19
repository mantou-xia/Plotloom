import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireId, WorkspaceError } from '@plotloom/domain';
import type { AttachmentStore } from '@plotloom/application/sources';
import type { Attachment, AttachmentContent } from '@plotloom/contracts/sources';

/** 文件和元信息作为一个不可变记录原子保存，避免上传中断留下可见但不可读取的附件。 */
export class FileAttachmentStore implements AttachmentStore {
  private readonly root: string;
  constructor(dataDir: string) { this.root = resolve(dataDir, 'attachments'); }
  private directory(sessionId: string) { requireId(sessionId); return join(this.root, sessionId); }
  private path(sessionId: string, id: string) { requireId(id); return join(this.directory(sessionId), `${id}.json`); }
  async save(file: AttachmentContent) {
    const path = this.path(file.sessionId, file.id);
    await mkdir(this.directory(file.sessionId), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(file), { encoding: 'utf8', flag: 'wx', flush: true }); await rename(temporary, path); }
    finally { await rm(temporary, { force: true }); }
  }
  async read(sessionId: string, id: string): Promise<AttachmentContent> {
    try {
      const file: AttachmentContent = JSON.parse(await readFile(this.path(sessionId, id), 'utf8'));
      if (file.sessionId !== sessionId || file.id !== id) throw new WorkspaceError('ATTACHMENT_INVALID', '附件记录无效。', 500);
      return file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkspaceError('ATTACHMENT_NOT_FOUND', '附件不存在或不属于当前会话。', 404);
      throw error;
    }
  }
  async list(sessionId: string): Promise<Attachment[]> {
    let files: string[];
    try { files = await readdir(this.directory(sessionId)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    const result: Attachment[] = [];
    for (const name of files.filter(name => name.endsWith('.json'))) {
      // 列表与删除可同时发生，消失的条目不再展示。
      try { const { data: _data, ...file } = await this.read(sessionId, name.slice(0, -5)); result.push(file); }
      catch (error) { if (!(error instanceof WorkspaceError && error.code === 'ATTACHMENT_NOT_FOUND')) throw error; }
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async remove(sessionId: string, id: string) { await rm(this.path(sessionId, id)); }
}
