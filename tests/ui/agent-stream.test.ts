import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeAgentStream } from '../../apps/web/src/features/agent/client.ts';

/** 一字节分块覆盖中文 UTF-8 与 CRLF 边界，不依赖网络恰好按事件分块。 */
function stream(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('产品聊天解析跨块中文、心跳和最终事件', async () => {
  const result: string[] = [];
  await consumeAgentStream(stream(': keepalive\r\n\r\nevent: text_delta\r\ndata: {"sessionId":"s1","delta":"你好"}\r\n\r\nevent: completed\r\ndata: {"sessionId":"s1"}\r\n\r\n'), event => {
    result.push(event.type === 'text_delta' ? event.delta : event.type);
  });
  assert.deepEqual(result, ['你好', 'completed']);
});

test('产品聊天断流不能冒充完成，停止与失败可正常结束', async () => {
  await assert.rejects(consumeAgentStream(stream('event: accepted\ndata: {"sessionId":"s1","messageId":"m1"}\n\n'), () => {}), /连接已断开/);
  for (const type of ['aborted', 'failed']) {
    await consumeAgentStream(stream(`event: ${type}\ndata: {"sessionId":"s1"}\n\n`), event => assert.equal(event.type, type));
  }
  await assert.rejects(consumeAgentStream(stream('event: completed\ndata: {"sessionId":"s1"}\n\nevent: completed\ndata: {"sessionId":"s1"}\n\n'), () => {}), /多余数据/);
});
