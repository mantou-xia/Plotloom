import assert from 'node:assert/strict';
import test from 'node:test';
import { mapMessage } from '../../packages/agent-pi/src/messages.ts';

test('思考公开映射只保留可见文本，排除签名和已隐去内容', () => {
  const mapped = mapMessage('m1', {
    role: 'assistant', api: 'openai-responses', provider: 'test', model: 'test', timestamp: 0, stopReason: 'stop',
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    content: [{ type: 'thinking', thinking: '可见摘要', thinkingSignature: 'private-signature' },
      { type: 'thinking', thinking: '不可公开内容', thinkingSignature: 'encrypted-payload', redacted: true },
      { type: 'text', text: '正文', textSignature: 'private-text-signature' }],
  });
  assert.deepEqual(mapped?.content, [{ type: 'thinking', text: '可见摘要' }, { type: 'text', text: '正文' }]);
  assert.doesNotMatch(JSON.stringify(mapped), /private|encrypted|不可公开/);
});
