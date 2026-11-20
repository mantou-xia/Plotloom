import type { AgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import type { Message, MessageBlock, Outcome, Usage } from '@plotloom/contracts';
import type { MessageSourceSnapshot } from '@plotloom/contracts/sources';
import { attachCitations } from './citations.ts';

export const TURN_START = 'plotloom.turn.start';
export const TURN_END = 'plotloom.turn.end';
export const TURN_EVENT = 'plotloom.turn.event';
type SdkMessage = AgentSession['messages'][number];

/** 仅投影公开正文、可见思考和工具内容；不返回签名、加密思考或供应商原始错误。 */
export function mapMessage(id: string, message: SdkMessage, running = false): Message | undefined {
  if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'toolResult') return;
  const content: MessageBlock[] = [];
  if (message.role === 'toolResult') {
    content.push({ type: 'tool', callId: message.toolCallId, name: message.toolName,
      status: message.isError ? 'failed' : 'completed',
      text: message.isError ? '工具执行失败，请检查参数后重试。'
        : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    });
    if (message.toolName === 'browser' || message.toolName === 'web_fetch') {
      const details = message.details as { source?: { id?: string; title: string; url: string }; publicError?: string } | undefined;
      const block = content[0];
      if (block?.type === 'tool') {
        if (message.isError && details?.publicError) block.text = details.publicError;
        if (!message.isError && details?.source) block.source = details.source;
      }
    }
  } else if (message.role === 'assistant' && message.stopReason === 'error') {
    content.push({ type: 'text', text: '模型生成失败，请检查本机模型配置后重试。' });
  } else if (typeof message.content === 'string') {
    content.push({ type: 'text', text: message.content });
  } else {
    for (const part of message.content) {
      if (part.type === 'text') content.push({ type: 'text', text: part.text });
      if (part.type === 'thinking' && !part.redacted && part.thinking) content.push({ type: 'thinking', text: part.thinking });
      if (part.type === 'toolCall') content.push({ type: 'tool', callId: part.id, name: part.name, status: 'running', input: JSON.stringify(part.arguments, null, 2) });
    }
  }
  const result: Message = { id, role: message.role === 'toolResult' ? 'tool' : message.role, content };
  if (message.role === 'assistant') {
    // 自动重试中的错误属于执行过程，不能把多次失败提示拼成最终回答。
    result.phase = !running && ['stop', 'length', 'aborted'].includes(message.stopReason) ? 'answer' : 'process';
    if (running) result.streaming = true;
  }
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
  let startedAt = NaN;
  let input: MessageSourceSnapshot | undefined;
  let originalText: string | undefined;
  const outcomes = new Map<string, Outcome>();
  const finish = (outcome: Outcome, endedAt?: string) => {
    if (turnId) outcomes.set(turnId, outcome);
    const user = turnMessages.find((message) => message.role === 'user');
    if (user) {
      user.outcome = outcome;
      // 只使用同轮持久化标记，刷新和切页不会改变耗时。
      const elapsed = endedAt ? Date.parse(endedAt) - startedAt : NaN;
      if (elapsed >= 0) user.elapsedSeconds = elapsed / 1000;
    }
    const last = turnMessages.findLast((message) => message.role === 'assistant');
    if (last) last.outcome = outcome;
  };
  for (const entry of manager.getBranch()) {
    if (entry.type === 'custom' && entry.customType === TURN_START) {
      if (!ended) finish('aborted');
      startedAt = Date.parse(entry.timestamp);
      turnId = entry.id;
      input = (entry.data as { input?: MessageSourceSnapshot } | undefined)?.input;
      originalText = (entry.data as { request?: { text?: string } } | undefined)?.request?.text;
      turnMessages = [];
      ended = false;
    } else if (entry.type === 'custom' && entry.customType === TURN_END) {
      const data = entry.data as { turnId: string; outcome: Outcome };
      if (data.turnId === turnId) { finish(data.outcome, entry.timestamp); ended = true; }
    } else if (entry.type === 'custom' && entry.customType === TURN_EVENT) {
      const block = { ...entry.data as Extract<MessageBlock, { type: 'event' }> };
      const message: Message = { id: entry.id, turnId, role: 'assistant', phase: 'process', content: [block] };
      messages.push(message); turnMessages.push(message);
    } else if (entry.type === 'message') {
      const message = mapMessage(entry.id, entry.message);
      if (message?.role === 'user' && originalText !== undefined) {
        // 请求快照保留用户原文；日期等后端上下文只进模型，不混入公开历史或复制正文。
        message.content = originalText ? [{ type: 'text', text: originalText }] : [];
        originalText = undefined;
      }
      if (message?.role === 'user' && input) {
        // 用户看到自己提交的文字与来源，模型使用的资料拼接和图片编码留在后端。
        message.content = input.text ? [{ type: 'text', text: input.text }] : [];
        message.attachments = input.attachments;
        message.references = input.references;
        input = undefined;
      }
      if (message) { message.turnId = turnId; messages.push(message); turnMessages.push(message); }
    }
  }
  if (!ended && turnId !== activeTurn) finish('aborted');
  if (current && activeTurn) {
    const snapshot = mapMessage(`stream:${activeTurn}`, current, true);
    if (snapshot) { snapshot.turnId = activeTurn; messages.push(snapshot); turnMessages.push(snapshot); }
  }
  const results = new Map(messages.filter((message) => message.role === 'tool')
    .flatMap((message) => message.content.filter((part) => part.type === 'tool').map((part) => [part.callId, part.status] as const)));
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content) {
      if (part.type === 'tool') part.status = results.get(part.callId) ?? (activeTurn && turnMessages.includes(message) ? 'running' : outcomes.get(message.turnId ?? '') === 'aborted' ? 'stopped' : 'failed');
      if (part.type === 'event' && part.status === 'running' && message.turnId !== activeTurn) {
        part.status = outcomes.get(message.turnId ?? '') === 'aborted' ? 'stopped' : outcomes.get(message.turnId ?? '') === 'failed' ? 'failed' : 'completed';
      }
    }
  }
  attachCitations(messages);
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
