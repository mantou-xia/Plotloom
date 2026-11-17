import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';

export const TEST_KEY = 'p1-test-secret-must-not-leak';
const contentText = (content: string | Array<{ text?: string }> | null) =>
  typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('');

/** 只替换模型协议响应，服务、SDK、工具和 JSONL 均走生产入口。 */
export async function createModelFixture() {
  const requests: any[] = [];
  const errors: unknown[] = [];
  const waiting = new Map<string, ServerResponse>();
  const attempts = new Map<string, number>();
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      requests.push(body);
      const last = body.messages.at(-1);
      const prompt = contentText(body.messages.findLast((message: any) => message.role === 'user')?.content);
      const count = (attempts.get(prompt) ?? 0) + 1;
      attempts.set(prompt, count);
      if (prompt === 'FAIL' || (prompt === 'RETRY' && count === 1) || prompt === 'RETRY_FAIL' || prompt === 'RETRY_STOP') {
        response.writeHead(prompt === 'FAIL' ? 401 : 503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: `upstream secret ${TEST_KEY} Authorization credential/path`, type: 'server_error' } }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      writeChunk(response, { role: 'assistant' });
      if (!body.tools?.length) {
        // SDK 压缩使用自己的摘要提示与无工具请求，不是产品聊天提示。
        writeChunk(response, { content: '已保留测试材料，用户继续当前会话。' }, 'stop');
        finish(response);
        return;
      }
      if (prompt === 'SEED_COMPACTION') {
        writeChunk(response, { content: '测试材料。'.repeat(18000) }, 'stop');
        finish(response);
        return;
      }
      if (prompt === 'COMPACT') {
        writeChunk(response, { content: '本轮正文完成。' }, 'stop');
        finish(response, 120000);
        return;
      }
      if (prompt.startsWith('WAIT:')) {
        writeChunk(response, { content: `部分回复 ${prompt}` });
        waiting.set(prompt, response);
        response.once('close', () => waiting.delete(prompt));
        return;
      }
      if (last.role === 'tool') {
        if (prompt === 'BAD_TOOL') {
          writeChunk(response, { content: '工具参数无效，已停止读取。' }, 'stop');
        } else {
          assert.match(last.content, /灯塔-731/);
          writeChunk(response, { content: '灯塔-731。A：检查台阶。' });
          writeChunk(response, { content: 'B：修复电源。请选择。' }, 'stop');
        }
      } else if (prompt === 'TOOL' || prompt === 'BAD_TOOL') {
        writeChunk(response, { tool_calls: [{ index: 0, id: `read-${requests.length}`, type: 'function', function: {
          name: 'read_fixture', arguments: JSON.stringify({ document: prompt === 'BAD_TOOL' ? '../secret' : 'scene' }),
        } }] }, 'tool_calls');
      } else if (prompt === '我选择 A') {
        assert(body.messages.some((message: any) => message.role === 'assistant' && contentText(message.content).includes('A：检查台阶')));
        assert(body.messages.some((message: any) => message.role === 'tool' && contentText(message.content).includes('灯塔-731')));
        writeChunk(response, { content: '灯塔-731。林舟走向第七级台阶。' }, 'stop');
      } else {
        writeChunk(response, { content: `收到：${prompt}` }, 'stop');
      }
      finish(response);
    } catch (error) {
      errors.push(error);
      response.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`, requests, errors, attempts,
    release(prompt: string) {
      const response = waiting.get(prompt);
      assert(response, '应有等待中的模型请求');
      writeChunk(response, { content: '生成完成。' }, 'stop');
      finish(response);
    },
    async close() { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}

function writeChunk(response: ServerResponse, delta: unknown, finish: string | null = null) {
  response.write(`data: ${JSON.stringify({ id: 'p1-fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture',
    choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
}
function finish(response: ServerResponse, input = 10) {
  response.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: input, completion_tokens: 5, total_tokens: input + 5 } })}\n\n`);
  response.end('data: [DONE]\n\n');
}
