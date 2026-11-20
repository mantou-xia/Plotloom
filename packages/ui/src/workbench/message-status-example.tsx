import type { CSSProperties } from 'react';
import { MessageStatus } from '../message-status/message-status.tsx';
import type { PreviewControls } from './controls.ts';

/** 只演示状态参数与异步回调；真实生成阶段由业务页面在后续接入。 */
export function MessageStatusExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  async function retry() {
    onAction('onRetry：开始');
    await new Promise(resolve => window.setTimeout(resolve, 1200));
    if (state === 'retry-error') throw new Error('示例重试请求失败');
    onAction('onRetry：回调完成');
  }
  return <MessageStatus status={controls.messageStatus === 'hidden' ? null : controls.messageStatus}
    errorMessage={controls.messageStatusError} retrying={controls.messageStatusRetrying} retryDisabled={controls.disabled}
    onRetry={controls.messageStatusCanRetry ? retry : undefined} onRetryError={() => onAction('onRetryError')}
    style={style} />;
}
