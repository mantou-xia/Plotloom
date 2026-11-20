import type { CSSProperties } from 'react';
import { MessageActions } from '../message-actions/message-actions.tsx';
import type { PreviewControls } from './controls.ts';

/** 延迟回调仅演示等待、失败和重试，不模拟或连接真实模型业务。 */
export function MessageActionsExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  async function regenerate() {
    onAction('onRegenerate：开始');
    await new Promise(resolve => window.setTimeout(resolve, 1200));
    if (state === 'failure') throw new Error('示例回调失败');
    onAction('onRegenerate：回调完成');
  }
  return <MessageActions text={controls.messageActionsText} style={style} disabled={controls.disabled}
    regenerating={controls.messageActionsRegenerating} regenerateDisabled={controls.messageActionsRegenerateDisabled}
    onRegenerate={controls.messageActionsShowRegenerate ? regenerate : undefined}
    onCopy={() => onAction('onCopy：已复制回答原文')}
    onError={action => onAction(`onError：${action}`)} />;
}
