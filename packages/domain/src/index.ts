import { createHash, randomUUID } from 'node:crypto';
import { diffLines } from 'diff';
import type { Change, Proposal, Selection } from '@plotloom/contracts/workspaces';
export { manuscriptChanges } from './manuscript-changes.ts';

/** 公开业务错误只包含可行动说明；文件绝对路径和底层异常不随错误返回。 */
export class WorkspaceError extends Error {
  readonly code: string; readonly statusCode: number;
  constructor(code: string, message: string, statusCode = 409) { super(message); this.code = code; this.statusCode = statusCode; }
}
export function invalid(message: string): never { throw new WorkspaceError('INVALID_REQUEST', message, 400); }
export function missing(): never { throw new WorkspaceError('ASSET_NOT_FOUND', '工作区、候选或历史版本不存在。', 404); }
export const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export function checkVersion(actual: string | null, expected: string | null): void {
  if (actual !== expected) throw new WorkspaceError('REVISION_CONFLICT', '磁盘内容已变化，请重新读取；现稿与候选均已保留。');
}
export function requireId(id: string): void { if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) invalid('资源标识无效。'); }
/** 拒绝 Windows 会别名解析的路径，防止两种写法指向同一个文件或越出工作区。 */
export function documentPath(path: string): void {
  if (typeof path !== 'string' || path.length > 500 || !path.endsWith('.md') || path.split('/').some((p) =>
    !p || p === '.' || p === '..' || /[\\:*?"<>|\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) invalid('请使用工作区内的 .md 相对路径，以 / 分隔，不得使用父目录、设备名或别名路径。');
}
export function checkSelection(base: string, selection: Selection): void {
  const { start, end, text } = selection;
  const split = (n: number) => n > 0 && /[\uD800-\uDBFF]/.test(base[n - 1]) && /[\uDC00-\uDFFF]/.test(base[n] ?? '');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > base.length || split(start) || split(end) || base.slice(start, end) !== text) invalid('选区必须与原文一致，使用 UTF-16 半开区间且不能切开 emoji。');
}
/** 相邻行增删合成一处；未变行隔开差异。选区 diff 只在选区内计算，不扩张修改范围。 */
export function changesFor(before: string, after: string, offset = 0): Change[] {
  const parts = diffLines(before, after, { timeout: 1500 });
  if (!parts) throw new WorkspaceError('DIFF_TOO_COMPLEX', '差异计算超时，请缩小选区后重试。', 422);
  const changes: Change[] = [];
  let position = offset;
  let current: Change | undefined;
  for (const part of parts) {
    if (!part.added && !part.removed) { current = undefined; position += part.value.length; continue; }
    if (!current) { current = { id: randomUUID(), start: position, end: position, before: '', after: '', status: 'pending' }; changes.push(current); }
    if (part.removed) { current.before += part.value; position += part.value.length; current.end = position; }
    else current.after += part.value;
  }
  return changes;
}
/** 始终按基础坐标重建，已采纳前方增删不会影响剩余修改的定位。 */
export function renderProposal(proposal: Proposal, additionally?: ReadonlySet<string>): string {
  let result = ''; let cursor = 0;
  for (const change of proposal.changes) {
    result += proposal.baseContent.slice(cursor, change.start);
    result += change.status === 'accepted' || additionally?.has(change.id) ? change.after : change.before;
    cursor = change.end;
  }
  return result + proposal.baseContent.slice(cursor);
}
export function proposalStatus(proposal: Proposal): void {
  const states = proposal.changes.map((c) => c.status);
  proposal.status = states.every((s) => s === 'accepted') ? 'accepted' : states.every((s) => s === 'rejected') ? 'rejected'
    : states.every((s) => s === 'pending') ? 'pending' : states.includes('pending') ? 'partial' : 'resolved';
}
