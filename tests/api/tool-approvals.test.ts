import assert from 'node:assert/strict';
import test from 'node:test';
import { ToolApprovals } from '../../packages/agent-pi/src/tool-approvals.ts';

test('审批到期立即失效，迟到的决定不能放行', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const approvals = new ToolApprovals();
  const waiting = approvals.wait({ turnId: 'turn', callId: 'call', operation: 'create', path: 'draft.md', preview: '合成资料' }, undefined, () => {});
  const [approval] = approvals.list();
  t.mock.timers.tick(120_000);
  assert.equal(await waiting, 'expired');
  assert.deepEqual(approvals.list(), []);
  assert.throws(() => approvals.decide(approval.id, 'approve'), { code: 'TOOL_APPROVAL_UNAVAILABLE' });
});
