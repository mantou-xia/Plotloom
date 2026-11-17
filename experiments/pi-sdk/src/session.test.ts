import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const worker = fileURLToPath(new URL('../tests/worker.ts', import.meta.url));

/** 走发布 SDK 的实际 HTTP、工具循环与 JSONL；只替换云端模型返回的数据。 */
test('隔离资源、工具流式调用、跨进程重开和停止', { timeout: 45000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plotloom-p0-'));
  const requests: Array<{ messages: Array<{ role: string; content: unknown }>; tools: Array<{ function: { name: string } }> }> = [];
  const serverErrors: unknown[] = [];
  const server = createServer(async (req, res) => {
    try {
      assert.equal(req.url, '/v1/chat/completions');
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      // OpenAI 兼容协议允许纯文本或内容块数组；按文本内容决定测试回复。
      const contentText = (content: string | Array<{ text?: string }> | null) =>
        typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('');
      requests.push(body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunk = (delta: unknown, finish: string | null = null) => res.write(`data: ${JSON.stringify({
        id: 'p0-fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture',
        choices: [{ index: 0, delta, finish_reason: finish }],
      })}\n\n`);
      chunk({ role: 'assistant' });
      const last = body.messages.at(-1);
      if (contentText(last.content) === 'STOP_TEST') {
        chunk({ content: '正在生成，等待停止。' });
        // 故意保持流打开，由客户端 abort 关闭；不靠定时器伪造停止。
        return;
      }
      if (last.role === 'tool') {
        assert.match(last.content, /灯塔-731/);
        chunk({ content: '灯塔-731。A：检查台阶。' });
        chunk({ content: 'B：修复电源。请选择。' }, 'stop');
      } else if (contentText(last.content).includes('我选择 A')) {
        assert(body.messages.some((m: { role: string; content: string }) => m.role === 'assistant' && contentText(m.content).includes('A：检查台阶')));
        assert(body.messages.some((m: { role: string; content: string }) => m.role === 'tool' && m.content.includes('灯塔-731')));
        chunk({ content: '灯塔-731。林舟走向第七级台阶。' }, 'stop');
      } else {
        chunk({ tool_calls: [{ index: 0, id: 'read-1', type: 'function', function: { name: 'read_fixture', arguments: '{"document":"scene"}' } }] }, 'tool_calls');
      }
      res.end('data: [DONE]\n\n');
    } catch (error) {
      serverErrors.push(error);
      res.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const run = async (mode: string, file?: string) => {
    const { stdout } = await execFileAsync(process.execPath, [worker, dataDir, baseUrl, mode, ...(file ? [file] : [])], { timeout: 20000 });
    return JSON.parse(stdout.trim());
  };
  try {
    const first = await run('generate');
    assert(first.deltas > 0);
    assert(first.events.includes('tool_execution_start'));
    assert(first.events.includes('tool_execution_end'));
    assert(first.events.includes('agent_settled'));
    assert.match(first.text, /A：检查台阶/);
    const saved = await readFile(first.file, 'utf8');
    assert.match(saved, /灯塔-731/);
    const resumed = await run('resume', first.file);
    assert.equal(resumed.id, first.id);
    assert(resumed.messageCount > first.messageCount);
    assert.match(resumed.text, /第七级台阶/);
    const stopped = await run('abort');
    assert.equal(stopped.aborted, true);
    assert(stopped.deltas > 0);
    for (const request of requests) {
      assert.deepEqual(request.tools.map((tool) => tool.function.name), ['read_fixture']);
      const system = request.messages.filter((message) => ['system', 'developer'].includes(message.role));
      assert.match(JSON.stringify(system), /小说创作验证助手/);
      assert.doesNotMatch(JSON.stringify(system), /项目开发规则|Self-Improvement|You are a coding/);
    }
    assert.deepEqual(serverErrors, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dataDir, { recursive: true, force: true });
  }
});
