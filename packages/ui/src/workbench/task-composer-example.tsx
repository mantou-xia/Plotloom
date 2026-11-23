import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TaskComposer } from '../task-composer/task-composer.tsx';
import { Button } from '../button/button.tsx';
import type { PreviewControls } from './controls.ts';

/** 调试台展示公开参数与回调；重置样例验证清空数据时仍保留输入框和模型控件。 */
export function TaskComposerExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [stopped, setStopped] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const attachmentDropTarget = useRef<HTMLDivElement>(null);
  useEffect(() => { setStopped(false); }, [controls.composerBusy]);
  return <div ref={attachmentDropTarget} style={{ ...style, position: 'relative' }}>
    {state === 'reset-draft' ? <Button variant="secondary" onClick={() => {
      setDraftKey(value => value + 1); onAction('draftKey 改变：原位清空草稿');
    }}>重置草稿</Button> : null}
    <TaskComposer draftContext={state === 'draft-context' ? <div>第一章.md · 第 2 行</div> : undefined} options={{
      draftKey,
      hasDraftContext: state === 'draft-context',
      attachmentDropTarget,
      height: controls.height.mode === 'fixed' ? controls.height.value : 480,
      disabled: controls.disabled,
      busy: controls.composerBusy && !stopped,
      stopping: controls.composerStopping,
      reducedMotion: controls.composerReducedMotion ? true : undefined,
      models: state === 'no-models' ? [] : ['deepseek-chat', 'deepseek-reasoner'],
      modelNames: { 'deepseek-chat': 'deepseek-chat', 'deepseek-reasoner': 'deepseek-reasoner' },
      modelLabels: { 'deepseek-chat': 'deepseek-chat · DeepSeek', 'deepseek-reasoner': 'deepseek-reasoner · DeepSeek' },
      onModelChange: model => onAction('onModelChange(' + model + ')'),
      onValueChange: value => onAction('onValueChange(' + value + ')'),
      onPermissionChange: permission => onAction('onPermissionChange(' + permission + ')'),
      onSubmit: message => onAction('onSubmit(' + JSON.stringify(message) + ')'),
      onStop: controls.composerStop ? () => { setStopped(true); onAction('onStop()'); } : undefined,
    }} />
  </div>;
}
