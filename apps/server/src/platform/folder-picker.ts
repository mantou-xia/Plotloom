import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ProjectFolderSelection } from '@plotloom/contracts';
import { WorkspaceError } from '@plotloom/domain';

export interface FolderPicker {
  select(signal: AbortSignal): Promise<{ path: string | null }>;
  close(): void;
}

/** 原生窗口属于本机后端；前端不接触文件系统。每个服务同时只打开一个选择器。 */
export function createFolderPicker(): FolderPicker {
  let active: AbortController | null = null;
  return {
    close() { active?.abort(); },
    async select(signal: AbortSignal): Promise<ProjectFolderSelection> {
      if (process.platform !== 'win32') throw new WorkspaceError('FOLDER_PICKER_UNAVAILABLE', '当前系统尚未接入原生文件夹选择器。', 501);
      if (active) throw new WorkspaceError('FOLDER_PICKER_BUSY', '文件夹选择窗口已经打开，请先完成或取消选择。', 409);
      const controller = new AbortController();
      active = controller;
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) controller.abort();
      try {
        return await new Promise<ProjectFolderSelection>((resolve, reject) => {
          const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File',
            fileURLToPath(new URL('./select-folder.ps1', import.meta.url))], {
            windowsHide: true, signal: controller.signal, stdio: ['ignore', 'pipe', 'ignore'],
          });
          let output = '';
          child.stdout.setEncoding('utf8');
          child.stdout.on('data', value => { output += value; });
          const failure = () => new WorkspaceError('FOLDER_PICKER_FAILED', '无法打开系统文件夹选择器，请重试。', 500);
          let processError: Error | undefined;
          // AbortError 早于 close；等进程真正退出再释放占用，避免取消后短暂出现两个窗口。
          child.once('error', error => { processError = error; });
          child.once('close', code => {
            if (processError) { reject(controller.signal.aborted ? processError : failure()); return; }
            if (code !== 0) { reject(failure()); return; }
            try { resolve(JSON.parse(output.trim()) as ProjectFolderSelection); } catch { reject(failure()); }
          });
        });
      } finally { signal.removeEventListener('abort', abort); active = null; }
    },
  };
}
