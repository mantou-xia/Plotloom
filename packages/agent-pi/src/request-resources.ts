import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { FileApprovalTarget, Outcome } from '@plotloom/contracts';
import type { Approval, FileToolScope } from './project-tools.ts';
import type { QuestionWaiter } from './agent-question.ts';

/** 宿主提供通用工具形状；SDK 适配不导入具体业务模块。 */
export interface BusinessTool {
  name: string; description: string; parameters: Record<string, unknown>;
  confirmable?: boolean;
  sequential?: boolean;
  confirmationOptions?: [string, string];
  execute(input: any, signal?: AbortSignal, confirm?: (question: string, target?: FileApprovalTarget) => Promise<boolean>): Promise<unknown>;
}
export interface RequestResources {
  fileScope?: FileToolScope;
  replayInput?: unknown;
  persistReplayInput?: boolean;
  key: string; systemPrompt: string; tools: BusinessTool[];
  /** 用户消息已入历史后、首次模型请求前执行，可复用会话的文件审批。 */
  beforeGenerate?(signal: AbortSignal | undefined, confirm: (preview: string, target: FileApprovalTarget) => Promise<boolean>): Promise<void>;
  start?(): Promise<void>; finish?(outcome: Outcome): Promise<void>;
}
export function adaptBusinessTool(tool: BusinessTool, ask: QuestionWaiter, approve: Approval) {
  return defineTool({ name: tool.name, label: tool.name, description: tool.description,
    parameters: Type.Unsafe<Record<string, unknown>>(tool.parameters),
    ...(tool.confirmable || tool.sequential ? { executionMode: 'sequential' as const } : {}),
    async execute(callId, input, signal) {
      const confirm = async (question: string, target?: FileApprovalTarget) => {
        // 文件决定沿用一次性审批 ID、超时和停止语义，普通交互仍可自填或跳过。
        if (target) return await approve(callId, { ...target, preview: question }, signal, true) === 'approve';
        const answer = await ask({ callId, question, options: tool.confirmationOptions ?? ['确认保存', '暂不保存'] }, signal);
        return answer.kind === 'option' && answer.index === 1;
      };
      signal?.throwIfAborted(); const result = await tool.execute(input, signal, tool.confirmable ? confirm : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], details: result };
    },
  });
}
