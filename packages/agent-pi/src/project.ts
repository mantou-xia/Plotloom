import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { ProjectFiles } from '@plotloom/contracts';
import { AgentError } from './errors.ts';
import { projectTarget } from './project-tools.ts';

/** 聊天链接只可指向绑定目录内的普通文件，复用项目工具的链接和敏感路径检查。 */
export async function resolveDeliverable(root: string, dataDir: string, input: string) {
  if (!input || /^[\\/]|[:\u0000-\u001f]/u.test(input)) {
    throw new AgentError(400, 'INVALID_REQUEST', '交付产物需要使用相对文件路径。');
  }
  try {
    const { path } = projectTarget(root, await realpath(dataDir), input.replaceAll('\\', '/'));
    const info = await stat(path);
    if (info.isFile()) return { path, size: info.size };
  } catch { /* 统一不可读与范围外的结果，避免泄露宿主路径。 */ }
  throw new AgentError(404, 'DELIVERABLE_UNAVAILABLE', '文件不存在或无法访问。');
}

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
export async function findProjectFiles(root: string, query: string, dataDir: string): Promise<ProjectFiles> {
  await validateProjectPath(root);
  const privateRoot = await realpath(dataDir);
  try { projectTarget(root, privateRoot, '.'); }
  catch { throw new AgentError(403, 'PROJECT_FILES_UNAVAILABLE', '项目资料不在允许访问的范围。'); }
  const entries: ProjectFiles['entries'] = [];
  const pending = [''];
  const excluded = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', '.next']);
  let visited = 0;
  while (pending.length && visited < 5000 && entries.length < 40) {
    const relative = pending.shift()!;
    let children;
    try { children = await readdir(projectTarget(root, privateRoot, relative).path, { withFileTypes: true }); }
    catch { continue; }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (++visited > 5000) break;
      if (child.isSymbolicLink() || excluded.has(child.name)) continue;
      const path = relative ? `${relative}/${child.name}` : child.name;
      try { projectTarget(root, privateRoot, path); } catch { continue; }
      if (child.isDirectory()) pending.push(path);
      if (path.toLowerCase().includes(query.toLowerCase()) && (child.isDirectory() || child.isFile())) {
        entries.push({ path, name: child.name, isDirectory: child.isDirectory() });
        if (entries.length === 40) break;
      }
    }
  }
  return { entries, truncated: pending.length > 0 || visited >= 5000 || entries.length === 40 };
}
