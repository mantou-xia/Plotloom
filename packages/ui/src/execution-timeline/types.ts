import type { ProcessStatus } from '../agent-process/types.ts';
import type { ToolCallData } from '../tool-call/tool-call-item.tsx';

/** 同一 id 只更新原节点；数组顺序就是展示顺序，不按类型分组或重新排序。 */
export type ExecutionEntry = { id: string } & (
  | { type: 'thinking'; content: string; title?: string; streaming?: boolean }
  | { type: 'message'; content: string; title?: string; streaming?: boolean }
  | ({ type: 'tool' } & ToolCallData)
  | { type: 'event'; title: string; description?: string; status?: ProcessStatus; content?: string }
);
