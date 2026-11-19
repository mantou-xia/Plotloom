import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentPreview, appendSourceDraft } from '../../apps/api-demo/src/sources.ts';

const escape = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
test('试验台附件预览不执行文本中的 HTML，也不接受任意 data URL 类型', () => {
  const preview = attachmentPreview({ name: '<script>.txt', mimeType: 'text/plain', data: Buffer.from('<img src=x onerror=alert(1)>\n中文😀').toString('base64') }, escape);
  assert.match(preview, /&lt;img/); assert.match(preview, /中文😀/); assert.doesNotMatch(preview, /<script>|<img/);
  assert.equal(attachmentPreview({ name: 'a', mimeType: 'text/html', data: 'aA==' }, escape), '');
  const image = attachmentPreview({ name: '" onerror="alert(1)', mimeType: 'image/png', data: 'aA==' }, escape);
  assert.match(image, /alt="&quot; onerror=&quot;/); assert.doesNotMatch(image, /alt="" onerror=/);
});
test('试验台加入来源保留已有文字和技能，重复点击不重复引用', () => {
  const existing = JSON.stringify({ text: '原始文字', skillIds: ['skill-id'], attachmentIds: ['a'] });
  const source = { workspaceId: 'w', path: '资料.md', version: 'v' };
  const next = appendSourceDraft(appendSourceDraft(existing, 'attachmentIds', 'a'), 'references', source);
  assert.deepEqual(JSON.parse(appendSourceDraft(next, 'references', source)), { text: '原始文字', skillIds: ['skill-id'], attachmentIds: ['a'], references: [source] });
  assert.throws(() => appendSourceDraft('null', 'attachmentIds', 'a'));
});
