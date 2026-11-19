import type { AgentEvent } from '@plotloom/contracts';

/** 按 SSE 空行解析，保留中文跨块解码；没有最终事件的断流不能算完成。 */
export async function consumeAgentStream(response: Response, receive: (event: AgentEvent) => void): Promise<void> {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('未收到聊天事件流。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const lines = frame.split(/\r?\n/);
        const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!type || !data) continue;
        if (ended) throw new Error('结束事件之后收到多余数据。');
        const event = { ...JSON.parse(data), type } as AgentEvent;
        ended = ['completed', 'aborted', 'failed'].includes(type);
        receive(event);
      }
      if (done) break;
    }
    if (!ended) throw new Error('连接已断开，正在重新查询会话状态。');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
