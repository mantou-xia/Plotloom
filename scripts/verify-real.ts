import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer, events, collect, assertFinal } from '../tests/api/client.ts';
import type { AgentEvent } from '../packages/contracts/src/index.ts';

/** 真实验收同样只访问 HTTP；分别启动进程证明历史来自磁盘，不直接调用 SDK。 */
async function main() {
  const provider = process.env.PLOTLOOM_PROVIDER;
  const model = process.env.PLOTLOOM_MODEL;
  const apiKey = process.env.PLOTLOOM_API_KEY?.trim();
  if (!provider || !model || !apiKey) throw new Error('真实验收缺少 PLOTLOOM_PROVIDER / MODEL / API_KEY，未发送请求。');
  const directory = resolve('.plotloom-data', `verify-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  const projectPath = resolve(directory, 'project');
  await mkdir(projectPath);
  await writeFile(resolve(projectPath, 'scene.md'), '核对标记：灯塔-731。');
  const env = { ...process.env, PLOTLOOM_DATA_DIR: resolve(directory, 'data') };
  let server = await startServer(env, 120000);
  const reports: unknown[] = [];
  const record = (phase: string, sessionId: string, result: AgentEvent[], started: number) => {
    const counts: Record<string, number> = {};
    for (const event of result) counts[event.type] = (counts[event.type] ?? 0) + 1;
    const final = result.at(-1);
    const report = { phase, sessionId, checkedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
      eventCounts: counts, outcome: final?.type, usage: final?.type === 'completed' ? final.usage : undefined };
    reports.push(report);
    console.log(JSON.stringify(report));
  };
  try {
    const session = await server.json('/api/sessions', 'POST', { projectPath }, 201);
    const started = performance.now();
    const generated = await collect(await server.request(`/api/sessions/${session.id}/messages`, 'POST', {
      text: '请调用 read 读取 scene.md，写出核对标记，并给出 A 检查台阶、B 修复电源两个简短行动候选，然后等待我选择。',
    }));
    assertFinal(generated, 'completed');
    assert(generated.some((event) => event.type === 'tool_end' && event.outcome === 'completed'));
    const before = await server.json(`/api/sessions/${session.id}`);
    assert.match(JSON.stringify(before.messages), /灯塔-731/);
    record('generate', session.id, generated, started);
    await server.close();
    server = await startServer(env, 120000);
    const listed = await server.json('/api/sessions');
    assert(listed.sessions.some((item: { id: string }) => item.id === session.id));
    assert.deepEqual((await server.json(`/api/sessions/${session.id}`)).messages, before.messages);
    const resumedAt = performance.now();
    const resumed = await collect(await server.request(`/api/sessions/${session.id}/messages`, 'POST', {
      text: '我选择 A。请根据刚才资料和候选继续约 100 字，先重复资料的核对标记，不要再次调用工具。',
    }));
    assertFinal(resumed, 'completed');
    assert(!resumed.some((event) => event.type === 'tool_start'));
    const continuedText = resumed.filter((event) => event.type === 'text_delta').map((event) => event.delta).join('');
    assert.match(continuedText, /灯塔-731/);
    record('resume', session.id, resumed, resumedAt);
    const stopping = await server.json('/api/sessions', 'POST', { projectPath }, 201);
    const stoppedAt = performance.now();
    const stopped: AgentEvent[] = [];
    let requestedStop = false;
    for await (const event of events(await server.request(`/api/sessions/${stopping.id}/messages`, 'POST', {
      text: '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。',
    }))) {
      stopped.push(event);
      if (event.type === 'text_delta' && !requestedStop) {
        requestedStop = true;
        assert.equal((await server.json(`/api/sessions/${stopping.id}/stop`, 'POST')).status, 'idle');
      }
    }
    assert(requestedStop);
    assertFinal(stopped, 'aborted');
    const final = await server.json(`/api/sessions/${stopping.id}`);
    assert.equal(final.status, 'idle');
    assert.equal(final.messages.at(-1).outcome, 'aborted');
    record('abort', stopping.id, stopped, stoppedAt);
    await writeFile(resolve(directory, 'report.json'), JSON.stringify({ passed: true, provider, model, reports }, null, 2), 'utf8');
    console.log(`真实 HTTP 验收通过，记录目录：${directory}`);
  } finally {
    await server.close();
  }
}

main().catch((error: unknown) => {
  // 断言仅操作公开接口的脱敏数据；不打印供应商异常或本机配置内容。
  console.error(error instanceof assert.AssertionError ? `真实验收断言失败：${error.message}` : '真实验收失败，请检查本机配置与服务状态。');
  process.exitCode = 1;
});
