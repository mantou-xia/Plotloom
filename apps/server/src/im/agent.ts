import { AgentError, publicError, type AgentService } from '@plotloom/agent-pi';
import { ImError, type ImAgent } from '@plotloom/application/weixin';
import type { PublicError } from '@plotloom/contracts';

/** 只在装配层接触 SDK 服务；微信复用现有会话、工具审批与提问，不创建第二套 Agent 循环。 */
export function imAgent(agent: AgentService): ImAgent {
  const wrap = async <T>(task: () => Promise<T>): Promise<T> => {
    try { return await task(); }
    catch (error) {
      if (error instanceof AgentError) throw new ImError(error.code, error.message, error.statusCode);
      throw error;
    }
  };
  return {
    inspect: id => wrap(async () => {
      const session = await agent.getSession(id);
      return { activity: session.activity, question: session.pendingQuestion, approvals: session.pendingApprovals };
    }),
    answer: (id, questionId, text) => wrap(async () => {
      const option = /^选项\s*(\d+)$/.exec(text);
      await agent.answerQuestion(id, questionId, text === '跳过' ? { kind: 'skip' }
        : option ? { kind: 'option', index: Number(option[1]) } : { kind: 'custom', text });
    }),
    approve: (id, approvalId, approve) => wrap(async () => { await agent.decideToolApproval(id, approvalId, approve ? 'approve' : 'deny'); }),
    stop: id => wrap(async () => { await agent.stop(id); }),
    run: (id, text, notice, signal) => wrap(async () => {
      signal.throwIfAborted();
      const execute = await agent.prepareMessage(id, text);
      let stopped = false;
      let stopTask: Promise<unknown> | undefined;
      const stop = () => { stopped = true; stopTask = agent.stop(id).catch(() => {}); };
      signal.addEventListener('abort', stop, { once: true });
      let error: PublicError | undefined;
      let acceptedId: string | undefined;
      try {
        // prepareMessage 已占用会话；即使刚好取消，也须启动执行入口让 SDK 释放锁。
        const running = execute(event => {
          if (event.type === 'accepted') acceptedId = event.messageId;
          else if (event.type === 'failed') error = event.error;
          else if (event.type === 'aborted') error = { code: 'GENERATION_ABORTED', message: '本轮生成已停止。' };
          else if (event.type === 'user_answer_required') {
            const question = event.question;
            notice(`${question.question}\n${question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}\n回复“选项 1”、直接输入答案或“跳过”。`);
          } else if (event.type === 'tool_approval_required') {
            const approval = event.approval;
            notice(`${approval.label ?? 'Agent 请求文件操作'}\n${approval.operation}：${approval.path}\n${approval.preview}\n截止：${approval.expiresAt}\n批准 ${approval.id}\n拒绝 ${approval.id}`);
          }
        });
        if (signal.aborted) stop();
        await running; await stopTask;
        if (stopped) return { text: '', error: { code: 'IM_PROCESS_INTERRUPTED', message: '微信连接已停止。' } };
        if (error) return { text: error.message, error };
        const session = await agent.getSession(id);
        const turnId = session.messages.find(message => message.id === acceptedId)?.turnId;
        const last = turnId ? session.messages.findLast(message => message.turnId === turnId && message.role === 'assistant' && message.phase === 'answer') : undefined;
        return { text: last?.content.filter(block => block.type === 'text').map(block => block.text).join('') ?? '' };
      } catch (cause) { return { text: '', error: publicError(cause) }; }
      finally { signal.removeEventListener('abort', stop); }
    }),
  };
}
