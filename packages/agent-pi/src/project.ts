import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { ProjectFiles } from '@plotloom/contracts';
import { AgentError } from './errors.ts';

/** 工具直接采用 Pi 原生实现；项目路径是默认 cwd，不提供沙箱或审批承诺。 */
export const PROJECT_TOOLS = ['read', 'grep', 'find', 'ls', 'edit', 'write', process.platform === 'win32' ? 'powershell' : 'bash'];
/** 不创建用户目录；只有显式提交的现存绝对目录能成为新会话的项目。 */
export async function validateProjectPath(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new AgentError(422, 'PROJECT_PATH_INVALID', '项目目录必须是绝对路径。');
  try {
    const canonical = await realpath(path);
    if (!(await stat(canonical)).isDirectory()) throw new Error('not-directory');
    await readdir(canonical);
    return canonical;
  } catch { throw new AgentError(422, 'PROJECT_PATH_INVALID', '项目目录不存在、不是文件夹或无法访问。'); }
}

/** @ 候选只扫描本项目，跳过依赖、版本库和符号链接；截断显式返回，避免大项目阻塞界面。 */
export async function findProjectFiles(root: string, query: string): Promise<ProjectFiles> {
  await validateProjectPath(root);
  const entries: ProjectFiles['entries'] = [];
  const pending = [''];
  const excluded = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next']);
  let visited = 0;
  while (pending.length && visited < 5000 && entries.length < 40) {
    const relative = pending.shift()!;
    let children;
    try { children = await readdir(join(root, relative), { withFileTypes: true }); }
    catch { continue; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (++visited > 5000) break;
      if (child.isSymbolicLink() || excluded.has(child.name)) continue;
      const path = relative ? `${relative}/${child.name}` : child.name;
      if (child.isDirectory()) pending.push(path);
      if (path.toLowerCase().includes(query.toLowerCase()) && (child.isDirectory() || child.isFile())) {
        entries.push({ path, name: child.name, isDirectory: child.isDirectory() });
        if (entries.length === 40) break;
      }
    }
  }
  return { entries, truncated: pending.length > 0 || visited >= 5000 || entries.length === 40 };
}
