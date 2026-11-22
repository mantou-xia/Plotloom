import { useState, type CSSProperties } from 'react';
import { ToolApprovalCard, type ToolApprovalState } from '../tool-approval/tool-approval-card.tsx';

/** 调试台只演示决定和原位反馈，操作样例不会访问文件。 */
export function ToolApprovalExample({ state, style, onAction }: {
  state: string;
  style: CSSProperties;
  onAction: (action: string) => void;
}) {
  const [status, setStatus] = useState<ToolApprovalState>(state === 'default' || state === 'long' || state === 'submitting' ? 'pending' : state as ToolApprovalState);
  return <ToolApprovalCard style={style} operation="修改项目文件" path="draft/第一章.md"
    preview={state === 'long' ? '雨势渐歇，渡船靠岸。\n'.repeat(90) : '− 雨停了，她推开门。\n+ 雨势渐歇，她轻轻推开门。'}
    state={status} submitting={state === 'submitting'} onDecision={decision => {
      setStatus(decision === 'approve' ? 'approved' : 'denied');
      onAction(decision === 'approve' ? '允许一次' : '拒绝');
    }} />;
}
