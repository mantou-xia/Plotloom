import type { AgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import type { Message, MessageBlock, Outcome, Usage } from '@plotloom/contracts';

export const TURN_START = 'plotloom.turn.start';
export const TURN_END = 'plotloom.turn.end';
type SdkMessage = AgentSession['messages'][number];

/** 仅公开正文、可见思考文本和工具结果；签名、加密思考、工具参数及原始错误不进入契约。 */
export function mapMessage(id: string, message: SdkMessage, running = false): Message | undefined {
  if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'toolResult') return;
  const content: MessageBlock[] = [];
  if (message.role === 'toolResult') {
    content.push({ type: 'tool', callId: message.toolCallId, name: message.toolName,
      status: message.isError ? 'failed' : 'completed',
      text: message.isError ? '工具执行失败，请检查参数后重试。'
        : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    });
  } else if (message.role === 'assistant' && message.stopReason === 'error') {
    content.push({ type: 'text', text: '模型生成失败，请检查本机模型配置后重试。' });
  } else if (typeof message.content === 'string') {
    content.push({ type: 'text', text: message.content });
  } else {
    for (const part of message.content) {
      if (part.type === 'text') content.push({ type: 'text', text: part.text });
      if (part.type === 'thinking' && !part.redacted && part.thinking) content.push({ type: 'thinking', text: part.thinking });
      if (part.type === 'toolCall') content.push({ type: 'tool', callId: part.id, name: part.name, status: 'running' });
    }
  }
  const result: Message = { id, role: message.role === 'toolResult' ? 'tool' : message.role, content };
  if (message.role === 'assistant' && !running) {
    result.outcome = message.stopReason === 'error' ? 'failed' : message.stopReason === 'aborted' ? 'aborted' : 'completed';
  }
  return result;
}

/** 标记只引用一次请求，不复制聊天历史；缺少结束标记的旧请求按中断展示。 */
export function readMessages(manager: SessionManager, activeTurn?: string, current?: SdkMessage): Message[] {
  const messages: Message[] = [];
  let turnMessages: Message[] = [];
  let turnId: string | undefined;
  let ended = true;
  const finish = (outcome: Outcome) => {
    const user = turnMessages.find((message) => message.role === 'user');
    if (user) user.outcome = outcome;
    const last = turnMessages.findLast((message) => message.role === 'assistant');
    if (last) last.outcome = outcome;
  };
  for (const entry of manager.getBranch()) {
    if (entry.type === 'custom' && entry.customType === TURN_START) {
      if (!ended) finish('aborted');
      turnId = entry.id;
      turnMessages = [];
      ended = false;
    } else if (entry.type === 'custom' && entry.customType === TURN_END) {
      const data = entry.data as { turnId: string; outcome: Outcome };
      if (data.turnId === turnId) { finish(data.outcome); ended = true; }
    } else if (entry.type === 'message') {
      const message = mapMessage(entry.id, entry.message);
      if (message) { messages.push(message); turnMessages.push(message); }
    }
  }
  if (!ended && turnId !== activeTurn) finish('aborted');
  if (current && activeTurn) {
    const snapshot = mapMessage(`stream:${activeTurn}`, current, true);
    if (snapshot) { messages.push(snapshot); turnMessages.push(snapshot); }
  }
  const results = new Map(messages.filter((message) => message.role === 'tool')
    .flatMap((message) => message.content.filter((part) => part.type === 'tool').map((part) => [part.callId, part.status] as const)));
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content) {
      if (part.type === 'tool') part.status = results.get(part.callId) ?? (activeTurn && turnMessages.includes(message) ? 'running' : 'failed');
    }
  }
  return messages;
}

/** 汇总本轮所有模型调用及压缩用量；零值或缺失不宣称无成本。 */
export function turnUsage(manager: SessionManager, startIndex: number): Usage | undefined {
  const sum: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };
  for (const entry of manager.getEntries().slice(startIndex)) {
    const usage = entry.type === 'message' && entry.message.role === 'assistant' ? entry.message.usage
      : entry.type === 'compaction' || entry.type === 'usage' ? entry.usage : undefined;
    if (!usage) continue;
    for (const key of Object.keys(sum) as Array<keyof Usage>) sum[key] += usage[key] ?? 0;
  }
  return sum.totalTokens > 0 ? sum : undefined;
}
