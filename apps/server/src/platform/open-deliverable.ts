import { execFile } from 'node:child_process';
import { extname } from 'node:path';
import { AgentError } from '@plotloom/agent-pi';

// 仅允许文档、数据和媒体的系统关联，避免文件名链接直接启动程序、脚本或快捷方式。
const externalExtensions = new Set((
  'md markdown txt log csv tsv json xml pdf doc docx odt rtf xls xlsx ods ppt pptx odp ' +
  'png jpg jpeg gif webp bmp avif svg ico tif tiff ' +
  'zip rar 7z gz tar mp3 wav flac m4a ogg mp4 mov mkv webm'
).split(' '));

/** 系统打开只在用户显式触发后执行，路径通过环境传递，保持路径字符的字面含义。 */
export async function openDeliverableExternally(path: string): Promise<void> {
  if (!externalExtensions.has(extname(path).slice(1).toLowerCase())) {
    throw new AgentError(422, 'DELIVERABLE_OPEN_UNSUPPORTED', '该文件类型暂不支持从应用外部打开。');
  }
  if (process.platform !== 'win32') {
    throw new AgentError(501, 'DELIVERABLE_OPEN_UNAVAILABLE', '外部打开需要 Windows 桌面。');
  }
  await new Promise<void>((resolve, reject) => {
    const command = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Invoke-Item -LiteralPath $env:PLOTLOOM_OPEN_DELIVERABLE -ErrorAction Stop';
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { env: { ...process.env, PLOTLOOM_OPEN_DELIVERABLE: path }, windowsHide: true, timeout: 10000 },
      error => error ? reject(new AgentError(422, 'DELIVERABLE_OPEN_FAILED', '无法用系统默认应用打开此文件。')) : resolve());
  });
}
