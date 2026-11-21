import { useId, type CSSProperties } from 'react';
import { FilePenLine } from 'lucide-react';
import { Button } from '../button/button.tsx';
import './tool-approval-card.css';

export type ToolApprovalState = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';
export interface ToolApprovalCardProps {
  operation: string;
  path: string;
  preview: string;
  state: ToolApprovalState;
  pendingLabel?: string;
  submitting?: boolean;
  stopping?: boolean;
  onStop?: () => void;
  onDecision?: (decision: 'approve' | 'deny') => void;
  style?: CSSProperties;
}

const labels: Record<ToolApprovalState, string> = {
  pending: '等待审批', approved: '已允许本次操作', denied: '已拒绝',
  expired: '请求已过期', cancelled: '请求已取消',
};

/** 只展示待审批的操作及决定。批准状态表示用户授权，执行结果由调用方另外展示。 */
export function ToolApprovalCard({ operation, path, preview, state, pendingLabel = labels.pending, submitting, stopping, onStop, onDecision, style }: ToolApprovalCardProps) {
  const title = useId();
  const disabled = state !== 'pending' || submitting || !onDecision;
  return <section className="pl-tool-approval" aria-labelledby={title} style={style}>
    <header className="pl-tool-approval__header">
      <FilePenLine size={18} aria-hidden="true" />
      <h3 id={title}>{operation}</h3>
    </header>
    <code className="pl-tool-approval__path">{path}</code>
    <pre className="pl-tool-approval__preview" tabIndex={0} aria-label="变更预览">{preview}</pre>
    <footer className="pl-tool-approval__footer">
      <span role="status">{stopping ? '正在停止…' : submitting ? '正在提交决定…' : state === 'pending' ? pendingLabel : labels[state]}</span>
      <div className="pl-tool-approval__actions">
        {onStop ? <Button size="sm" variant="text" disabled={stopping} onClick={onStop}>停止任务</Button> : null}
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDecision?.('deny')}>拒绝</Button>
        <Button size="sm" disabled={disabled} onClick={() => onDecision?.('approve')}>允许一次</Button>
      </div>
    </footer>
  </section>;
}
