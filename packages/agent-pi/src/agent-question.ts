import { randomUUID } from 'node:crypto';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { AgentQuestion, AgentQuestionAnswer } from '@plotloom/contracts';
import { Type } from 'typebox';
import { AgentError } from './errors.ts';

export const ASK_USER_TOOL = 'ask_user';
type QuestionOutcome = AgentQuestionAnswer | { kind: 'cancelled' };
export type QuestionWaiter = (input: Omit<AgentQuestion, 'id'>, signal?: AbortSignal) => Promise<QuestionOutcome>;

/** 每个会话同一时间只等一道题。先移除问题再恢复工具，确保答案只消费一次。 */
export class AgentQuestions {
  private pending?: { question: AgentQuestion; finish: (answer: QuestionOutcome) => void };

  get current() { return this.pending?.question; }

  wait(input: Omit<AgentQuestion, 'id'>, signal: AbortSignal | undefined, publish: (question: AgentQuestion) => void) {
    if (signal?.aborted) return Promise.resolve<QuestionOutcome>({ kind: 'cancelled' });
    const question = { ...input, id: randomUUID() };
    const result = Promise.withResolvers<QuestionOutcome>();
    const cancel = () => finish({ kind: 'cancelled' });
    const finish = (answer: QuestionOutcome) => {
      this.pending = undefined;
      signal?.removeEventListener('abort', cancel);
      result.resolve(answer);
    };
    this.pending = { question, finish };
    signal?.addEventListener('abort', cancel, { once: true });
    publish(question);
    return result.promise;
  }

  answer(id: string, answer: AgentQuestionAnswer) {
    const item = this.pending;
    if (!item || item.question.id !== id)
      throw new AgentError(409, 'QUESTION_UNAVAILABLE', '问题已结束或不属于当前会话。');
    if (answer.kind === 'option' && answer.index > item.question.options.length)
      throw new AgentError(422, 'INVALID_QUESTION_OPTION', '请选择本题提供的选项。');
    item.finish(answer);
    return { id, kind: answer.kind };
  }

  cancel() { this.pending?.finish({ kind: 'cancelled' }); }
}

/** 串行调用保证同批次工具逐项执行；答案作为工具结果进入原轮次模型上下文。 */
export function createAskUserTool(wait: QuestionWaiter) {
  return defineTool({
    name: ASK_USER_TOOL,
    label: '向用户提问',
    description: '需要用户做决定时，显示一道单选题并等待回答。提供 2 至 5 个互斥选项，界面也支持自填和跳过。',
    executionMode: 'sequential',
    parameters: Type.Object({
      question: Type.String({ minLength: 1, maxLength: 500, pattern: '\\S' }),
      options: Type.Array(Type.String({ minLength: 1, maxLength: 200, pattern: '\\S' }), { minItems: 2, maxItems: 5 }),
    }),
    async execute(callId, { question, options }, signal) {
      // 部分模型网关拒绝 uniqueItems，改在发布问题前检查选项是否重复。
      if (new Set(options).size !== options.length) throw new Error('提问选项不能重复，请提供互不相同的选项。');
      const answer = await wait({ callId, question, options }, signal);
      const text = answer.kind === 'option' ? `用户选择：${options[answer.index - 1]}`
        : answer.kind === 'custom' ? `用户自填：${answer.text.trim()}`
        : answer.kind === 'skip' ? '用户跳过了问题，未提供答案。' : '提问已取消。';
      return { content: [{ type: 'text', text }], details: answer };
    },
  });
}
