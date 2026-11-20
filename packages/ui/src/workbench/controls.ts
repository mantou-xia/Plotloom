import type { AgentActivity, AgentPhase, ParticleShape } from '../agent-activity/activity.ts';
import { markdownSamples } from './markdown-samples.ts';
import { readerFrameSample } from './workspace-frame-samples.ts';
import { codeBlockSamples } from './code-block-samples.ts';
import { thinkingSamples } from './thinking-content-samples.ts';
import { processSamples, toolSamples } from './agent-process-samples.ts';
import type { ExecutionEntry } from '../execution-timeline/types.ts';
import type { ToolCallData } from '../tool-call/tool-call-item.tsx';
import { userMessageSamples } from './user-message-samples.ts';
import type { TextEmergenceEffect } from '../markdown/markdown-renderer.tsx';
import type { CSSProperties } from 'react';
import type { ButtonSize, ButtonVariant } from '../button/button.tsx';
import type { CardMaterial } from '../card/card.tsx';

export interface ComponentDimension { mode: 'auto' | 'fixed' | 'fill'; value: number }
export interface PreviewControls {
  settingsTitle: string;
  settingsDescription: string;
  readerFrameName: string;
  readerFramePath: string;
  readerFrameContent: string;
  browserFrameUrl: string;
  frameCustomToolbar: boolean;
  messageStatus: 'waiting' | 'failed' | 'stopped' | 'hidden';
  messageStatusError: string;
  messageStatusRetrying: boolean;
  messageStatusCanRetry: boolean;
  messageActionsText: string;
  messageActionsRegenerating: boolean;
  messageActionsRegenerateDisabled: boolean;
  messageActionsShowRegenerate: boolean;
  splitPanelTitle: string;
  splitMinWidth: number;
  splitMaxWidth: number;
  splitBreakpoint: number;
  sourceTitle: string;
  sourceUrl: string;
  sourcePath: string;
  sourceSummary: string;
  sourceExcerpt: string;
  sourceOpenFile: boolean;
  citationIndex: number;
  citationTitle: string;
  citationActive: boolean;
  userMessageText: string;
  userMessageAttachments: boolean;
  thinkingContent: string;
  thinkingStreaming: boolean;
  timelinePhase: AgentPhase;
  timelineStreaming: boolean;
  timelineHeight: number;
  timelineItems: ExecutionEntry[];
  toolData: ToolCallData;
  agentPhase: AgentPhase;
  agentTool: string;
  agentActivity: AgentActivity | 'auto';
  agentShape: ParticleShape | 'auto';
  agentLabel: string;
  agentHeight: number;
  agentElapsed: number;
  agentShowElapsed: boolean;
  agentReducedMotion: boolean;
  agentContent: string;
  codeBlockContent: string;
  codeBlockLanguage: string;
  codeBlockStreaming: boolean;
  markdownContent: string;
  markdownStreaming: boolean;
  markdownTextEffect: TextEmergenceEffect;
  showBoxModel: boolean;
  dialogDescription: string;
  tooltipContent: string;
  tooltipDelay: number;
  tooltipShake: boolean;
  cardBorderRadius: number;
  cardBackgroundColor: string;
  cardBordered: boolean;
  cardMaterial: CardMaterial;
  width: ComponentDimension;
  height: ComponentDimension;
  text: string;
  variant: ButtonVariant;
  buttonSize: ButtonSize;
  danger: boolean;
  loading: boolean;
  buttonIcon: 'none' | 'start' | 'end' | 'both' | 'only';
  disabled: boolean;
  formReadOnly: boolean;
  formRequired: boolean;
  formError: string;
  formLabel: string;
  formDescription: string;
  formPlaceholder: string;
  formClearable: boolean;
  formSearchable: boolean;
  formMultiple: boolean;
  formShowCount: boolean;
  formIndeterminate: boolean;
  formInputType: 'text' | 'password' | 'email';
  formMin: number;
  formMax: number;
  formStep: number;
  composerBusy: boolean;
  composerStop: boolean;
  composerStopping: boolean;
  composerReducedMotion: boolean;
  sidebarActive: boolean;
  sidebarExpanded: boolean;
  sidebarIcon: boolean;
  sidebarGroupIcon: 'folder' | 'book';
  sidebarActions: boolean;
  sidebarContentState: 'ready' | 'empty' | 'error';
  sidebarEmptyText: string;
  sidebarErrorText: string;
  sessionTimeLabel: string;
  sessionStatus: 'none' | 'running' | 'unread' | 'failed';
  sessionPinned: boolean;
  sessionPinDisabledReason: string;
  sessionArchiveDisabledReason: string;
  sidebarRowHeight: number;
  sidebarIconSize: number;
  sidebarGap: number;
  sidebarIndent: number;
  sidebarIndicatorWidth: number;
  sidebarIndicatorHeight: number;
  pageTitle: string;
  pageActions: boolean;
  maxWidth: number;
  oceanPaused: boolean;
  oceanSpeed: number;
  padding: number;
  gap: number;
  sidebarWidth: number;
  swatchSize: number;
  orientation: 'vertical' | 'horizontal' | 'both';
  scrollbarVisibility: 'auto' | 'always' | 'hidden';
}

