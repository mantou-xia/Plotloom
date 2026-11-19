import { DeepAgentComposer } from './original/DeepAgentComposer.tsx';
import type { DeepAgentComposerOptions } from './original/DeepAgentComposerEngine.js';
import './task-composer.css';
export type { DeepAgentComposerOptions as TaskComposerOptions } from './original/DeepAgentComposerEngine.js';
export type { ComposerMessage, ComposerAttachment, ComposerSkill, ComposerMention } from './original/DeepAgentComposerEngine.js';

/** 使用原版入口与动效；宿主只固定原站的字号基线，避免继承调试台字号导致尺寸变化。 */
export function TaskComposer({ options, className = '' }: { options?: DeepAgentComposerOptions; className?: string }) {
  return <DeepAgentComposer options={options} className={`plotloom-task-composer ${className}`} />;
}
