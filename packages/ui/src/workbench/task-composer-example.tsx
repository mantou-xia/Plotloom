import { useEffect, useState, type CSSProperties } from 'react';
import { TaskComposer } from '../task-composer/task-composer.tsx';
import type { PreviewControls } from './controls.ts';

/** 调试台只传原版公开参数并记录回调，不增加原版之外的按钮、布局或模拟业务。 */
export function TaskComposerExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [stopped, setStopped] = useState(false);
  useEffect(() => { setStopped(false); }, [controls.composerBusy]);
  return <div style={style}>
    <TaskComposer options={{
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
