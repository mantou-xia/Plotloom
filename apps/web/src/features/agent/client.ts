import type { AgentEvent } from '@plotloom/contracts';
import { readSseFrames } from '@plotloom/contracts/sse';

/** 结束事件必须是最后一个有效事件；没有结束事件的断流进入会话恢复流程。 */
export async function consumeAgentStream(response: Response, receive: (event: AgentEvent) => void): Promise<void> {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('未收到聊天事件流。');
  let ended = false;
  await readSseFrames(response.body, (type, data) => {
    if (ended) throw new Error('结束事件之后收到多余数据。');
    const event = { ...JSON.parse(data), type } as AgentEvent;
    ended = ['completed', 'aborted', 'failed'].includes(type);
    receive(event);
  });
  if (!ended) throw new Error('连接已断开，正在重新查询会话状态。');
}
