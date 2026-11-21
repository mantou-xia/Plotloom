import assert from 'node:assert/strict';
import test from 'node:test';
import { API_CATALOG, SSE_EVENTS } from '../../packages/contracts/src/catalog.ts';
import { checkFields } from '../../apps/api-demo/src/client.ts';

test('试验台登记最新重试、可见过程和浏览器来源', () => {
  const retry = API_CATALOG.find(item => item.id === 'generation.retry')!;
  assert.equal(retry.path, '/api/sessions/:id/retry'); assert(retry.stream);
  assert(retry.examples.some(example => (example.body as any).messageId));
  assert.match(retry.note, /RETRY_UNAVAILABLE/); assert.match(retry.note, /SESSION_BUSY/);
  assert.match(retry.note, /REVISION_CONFLICT/);
  for (const field of ['结构化创作', '目标与选区', '参考资料版本', '字符预算', '思考档位']) {
    assert(retry.description.includes(field), field);
  }
  assert(retry.examples.some(example => example.name.includes('结构化创作')));
  const detail = API_CATALOG.find(item => item.path === '/api/sessions/:id' && item.method === 'GET')!;
  for (const name of ['retryMessageId', 'messages[].turnId', 'messages[].elapsedSeconds', 'messages[].phase', 'messages[].streaming', 'messages[].content[].input', 'messages[].content[].source.url']) {
    assert(detail.response.some(field => field.name === name), name);
  }
});

test('试验台检查已结束轮次的文件列表、增删统计和对比记录 ID', () => {
  const detail = API_CATALOG.find(item => item.id === 'sessions.get')!;
  for (const field of ['turnId', 'files[].path', 'files[].added', 'files[].removed', 'files[].writeIds[]']) {
    assert(detail.response.some(item => item.name === 'fileChanges[].' + field));
  }
  const fields = detail.response.filter(item => item.name.startsWith('fileChanges'));
  assert(checkFields(detail.responseExample, fields).every(check => check.passed));
  assert(checkFields({}, fields).every(check => check.passed));
  assert(checkFields({ fileChanges: [{ files: [{ added: '2' }] }] }, fields).some(check => !check.passed));
});

test('工具审批登记决定路由、刷新快照和等待事件', () => {
  const config = API_CATALOG.find(item => item.id === 'sessions.set-config')!;
  assert(config.request.some(field => field.name === 'projectApprovalMode'));
  for (const mode of ['required', 'full_access']) {
    assert(config.examples.some(example => (example.body as { projectApprovalMode?: string }).projectApprovalMode === mode));
  }
  assert(API_CATALOG.find(item => item.id === 'sessions.get-config')?.response.some(field => field.name === 'projectApprovalMode'));
  const decide = API_CATALOG.find(item => item.id === 'generation.tool-approval')!;
  assert.equal(decide.path, '/api/sessions/:id/tool-approvals/:approvalId');
  assert.deepEqual(decide.examples.map(example => (example.body as { decision: string }).decision), ['approve', 'deny']);
  assert.match(decide.note, /TOOL_APPROVAL_UNAVAILABLE/);
  const detail = API_CATALOG.find(item => item.id === 'sessions.get')!;
  assert(detail.response.some(field => field.name === 'pendingApprovals[].expiresAt'));
  for (const id of ['sessions.get', 'context.get', 'chats.list']) {
    assert(API_CATALOG.find(item => item.id === id)?.response.some(field =>
      field.name.endsWith('activity') && field.type.includes('awaiting_approval')), id);
  }
  const event = SSE_EVENTS.find(item => item.name === 'tool_approval_required')!;
  assert(event.fields.some(field => field.name === 'approval.id'));
});

test('选择题登记回答方式、刷新快照与等待事件', () => {
  const reply = API_CATALOG.find(item => item.id === 'generation.answer-question')!;
  assert.deepEqual(reply.examples.map(example => example.body.kind), ['option', 'custom', 'skip']);
  assert.match(reply.note, /INVALID_QUESTION_OPTION/);
  assert.match(reply.note, /QUESTION_UNAVAILABLE/);
  const event = SSE_EVENTS.find(item => item.name === 'user_answer_required')!;
  const question = { id: 'id', callId: 'call', question: '选择视角？', options: ['A', 'B'] };
  assert(checkFields({ question }, event.fields).every(check => check.passed));
  assert(checkFields({ question: { ...question, options: 'A/B' } }, event.fields).some(check => !check.passed));
  const detail = API_CATALOG.find(item => item.id === 'sessions.get')!;
  assert(detail.response.some(field => field.name === 'pendingQuestion.options'));
  assert(detail.response.some(field => field.name === 'activity' && field.type.includes('awaiting_answer')));
});
