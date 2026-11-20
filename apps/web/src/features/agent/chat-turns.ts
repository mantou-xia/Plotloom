import type { Message, SessionDetail } from '@plotloom/contracts';
import type { ExecutionEntry } from '@plotloom/ui/execution-timeline';
import type { AgentActivity, AgentPhase } from '@plotloom/ui/agent-activity-header';
import type { FileSource, WebSource } from '@plotloom/ui/source-reference';

export interface ChatTurn {
  id: string; user?: Message; process: ExecutionEntry[]; answer: string;
  fileReferences: FileSource[]; citations: Map<string, WebSource>; phase: AgentPhase; activity: AgentActivity;
}
const activities: Record<string, AgentActivity> = { browser: 'browsing', read: 'reading', read_fixture: 'reading', read_skill: 'reading', write: 'writing', edit: 'editing', grep: 'searching', find: 'searching', ls: 'reading', bash: 'executing', powershell: 'executing' };

/** 工具结果回填原调用位置，其余过程保留发生顺序；不把首个正文猜作最终回答。 */
export function chatTurns(session: SessionDetail): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let turn: ChatTurn | undefined;
  for (const message of session.messages) {
    const id = message.turnId ?? (message.role === 'user' ? message.id : turn?.id ?? message.id);
    if (!turn || turn.id !== id) {
      turn = { id, process: [], answer: '', fileReferences: [], citations: new Map(), phase: 'completed', activity: 'thinking' };
      turns.push(turn);
    }
    if (message.role === 'user') {
      turn.user = message;
      turn.fileReferences = (message.references ?? []).map((reference, index) => ({ id: `${message.id}:file:${index}`, index: index + 1,
        kind: 'file', path: reference.path, title: reference.path, excerpt: reference.content }));
      continue;
    }
    // 复用首次引用的编号，正文标记和来源列表指向同一条后端校验记录。
    for (const source of message.citations ?? []) {
      if (!turn.citations.has(source.id)) turn.citations.set(source.id, { ...source, kind: 'web', index: turn.citations.size + 1 });
    }
    for (const [index, block] of message.content.entries()) {
      const blockId = `${message.id}:${index}`;
      if (block.type === 'tool') {
        const existing = turn.process.find(item => item.id === block.callId);
        if (existing?.type === 'tool') {
          existing.status = block.status;
          if (block.text !== undefined) existing.output = block.text;
          // 网页是这次调用的结果，同一地址经不同步骤访问时各自保留。
          if (block.source) existing.source = block.source;
        } else turn.process.push({ id: block.callId, type: 'tool', name: block.name, status: block.status,
          input: block.input, output: block.text, source: block.source });
        if (block.status === 'running') turn.activity = activities[block.name] ?? 'processing';
      } else if (block.type === 'event') {
        turn.process.push({ id: blockId, type: 'event', title: block.text, status: block.status });
      } else if (block.type === 'text' && message.phase === 'answer') {
        turn.answer += (turn.answer ? '\n\n' : '') + block.text;
      } else {
        turn.process.push({ id: blockId, type: block.type === 'thinking' ? 'thinking' : 'message', content: block.text, streaming: message.streaming });
      }
    }
  }
  for (const [index, item] of turns.entries()) {
    const running = index === turns.length - 1 && session.status === 'running' && session.activity === 'generating';
    const outcome = item.user?.outcome;
    item.phase = running ? 'working' : outcome === 'failed' ? 'failed' : outcome === 'aborted' ? 'stopped' : 'completed';
  }
  return turns;
}
