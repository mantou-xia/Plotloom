import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { dateContext } from '../../packages/agent-pi/src/date-context.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';
import { collect, assertFinal } from './client.ts';

test('日期遵循指定时区的日界线，日内内容稳定且没有精确时间', () => {
  const instant = new Date('2026-11-20T16:00:00Z');
  assert.match(dateContext(instant, 'Asia/Shanghai'), /2026年11月21日星期六/);
  assert.match(dateContext(instant, 'America/Los_Angeles'), /2026年11月20日星期五/);
  assert.equal(dateContext(instant, 'Asia/Shanghai'), dateContext(new Date('2026-11-21T15:59:59Z'), 'Asia/Shanghai'));
  assert.match(dateContext(instant, 'Asia/Shanghai'), /时区：Asia\/Shanghai/);
});

/** 捕获真实 SDK 发出的模型协议，验证日期变化不会改写已经发送的历史前缀；不伪造缓存命中数。 */
test('日期上下文 HTTP：前缀稳定、跨天、重试、恢复及压缩', { timeout: 60000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'plotloom-date-'));
  const projectPath = join(directory, 'project'); await mkdir(projectPath);
  await writeFile(join(projectPath, 'scene.md'), '核对标记：灯塔-731。');
  const fixture = await createModelFixture();
  const modelsPath = join(directory, 'models.json');
  await writeFile(modelsPath, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: fixture.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 2048,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const options = { dataDir: join(directory, 'data'), modelsPath, defaultModel: { provider: 'test', model: 'fixture' }, apiKey: TEST_KEY };
  let app = await buildServer(options);
  let address = await app.listen({ host: '127.0.0.1', port: 0 });
  const request = (path: string, method = 'GET', body?: unknown) => fetch(address + path, { method,
    headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async (path: string, method = 'GET', body?: unknown): Promise<any> => {
    const response = await request(path, method, body); assert(response.ok, await (!response.ok ? response.text() : Promise.resolve('')));
    return response.json();
  };
  const contents = (message: any): string => typeof message.content === 'string' ? message.content : (message.content ?? []).map((part: any) => part.text ?? '').join('');
  const contexts = (body: any): string[] => body.messages.flatMap((message: any) => contents(message).match(/<plotloom_date_context>[\s\S]*<\/plotloom_date_context>/) ?? []);
  const lastRequest = () => fixture.requests.at(-1);
  let previous: any;
  const checkPrefix = () => {
    const current = lastRequest();
    if (previous) {
      assert.deepEqual(current.messages.slice(0, previous.messages.length), previous.messages, '已发送消息必须作为完整前缀保留');
      assert.deepEqual(current.tools, previous.tools, '日期不能改变工具定义');
    }
    assert.doesNotMatch(contents(current.messages[0]), /plotloom_date_context|2026年11月/);
    assert.equal(contexts(current).at(-1), dateContext());
    previous = current;
  };
  try {
    // 只模拟 Date，真实网络、定时器、SDK、JSONL 和接口均继续运行。
    t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 20, 23, 59, 0) });
    const { id } = await json('/api/sessions', 'POST', { projectPath });
    const path = `/api/sessions/${id}`;
    const send = async (text: string) => { assertFinal(await collect(await request(`${path}/messages`, 'POST', { text })), 'completed'); };
    await send('今天是几号？'); checkPrefix();
    const firstDate = contexts(lastRequest()).at(-1)!;
    assert.match(firstDate, /2026年11月20日星期五/);
    t.mock.timers.setTime(new Date(2026, 10, 20, 23, 59, 59).getTime());
    await send('再核对日期'); checkPrefix();
    assert.equal(contexts(lastRequest()).at(-1), firstDate);

    t.mock.timers.setTime(new Date(2026, 10, 21, 0, 0, 1).getTime());
    await send('现在是几号？'); checkPrefix();
    assert.match(contexts(lastRequest()).at(-1)!, /2026年11月21日星期六/);
    const before = await json(path);
    assert.deepEqual(before.messages.filter((message: any) => message.role === 'user').map((message: any) => message.content),
      ['今天是几号？', '再核对日期', '现在是几号？'].map(text => [{ type: 'text', text }]));
    assert.doesNotMatch(JSON.stringify(before), /plotloom_date_context/);

    await app.close(); app = await buildServer(options); address = await app.listen({ host: '127.0.0.1', port: 0 });
    assert.deepEqual(await json(path), before, '重启不能改变公开历史');
    t.mock.timers.setTime(new Date(2026, 10, 22, 0, 0, 1).getTime());
    assertFinal(await collect(await request(`${path}/retry`, 'POST', { messageId: before.retryMessageId })), 'completed'); checkPrefix();
    assert.match(contexts(lastRequest()).at(-1)!, /2026年11月22日星期日/);
    assert.equal(contents(lastRequest().messages.at(-1)), `现在是几号？\n\n${dateContext()}`);

    // 工具循环沿用本轮日期，不在每次工具返回后插入新上下文。
    const offset = fixture.requests.length;
    await send('TOOL');
    const calls = fixture.requests.slice(offset);
    assert.equal(calls.length, 2);
    assert.equal(contexts(calls[0]).length, contexts(calls[1]).length);
    assert.deepEqual(calls[1].messages.slice(0, calls[0].messages.length), calls[0].messages);

    await send('SEED_COMPACTION');
    await json(`${path}/compact`, 'POST', {});
    t.mock.timers.setTime(new Date(2026, 10, 23, 0, 0, 1).getTime());
    await send('压缩后今天几号？');
    assert.equal(contexts(lastRequest()).at(-1), dateContext());
    assert.match(contexts(lastRequest()).at(-1)!, /2026年11月23日星期一/);
    assert.deepEqual(fixture.errors, []);
  } finally {
    t.mock.timers.reset();
    await app.close(); await fixture.close(); await rm(directory, { recursive: true, force: true });
  }
});
