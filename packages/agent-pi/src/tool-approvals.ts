import { randomUUID } from 'node:crypto';
import type { ToolApproval, ToolApprovalDecision } from '@plotloom/contracts';
import { AgentError } from './errors.ts';

export type ApprovalOutcome = ToolApprovalDecision | 'cancelled' | 'expired';
const approvalLifetimeMs = 120_000;
interface Pending {
  approval: ToolApproval;
  finish: (decision: ApprovalOutcome) => void;
}

/** 一个会话只管理本轮未决批准。删除后才唤醒工具，防止并发请求复用批准。 */
export class ToolApprovals {
  private readonly pending = new Map<string, Pending>();

  get hasPending() { return this.pending.size > 0; }

  list() { return [...this.pending.values()].map(item => item.approval); }

  wait(input: Omit<ToolApproval, 'id' | 'expiresAt'>, signal: AbortSignal | undefined, publish: (item: ToolApproval) => void) {
    if (signal?.aborted) return Promise.resolve<ApprovalOutcome>('cancelled');
    const approval: ToolApproval = { ...input, id: randomUUID(), expiresAt: new Date(Date.now() + approvalLifetimeMs).toISOString() };
    const result = Promise.withResolvers<ApprovalOutcome>();
    const cancel = () => finish('cancelled');
    const timer = setTimeout(() => finish('expired'), approvalLifetimeMs);
    const finish = (decision: ApprovalOutcome) => {
      if (!this.pending.delete(approval.id)) return;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      result.resolve(decision);
    };
    this.pending.set(approval.id, { approval, finish });
    signal?.addEventListener('abort', cancel, { once: true });
    publish(approval);
    return result.promise;
  }

  decide(id: string, decision: ToolApprovalDecision) {
    const item = this.pending.get(id);
    if (item && Date.parse(item.approval.expiresAt) <= Date.now()) item.finish('expired');
    else if (item) {
      item.finish(decision);
      return { id, decision };
    }
    throw new AgentError(409, 'TOOL_APPROVAL_UNAVAILABLE', '审批请求已结束或不属于当前会话。');
  }

  cancel() { for (const item of this.pending.values()) item.finish('cancelled'); }
}
