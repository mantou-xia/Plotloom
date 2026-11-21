import { defineTool } from '@earendil-works/pi-coding-agent';
import { AGENT_PROFILE_LIMITS, type AgentProfileUpdate } from '@plotloom/contracts';
import { Type } from 'typebox';
import type { QuestionWaiter } from './agent-question.ts';

export const SETUP_AGENT_PROFILE = 'setup_agent_profile';

/** 确认卡展示即将写入的内容，只有本次卡片的明确确认可以触发全局写入。 */
export function createAgentProfileTool(wait: QuestionWaiter, update: (input: AgentProfileUpdate, signal?: AbortSignal) => Promise<boolean>) {
  return defineTool({
    name: SETUP_AGENT_PROFILE,
    label: '确认 Agent 人设',
    description: '根据用户在聊天里提供的偏好，在确认后保存本机全局 Agent 人设，或确认结束首用引导。',
    executionMode: 'sequential',
    parameters: Type.Union([
      Type.Object({ action: Type.Literal('save'),
        name: Type.String({ maxLength: AGENT_PROFILE_LIMITS.name }),
        style: Type.String({ maxLength: AGENT_PROFILE_LIMITS.style }),
        preferences: Type.String({ maxLength: AGENT_PROFILE_LIMITS.preferences }) }, { additionalProperties: false }),
      Type.Object({ action: Type.Literal('skip') }, { additionalProperties: false }),
    ]),
    async execute(callId, input, signal) {
      let change: AgentProfileUpdate = input;
      if (input.action === 'save') {
        change = { action: 'save', name: input.name.trim(), style: input.style.trim(), preferences: input.preferences.trim() };
        if ([change.name, change.style, change.preferences].some(value => !value.isWellFormed() || value.includes('\0'))) {
          throw new Error('Agent 人设字段含有无效字符。');
        }
      }
      const question = change.action === 'save'
        ? '保存为全局 Agent 人设？\n名字：' + (change.name || '默认') + '\n沟通风格：' + (change.style || '默认')
          + '\n协作偏好：' + (change.preferences || '默认')
        : '以后不再主动进行 Agent 人设引导？仍可在设置中编辑人设。';
      const answer = await wait({ callId, question, options: change.action === 'save'
        ? ['确认保存人设', '继续修改'] : ['确认跳过引导', '继续设置'] }, signal);
      let result = '未确认本次操作，全局人设未更改。';
      if (answer.kind === 'custom') result += ' 用户补充：' + answer.text;
      if (answer.kind === 'option' && answer.index === 1) {
        signal?.throwIfAborted();
        const applied = await update(change, signal);
        result = applied ? (change.action === 'save' ? '全局 Agent 人设已保存。' : '首用引导已跳过。')
          : '首用引导已在别处结束，保留现有全局设置。';
      }
      return { content: [{ type: 'text', text: result }], details: {} };
    },
  });
}
