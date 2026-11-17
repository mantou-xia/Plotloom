import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import type { AgentEvent } from '../../packages/contracts/src/index.ts';

/** 用真实监听端口和独立服务进程验证公开接口，包括重启，避免内存实例掩盖落盘问题。 */
export async function startServer(env: NodeJS.ProcessEnv, requestTimeoutMs = 20000) {
  const child = fork(fileURLToPath(new URL('../../apps/server/src/main.ts', import.meta.url)), [], {
    // 环境显式传递；禁止继承父进程的 --input-type、--test 或 env-file 启动参数。
    env: { ...process.env, ...env, PLOTLOOM_PORT: '0' }, execArgv: [], silent: true,
  });
  let logs = '';
  child.stdout?.on('data', (data) => { logs += data; });
  child.stderr?.on('data', (data) => { logs += data; });
  const address = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('服务启动超时')); }, 20000);
    child.once('message', (value) => { clearTimeout(timer); resolve((value as { address: string }).address); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`服务启动退出 ${code}: ${logs}`)); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
  const request = async (path: string, method = 'GET', body?: unknown) => fetch(`${address}${path}`, {
    method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const json = async <T = any>(path: string, method = 'GET', body?: unknown, expected = 200): Promise<T> => {
    const response = await request(path, method, body);
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data as T;
  };
  return { address, child, request, json, logs: () => logs, close: (force = false) => stopProcess(child, force) };
}

async function stopProcess(child: ChildProcess, force: boolean) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  if (force) child.kill('SIGKILL');
  else child.send('shutdown');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  try { await exited; } finally { clearTimeout(timer); }
}

/** 按 SSE 分帧而非网络 chunk 分帧；同一解析器用于确定性测试与真实模型验收。 */
export async function* events(response: Response): AsyncGenerator<AgentEvent> {
  assert.equal(response.status, 200, await (response.status === 200 ? Promise.resolve('') : response.text()));
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, end);
        pending = pending.slice(end + 2);
        const type = frame.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
        const data = frame.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
        if (type && data) yield { type, ...JSON.parse(data) } as AgentEvent;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function collect(response: Response): Promise<AgentEvent[]> {
  const result: AgentEvent[] = [];
  for await (const event of events(response)) result.push(event);
  return result;
}

export function assertFinal(result: AgentEvent[], outcome: 'completed' | 'failed' | 'aborted') {
  assert.equal(result[0]?.type, 'accepted');
  assert.equal(result.at(-1)?.type, outcome);
  assert.equal(result.filter((event) => ['completed', 'failed', 'aborted'].includes(event.type)).length, 1);
}