/** 样例只提供初始参数；后续控件直接编辑同一份配置，避免样例与属性相互覆盖。 */
export function defaultControls(component: string, state: string): PreviewControls {
  return {
    settingsTitle: component === 'settings-section' ? '示例分组' : '示例设置',
    settingsDescription: state === 'without-description' ? '' : '说明此设置的用途，实际值和保存逻辑由调用方管理。',
    readerFrameName: '工作区阅读指南.md',
    readerFramePath: 'docs/工作区阅读指南.md',
    readerFrameContent: readerFrameSample,
    browserFrameUrl: 'https://example.test/guide',
    frameCustomToolbar: state === 'custom',
    messageStatus: state === 'waiting' || state === 'stopped' || state === 'hidden' ? state : 'failed',
    messageStatusError: state === 'long-error' ? '模型服务暂时不可用，请稍后重试。'.repeat(20) : '',
    messageStatusRetrying: state === 'retrying',
    messageStatusCanRetry: state !== 'no-retry',
    messageActionsText: state === 'empty' ? '' : '## 回答示例\n\n保留 **Markdown** 与换行。\n\n```ts\nconst answer = 42;\n```\n',
    messageActionsRegenerating: state === 'regenerating',
    messageActionsRegenerateDisabled: state === 'regenerate-disabled',
    messageActionsShowRegenerate: state !== 'copy-only',
    splitPanelTitle: '右侧内容', splitMinWidth: 280, splitMaxWidth: 720, splitBreakpoint: 760,
    sourceTitle: state === 'file' ? '人物关系记录.md' : state === 'long' ? '第一章至第三章人物关系与时间线完整核对记录'.repeat(6) + '.md' : '叙事结构与人物关系资料',
    sourceUrl: state === 'invalid-link' ? 'javascript:alert(1)' : 'https://example.com/research/story-structure',
    sourcePath: state === 'long' ? '资料/' + '人物关系与时间线/'.repeat(18) + '核对记录.md' : '资料/人物关系记录.md',
    sourceSummary: state === 'long' ? '核对人物关系、章节时间与信件线索。'.repeat(30) : '整理人物首次相遇的时间，以及信件对后续情节的影响。',
    sourceExcerpt: state === 'long' ? Array.from({ length: 24 }, (_, i) => `片段 ${i + 1}\n人物首次相遇发生在雨夜，后续信件再次提到了这次相遇。`).join('\n\n') : '人物首次相遇发生在第一章的雨夜。\n\n第二章的信件再次提及这一事件，可用于核对时间顺序。',
    sourceOpenFile: true,
    citationIndex: state === 'long-title' ? 128 : 1,
    citationTitle: state === 'long-title' ? '第一章至第三章人物关系与时间线核对记录：关于雨夜相遇、信件内容及后续场景的完整来源说明'.repeat(3) : '人物关系与时间线核对记录.md',
    citationActive: state === 'active',
    userMessageText: userMessageSamples[state] ?? userMessageSamples.default,
    userMessageAttachments: state === 'attachments' || state === 'attachment-only',
    thinkingContent: thinkingSamples[state] ?? thinkingSamples.default,
    thinkingStreaming: component === 'thinking-content' && state === 'streaming',
    timelinePhase: state === 'answering' || state === 'completed' || state === 'stopped' || state === 'failed' ? state : 'working',
    timelineStreaming: state === 'streaming',
    timelineHeight: 312,
    timelineItems: processSamples[state] ?? processSamples.default,
    toolData: toolSamples[state] ?? toolSamples.default,
    agentPhase: state === 'answering' || state === 'failed' || state === 'stopped' ? state : 'working',
    agentTool: state === 'writing' ? 'write' : state === 'searching' ? 'grep' : state === 'executing' ? 'powershell' : state === 'unknown' ? 'custom_tool' : 'read',
    agentActivity: state === 'thinking' ? 'thinking' : 'auto',
    agentShape: 'auto', agentLabel: '', agentHeight: 360, agentElapsed: 20, agentShowElapsed: true, agentReducedMotion: false,
    agentContent: state === 'long' ? Array.from({ length: 18 }, (_, i) => '### 思考片段 ' + (i + 1) + '\n\n核对资料与任务要求，整理当前发现，保留可供回顾的过程内容。').join('\n\n') : '正在阅读任务资料。\n\n检查已有信息与需求之间的关系。\n\n整理需要进一步核实的内容。\n\n**根据检查结果继续处理任务。**',
    codeBlockContent: (codeBlockSamples[state] ?? codeBlockSamples.default).code,
    codeBlockLanguage: (codeBlockSamples[state] ?? codeBlockSamples.default).language,
    codeBlockStreaming: component === 'code-block' && state === 'streaming',
    markdownContent: markdownSamples[state] ?? markdownSamples.default,
    markdownStreaming: component === 'markdown' && state === 'streaming',
    markdownTextEffect: 'ink',
    showBoxModel: false,
    dialogDescription: '正文和操作通过插槽组合，关闭只通知调用方。',
    tooltipContent: state === 'long' ? '这是一段较长的提示说明，文字会在气泡内自动换行。将鼠标移到提示上可以继续阅读，按 Esc 关闭。' : '这是一条提示',
    tooltipDelay: 0,
    tooltipShake: true,
    cardBorderRadius: component === 'card' && state === 'liquid-glass' ? 32 : 8,
    cardBackgroundColor: '#ffffff',
    cardBordered: state === 'bordered',
    cardMaterial: state === 'liquid-glass' ? 'liquid-glass' : 'normal',
    width: component === 'split-pane-layout' ? { mode: state === 'narrow' ? 'fixed' : 'fill', value: 560 } : { mode: component === 'sidebar-action-button' ? 'auto' : component === 'sidebar' || component.startsWith('sidebar-') || component === 'card' && state === 'liquid-glass' ? 'fixed' : component === 'global-layout' || component === 'page-layout' || component === 'scroll-box' || component === 'ascii-ocean' ? 'fill' : 'auto', value: component === 'card' && state === 'liquid-glass' ? 360 : component === 'sidebar-action-button' ? 32 : component === 'sidebar-session-item' ? 320 : component === 'sidebar' || component.startsWith('sidebar-') ? 256 : component === 'button' ? 180 : 320 },
    height: { mode: component === 'scroll-box' || component === 'card' && state === 'liquid-glass' ? 'fixed' : component === 'sidebar' || component === 'global-layout' || component === 'page-layout' || component === 'ascii-ocean' ? 'fill' : 'auto', value: component === 'card' && state === 'liquid-glass' ? 220 : component === 'button' ? 48 : 360 },
    text: state === 'long' ? '这是一段用于检查窄容器换行的按钮文字，请观察不同宽度下的表现' : '点击试用',
    variant: state === 'secondary' || state === 'subtle' || state === 'ghost' || state === 'text' || state === 'link' ? state : 'primary',
    buttonSize: component === 'sidebar-action-button' ? 'sm' : 'md',
    danger: state === 'danger',
    loading: state === 'loading',
    buttonIcon: state === 'icons' ? 'start' : 'none',
    disabled: state === 'disabled',
    formReadOnly: state === 'readonly',
    formRequired: false,
    formError: state === 'error' ? '请检查此字段的内容' : '',
    formLabel: '示例字段',
    formDescription: '输入或选择内容，提交后查看字段值。',
    formPlaceholder: '请输入或选择…',
    formClearable: true,
    formSearchable: true,
    formMultiple: state === 'multiple',
    formShowCount: true,
    formIndeterminate: state === 'indeterminate',
    formInputType: state === 'password' ? 'password' : 'text',
    formMin: 0,
    formMax: 10,
    formStep: 0.5,
    composerBusy: state === 'busy' || state === 'stopping',
    composerStop: true,
    composerStopping: state === 'stopping',
    composerReducedMotion: state === 'reduced-motion',
    sidebarActive: state === 'selected',
    sidebarExpanded: state !== 'collapsed',
    sidebarIcon: true,
    sidebarGroupIcon: 'folder',
    sidebarActions: true,
    sidebarContentState: state === 'empty' || state === 'error' ? state : 'ready',
    sidebarEmptyText: '暂无聊天',
    sidebarErrorText: '加载失败',
    sessionTimeLabel: '3 分钟前',
    sessionStatus: state === 'unread' || state === 'failed' ? state : 'running',
    sessionPinned: state === 'pinned',
    sessionPinDisabledReason: state === 'unavailable' ? '置顶暂未开放' : '',
    sessionArchiveDisabledReason: state === 'unavailable' ? '归档暂未开放' : '',
    sidebarRowHeight: 38,
    sidebarIconSize: 16,
    sidebarGap: 8,
    sidebarIndent: 24,
    sidebarIndicatorWidth: 4,
    sidebarIndicatorHeight: 18,
    pageTitle: '页面标题',
    pageActions: true,
    maxWidth: 1200,
    oceanPaused: state === 'paused',
    oceanSpeed: 1,
    padding: component === 'card' ? 12 : component === 'global-layout' || component === 'page-layout' ? 24 : 0,
    gap: component === 'color-swatches' ? 14 : component === 'page-layout' ? 24 : 16,
    sidebarWidth: 256,
    swatchSize: state === 'compact' ? 28 : 40,
    orientation: state === 'horizontal' || state === 'both' ? state : 'vertical',
    scrollbarVisibility: 'auto',
  };
}

/** 尺寸传到真实组件根元素。自动恢复组件默认 CSS；固定/填满解除默认最大宽度和最小高度。 */
export function componentSizeStyle(controls: PreviewControls): CSSProperties {
  const dimension = ({ mode, value }: ComponentDimension) => mode === 'fixed' ? value : mode === 'fill' ? '100%' : undefined;
  return {
    width: dimension(controls.width), height: dimension(controls.height),
    maxWidth: controls.width.mode === 'auto' ? undefined : 'none',
    minHeight: controls.height.mode === 'auto' ? undefined : 0,
    overflow: controls.height.mode === 'auto' ? undefined : 'auto',
  };
}
