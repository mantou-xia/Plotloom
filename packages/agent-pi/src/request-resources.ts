import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { Outcome } from '@plotloom/contracts';

/** 宿主提供通用工具形状；SDK 适配不导入具体业务模块。 */
export interface BusinessTool {
  name: string; description: string; parameters: Record<string, unknown>;
  execute(input: any, signal?: AbortSignal): Promise<unknown>;
}
export interface RequestResources {
  key: string; systemPrompt: string; tools: BusinessTool[];
  start?(): Promise<void>; finish?(outcome: Outcome): Promise<void>;
}
export function adaptBusinessTool(tool: BusinessTool) {
  return defineTool({ name: tool.name, label: tool.name, description: tool.description,
    parameters: Type.Unsafe<Record<string, unknown>>(tool.parameters),
    async execute(_id, input, signal) {
      signal?.throwIfAborted(); const result = await tool.execute(input, signal);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], details: result };
    },
  });
}
