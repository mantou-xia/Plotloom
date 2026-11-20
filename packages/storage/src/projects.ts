import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { CreateProjectRequest, Project } from '@plotloom/contracts';
import { WorkspaceError } from '@plotloom/domain';

/** 独立项目登记，不向用户选中的源目录写入内容，也不隐式创建聊天。 */
export class FileProjectStore {
  private readonly root: string;
  private readonly file: string;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(dataDir: string) { this.root = dataDir; this.file = join(dataDir, 'projects.json'); }

  async list(): Promise<Project[]> {
    try { return JSON.parse(await readFile(this.file, 'utf8')) as Project[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }

  /** 单进程队列覆盖“查重到落盘”，临时文件替换避免半份清单；失败不阻塞下一次创建。 */
  create(input: CreateProjectRequest): Promise<Project> {
    const operation = this.pending.then(async () => {
      const name = input.name.trim();
      if (!name || name.length > 120) throw new WorkspaceError('PROJECT_NAME_INVALID', '项目名称需要 1 至 120 个字符。', 422);
      let path: string;
      try {
        if (!isAbsolute(input.path) || input.path.includes('\0')) throw new Error('absolute path required');
        path = await realpath(input.path);
        if (!(await stat(path)).isDirectory()) throw new Error('directory required');
      } catch { throw new WorkspaceError('PROJECT_PATH_INVALID', '请选择已存在且可访问的本机文件夹。', 422); }
      const projects = await this.list();
      if (projects.some(project => project.path === path)) {
        throw new WorkspaceError('PROJECT_ALREADY_EXISTS', '此文件夹已经添加为项目，请从已有项目中选择。', 409);
      }
      const project: Project = { id: randomUUID(), name, path, createdAt: new Date().toISOString() };
      await mkdir(this.root, { recursive: true });
      await writeFile(this.file + '.tmp', JSON.stringify([project, ...projects], null, 2), 'utf8');
      await rename(this.file + '.tmp', this.file);
      return project;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
}
