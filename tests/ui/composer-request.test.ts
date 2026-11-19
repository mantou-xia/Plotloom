import assert from 'node:assert/strict';
import test from 'node:test';
import { composerRequest } from '../../apps/web/src/features/agent/composer-request.ts';

test('编辑器技能与项目引用还原为可读消息，附件只发送已上传 ID', () => {
  assert.deepEqual(composerRequest({ text: '请用 \uE000 阅读 \uE001', model: 'm', thinking: 'high', permission: 'default',
    skills: [{ id: 's', name: '检查工程' }], mentions: [{ kind: 'file', relPath: 'src/入口.ts' }],
    attachments: [{ id: 'saved', name: 'a.txt', kind: 'text', status: 'ready', extractedText: '不能混入正文' }] }),
  { text: '请用 $检查工程 阅读 @src/入口.ts', skillIds: ['s'], attachmentIds: ['saved'] });
});

test('纯附件不制造占位正文，原始换行与中文保留', () => {
  const base = { model: 'm', thinking: 'off', permission: 'default', skills: [], mentions: [], attachments: [{ id: 'a', name: '图.png', kind: 'image', status: 'ready' }] };
  assert.equal(composerRequest({ ...base, text: '' }).text, '');
  assert.equal(composerRequest({ ...base, text: '第一行\n第二行😀' }).text, '第一行\n第二行😀');
});
