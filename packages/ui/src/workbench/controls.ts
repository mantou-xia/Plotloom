import type { CSSProperties } from 'react';
import type { ButtonSize, ButtonVariant } from '../button/button.tsx';
import type { CardMaterial } from '../card/card.tsx';

export interface ComponentDimension { mode: 'auto' | 'fixed' | 'fill'; value: number }
export interface PreviewControls {
  showBoxModel: boolean;
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
  scrollbarVisibility: 'auto' | 'always';
}

/** 样例只提供初始参数；后续控件直接编辑同一份配置，避免样例与属性相互覆盖。 */
export function defaultControls(component: string, state: string): PreviewControls {
  return {
    showBoxModel: false,
    tooltipContent: state === 'long' ? '这是一段较长的提示说明，文字会在气泡内自动换行。将鼠标移到提示上可以继续阅读，按 Esc 关闭。' : '这是一条提示',
    tooltipDelay: 0,
    tooltipShake: true,
    cardBorderRadius: component === 'card' && state === 'liquid-glass' ? 32 : 8,
    cardBackgroundColor: '#ffffff',
    cardBordered: state === 'bordered',
    cardMaterial: state === 'liquid-glass' ? 'liquid-glass' : 'normal',
    width: { mode: component === 'sidebar-action-button' ? 'auto' : component === 'sidebar' || component.startsWith('sidebar-') || component === 'card' && state === 'liquid-glass' ? 'fixed' : component === 'global-layout' || component === 'page-layout' || component === 'scroll-box' || component === 'ascii-ocean' ? 'fill' : 'auto', value: component === 'card' && state === 'liquid-glass' ? 360 : component === 'sidebar-action-button' ? 32 : component === 'sidebar-session-item' ? 320 : component === 'sidebar' || component.startsWith('sidebar-') ? 256 : component === 'button' ? 180 : 320 },
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
