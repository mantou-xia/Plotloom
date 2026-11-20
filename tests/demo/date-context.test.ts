import assert from 'node:assert/strict';
import test from 'node:test';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';

test('试验台提供日期核对入口，说明日期来源与重试时更新', () => {
  const send = API_CATALOG.find(endpoint => endpoint.id === 'generation.send')!;
  assert(send.examples.some(example => example.name === '核对当前日期' && (example.body as { text: string }).text.includes('时区')));
  assert.match(send.description, /本机时区/);
  assert.match(send.description, /不改写系统提示和旧消息/);
  const retry = API_CATALOG.find(endpoint => endpoint.id === 'generation.retry')!;
  assert.match(retry.description, /不沿用原请求日期/);
  assert.match(API_CATALOG.find(endpoint => endpoint.id === 'writing.send')!.description, /本轮模型输入末尾提供当前日期/);
});
