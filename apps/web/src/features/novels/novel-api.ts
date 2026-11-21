import type { DocumentView } from '@plotloom/contracts/workspaces';
import { requestJson } from '../../utils/http';

/** 编辑和创作均读取正式 Markdown，以工作区接口返回的版本为准。 */
export function readManuscript(base: string, path: string, signal?: AbortSignal) {
  return requestJson<DocumentView>(base + '/document/read', 'POST', { path }, signal);
}
