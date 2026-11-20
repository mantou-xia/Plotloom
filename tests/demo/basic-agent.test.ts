import assert from 'node:assert/strict';
import test from 'node:test';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';

test('试验台登记最新重试、可见过程和浏览器来源', () => {
  const retry = API_CATALOG.find(item => item.id === 'generation.retry')!;
  assert.equal(retry.path, '/api/sessions/:id/retry'); assert(retry.stream);
  assert(retry.examples.some(example => (example.body as any).messageId));
  assert.match(retry.note, /RETRY_UNAVAILABLE/); assert.match(retry.note, /SESSION_BUSY/);
  const detail = API_CATALOG.find(item => item.path === '/api/sessions/:id' && item.method === 'GET')!;
  for (const name of ['retryMessageId', 'messages[].turnId', 'messages[].elapsedSeconds', 'messages[].phase', 'messages[].streaming', 'messages[].content[].input', 'messages[].content[].source.url']) {
    assert(detail.response.some(field => field.name === name), name);
  }
});
