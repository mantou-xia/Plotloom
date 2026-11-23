import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentPreview, appendSourceDraft } from '../../apps/api-demo/src/sources.ts';
import { API_CATALOG } from '../../packages/contracts/src/catalog.ts';

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

test('试验台在发送消息和读取会话登记选区修改协议与可编辑样例', () => {
  const send = API_CATALOG.find(endpoint => endpoint.id === 'generation.send')!;
  const history = API_CATALOG.find(endpoint => endpoint.id === 'sessions.get')!;
  const example = send.examples.find(item => item.name === '审批后修改章节选区')!;
  assert.match(send.note ?? '', /tool_approval_required/);
  assert(send.request.some(field => field.name === 'references[].editComment'));
  assert(history.response.some(field => field.name === 'messages[].references[].lineRange'));
  assert.deepEqual(example.body.references, [{ workspaceId: '替换为当前小说ID', path: '正文章节/第一章.md', version: 'a'.repeat(64),
    selection: { start: 0, end: 2, text: '林舟' }, editComment: '请将选区改成“陆舟”。' }]);
  const deletion = send.examples.find(item => item.name === '只删除选区中点名的短语');
  assert.match(JSON.stringify(deletion?.body), /第二声没喊全，他就哭得弯下了腰/);
});
