import { execFile, spawn } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { WorkspaceError } from '@plotloom/domain';
const run = promisify(execFile);

/** 以字面路径选中文稿；Windows Shell 只接收已由工作区解析的文件。 */
export async function revealManuscript(path: string) {
  if (process.platform !== 'win32') throw new WorkspaceError('PLATFORM_UNSUPPORTED', '需要 Windows 资源管理器。', 422);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'explorer.exe'), ['/select,"' + path + '"'], { windowsVerbatimArguments: true, windowsHide: true, stdio: 'ignore' });
    child.once('error', () => reject(new WorkspaceError('EXPLORER_FAILED', '无法定位文稿。', 500)));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

/** 在系统操作前重新校验版本；明确使用回收站模式，失败时向调用方报告。 */
export async function recycleManuscript(path: string, version: string) {
  if (process.platform !== 'win32') throw new WorkspaceError('PLATFORM_UNSUPPORTED', '需要 Windows 回收站。', 422);
  const command = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ErrorActionPreference = 'Stop'; "
    + "Add-Type -AssemblyName Microsoft.VisualBasic; $p = $env:PLOTLOOM_CHAPTER; "
    + "if (-not [Environment]::UserInteractive -or ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($p))).DriveType -ne 'Fixed') { exit 4 }; "
    + "$stream = [IO.File]::Open($p, 'Open', 'Read', 'Read, Delete'); $sha = [Security.Cryptography.SHA256]::Create(); "
    + "try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', ''); "
    + "if ($hash -ne $env:PLOTLOOM_CHAPTER_VERSION) { exit 3 }; "
    + "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException') "
    + "} finally { $sha.Dispose(); $stream.Dispose() }";
  try {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      env: { ...process.env, PLOTLOOM_CHAPTER: path, PLOTLOOM_CHAPTER_VERSION: version }, windowsHide: true,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 3) throw new WorkspaceError('REVISION_CONFLICT', '章节已更新，请刷新后重新确认。');
    throw new WorkspaceError('RECYCLE_FAILED', '无法将章节移入回收站，请检查文件占用和权限。');
  }
}
