import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspaceError } from '@plotloom/domain';

/** 目录由后端按登记 ID 解析。仅传递目录参数，并等待系统成功启动资源管理器。 */
export async function openRegisteredFolder(path: string): Promise<{ opened: boolean }> {
  if (process.platform !== 'win32') throw new WorkspaceError('EXPLORER_UNAVAILABLE', '打开资源管理器需要 Windows 桌面。', 501);
  if (!(await stat(path).catch(() => undefined))?.isDirectory())
    throw new WorkspaceError('FOLDER_UNAVAILABLE', '登记的文件夹已移动或无法访问。', 422);
  await new Promise<void>((resolve, reject) => {
    const explorer = join(process.env.SystemRoot ?? 'C:\\Windows', 'explorer.exe');
    const child = spawn(explorer, [path], { stdio: 'ignore', windowsHide: true });
    child.once('error', () => reject(new WorkspaceError('EXPLORER_FAILED', '无法启动资源管理器。', 500)));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  return { opened: true };
}
