import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AgentEvent } from '@plotloom/contracts';

/** 断流只移除输出，不中止生成；慢客户端断开后可通过 GET 查询完整结果。 */
export async function streamMessage(
  request: FastifyRequest,
  reply: FastifyReply,
  execute: (emit: (event: AgentEvent) => void) => Promise<void>,
): Promise<void> {
  reply.hijack();
  const output = reply.raw;
  output.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
  });
  output.flushHeaders();
  const heartbeat = setInterval(() => {
    if (!output.destroyed && !output.writableEnded) output.write(': heartbeat\n\n');
  }, 15000);
  output.once('close', () => clearInterval(heartbeat));
  try {
    await execute((event) => {
      if (event.type === 'completed' || event.type === 'failed' || event.type === 'aborted') {
        request.log.info({ sessionId: event.sessionId, outcome: event.type }, '生成结束');
      }
      if (output.destroyed || output.writableEnded) return;
      const { type, ...data } = event;
      output.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
      // 不为不能及时读取的订阅积累无限内存；会话本身继续运行并由 SDK 保存。
      if (output.writableLength > 1024 * 1024) output.destroy();
    });
  } finally {
    clearInterval(heartbeat);
    if (!output.destroyed) output.end();
  }
}
