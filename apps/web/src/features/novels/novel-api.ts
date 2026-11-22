import type { DocumentView } from '@plotloom/contracts/workspaces';
import { chapterFromTitle } from '@plotloom/contracts/writing';
import { requestJson } from '../../utils/http';

const collator = new Intl.Collator('zh-CN', { numeric: true });

/** 同一目录内按可识别的章号排，其他名称沿用自然排序。 */
export function compareChapters(a: string, b: string) {
  const left = a.lastIndexOf('/');
  const right = b.lastIndexOf('/');
  return collator.compare(a.slice(0, left), b.slice(0, right))
    || (chapterFromTitle(a.slice(left + 1)) ?? Infinity) - (chapterFromTitle(b.slice(right + 1)) ?? Infinity)
    || collator.compare(a, b);
}

/** 编辑和创作均读取正式 Markdown，以工作区接口返回的版本为准。 */
export function readManuscript(base: string, path: string, signal?: AbortSignal) {
  return requestJson<DocumentView>(base + '/document/read', 'POST', { path }, signal);
}
