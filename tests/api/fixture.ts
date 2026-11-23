import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';

export const TEST_KEY = 'p1-test-secret-must-not-leak';
// 确定性指令从实际用户正文解析；原始模型请求保留日期后缀，供接口和缓存前缀断言。
const contentText = (content: string | Array<{ text?: string }> | null) =>
  (typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('')).replace(/\n\n<plotloom_date_context>[\s\S]*<\/plotloom_date_context>$/, '');

/** 只替换模型协议响应，服务、SDK、工具和 JSONL 均走生产入口。 */
export async function createModelFixture() {
  const requests: any[] = [];
  const errors: unknown[] = [];
  const waiting = new Map<string, ServerResponse>();
  const waitingActions = new Map<string, () => void>();
  const attempts = new Map<string, number>();
  let compactionMode: 'complete' | 'wait' | 'fail' = 'complete';
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/chat/completions');
      // 流式解码保留网络分块边界上的中文，避免长工具结果被夹具破坏。
      request.setEncoding('utf8');
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      requests.push(body);
      const last = body.messages.at(-1);
      const prompt = contentText(body.messages.findLast((message: any) => message.role === 'user')?.content);
      const count = (attempts.get(prompt) ?? 0) + 1;
      attempts.set(prompt, count);
      if (prompt === 'ACCOUNTS_EXHAUSTED') {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'All available accounts exhausted: ' + TEST_KEY, type: 'server_error' } }));
        return;
      }
      if (!body.tools?.length && compactionMode === 'fail') {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: `upstream secret ${TEST_KEY}`, type: 'server_error' } }));
        return;
      }
      if (prompt === 'FAIL' || (prompt === 'RETRY' && count === 1) || prompt === 'RETRY_FAIL' || prompt === 'RETRY_STOP') {
        response.writeHead(prompt === 'FAIL' ? 401 : 503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: `upstream secret ${TEST_KEY} Authorization credential/path`, type: 'server_error' } }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      writeChunk(response, { role: 'assistant' });
      if (!body.tools?.length) {
        // SDK 压缩使用自己的摘要提示与无工具请求，不是产品聊天提示。
        if (compactionMode === 'wait') {
          waiting.set('COMPACTION', response);
          response.once('close', () => waiting.delete('COMPACTION'));
          return;
        }
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
      const setupTool = body.tools?.some((tool: any) => tool.function.name === 'setup_agent_profile');
      if (setupTool && prompt === '你好，我们先认识一下吧。') {
        writeChunk(response, { content: '你想怎么称呼我？希望我是什么样的性格，怎么跟你协作？' }, 'stop');
        finish(response);
        return;
      }
      if (setupTool && prompt === '叫你小舟。语气温和，给建议前先核对正文版本。') {
        if (last.role === 'tool') writeChunk(response, { content: last.content }, 'stop');
        else writeChunk(response, { tool_calls: [{ index: 0, id: 'bootstrap-' + requests.length, type: 'function',
          function: { name: 'setup_agent_profile', arguments: JSON.stringify({
            action: 'save', name: '小舟', style: '温和', preferences: '给建议前先核对正文版本。',
          }) } }] }, 'tool_calls');
        finish(response);
        return;
      }
      if (prompt === 'THINK') writeChunk(response, { reasoning_content: '这是模型返回的可见思考文本。' });
      const writing = /^WRITE:(.+)$/m.exec(prompt);
      if (writing) {
        // 按公开工具协议逐步执行测试计划；只替换模型决策，工具/存储/权限走生产实现。
        // 附件消息的测试控制文本在首行，后面的原始资料由生产装配器拼入。
        const plan = JSON.parse(writing[1]);
        const start = body.messages.findLastIndex((m: any) => m.role === 'user');
        const toolResults = body.messages.slice(start + 1).filter((m: any) => m.role === 'tool');
        const step = toolResults.length;
        const resumed = plan.resumedSteps && count > plan.waitBefore + 1;
        const next = () => {
          const call = (resumed ? plan.resumedSteps : plan.steps)[step];
          if (call) writeChunk(response, { tool_calls: [{ index: 0, id: `writing-${requests.length}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } }] }, 'tool_calls');
          else {
            // 用实际工具响应里的 ID 生成标记，测试可发现模型侧和公开快照之间的失配。
            const content = (plan.finalText ?? '本轮结束，请查看候选或待确认问题。').replace(/\{\{source:(\d+)\}\}/g,
              (_match: string, index: string) => JSON.parse(toolResults[Number(index)].content).source.id);
            writeChunk(response, { content }, 'stop');
          }
          finish(response);
        };
        if (!resumed && plan.waitBefore === step) {
          writeChunk(response, { content: '等待测试继续。' }); waiting.set(prompt, response); waitingActions.set(prompt, next);
          response.once('close', () => { waiting.delete(prompt); waitingActions.delete(prompt); });
        } else next();
        return;
      }
      if (prompt.startsWith('SKILL:') || prompt.startsWith('WAIT_SKILL:')) {
        if (last.role === 'tool') { writeChunk(response, { content: `技能资源：${last.content}` }, 'stop'); finish(response); return; }
        if (prompt.startsWith('WAIT_SKILL:')) {
          writeChunk(response, { content: '准备读取技能。' }); waiting.set(prompt, response);
          response.once('close', () => waiting.delete(prompt)); return;
        }
        writeChunk(response, { tool_calls: [{ index: 0, id: `skill-${requests.length}`, type: 'function', function: { name: 'read_skill', arguments: prompt.slice('SKILL:'.length) } }] }, 'tool_calls');
        finish(response); return;
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
          name: 'read', arguments: JSON.stringify(prompt === 'BAD_TOOL' ? {} : { path: 'scene.md' }),
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
    setCompactionMode(mode: typeof compactionMode) { compactionMode = mode; },
    isWaiting(prompt: string) { return waiting.has(prompt); },
    release(prompt: string) {
      const response = waiting.get(prompt);
      assert(response, '应有等待中的模型请求');
      const next = waitingActions.get(prompt);
      if (next) { waitingActions.delete(prompt); next(); return; }
      if (prompt.startsWith('WAIT_SKILL:')) writeChunk(response, { tool_calls: [{ index: 0, id: `skill-${requests.length}`, type: 'function', function: { name: 'read_skill', arguments: prompt.slice('WAIT_SKILL:'.length) } }] }, 'tool_calls');
      else writeChunk(response, { content: '生成完成。' }, 'stop');
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
