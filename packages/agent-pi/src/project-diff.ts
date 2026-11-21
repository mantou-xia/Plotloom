import { diffLines } from 'diff';
import type { ProjectDiffBlock, ProjectFileChange, ProjectFileDiff, TurnFileChanges } from '@plotloom/contracts';
import { AgentError } from './errors.ts';
import type { WrittenProjectFile } from './project-tools.ts';

export const PROJECT_FILE_WRITE = 'plotloom.project-file-write';
export type ProjectWriteSnapshot = WrittenProjectFile & { id: string };

const lineChanges = (before: string, after: string) => diffLines(before, after, { timeout: 500 });

/** 按行对比实际写入快照，保留换行符与双侧行号，供界面判断文件末尾换行变化。 */
export function compareProjectFile(change: ProjectFileChange, before: string, after: string): ProjectFileDiff {
  const parts = lineChanges(before, after);
  if (!parts) throw new AgentError(422, 'PROJECT_DIFF_TOO_COMPLEX', '文件改动过大，无法在限定时间内生成行级对比。');
  let beforeStart = 1;
  let afterStart = 1;
  let added = 0;
  let removed = 0;
  const blocks = parts.filter(part => part.value.length).map((part): ProjectDiffBlock => {
    const lines = part.value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const kind = part.added ? 'added' : part.removed ? 'removed' : 'context';
    const block: ProjectDiffBlock = { kind, beforeStart: part.added ? null : beforeStart, afterStart: part.removed ? null : afterStart, lines };
    if (!part.added) beforeStart += lines.length;
    if (!part.removed) afterStart += lines.length;
    if (part.added) added += lines.length;
    if (part.removed) removed += lines.length;
    return block;
  });
  return { ...change, added, removed, blocks };
}

/** 连续写入合并为净变化。如果期间有外部修改，单独计算各段，避免把人工改动算给 Agent。 */
export function summarizeProjectWrites(writes: ProjectWriteSnapshot[]): TurnFileChanges['files'] {
  const byPath = new Map<string, { path: string; writeIds: string[]; ranges: Array<{ before: string; after: string }> }>();
  for (const { id, path, before, after } of writes) {
    const key = process.platform === 'win32' ? path.toLowerCase() : path;
    const file = byPath.get(key) ?? { path, writeIds: [], ranges: [] };
    const previous = file.ranges.at(-1);
    if (previous?.after === before) previous.after = after;
    else file.ranges.push({ before, after });
    file.writeIds.push(id);
    byPath.set(key, file);
  }
  return [...byPath.values()].map(({ path, writeIds, ranges }) => {
    let added = 0;
    let removed = 0;
    for (const { before, after } of ranges) {
      const parts = lineChanges(before, after);
      if (!parts) return { path, writeIds, added: null, removed: null };
      for (const part of parts) {
        if (part.added) added += part.count;
        if (part.removed) removed += part.count;
      }
    }
    return { path, writeIds, added, removed };
  });
}
