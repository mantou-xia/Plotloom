import type { CSSProperties } from 'react';
import type { ButtonSize, ButtonVariant } from '../button/button.tsx';

export interface ComponentDimension { mode: 'auto' | 'fixed' | 'fill'; value: number }
export interface PreviewControls {
  showBoxModel: boolean;
  width: ComponentDimension;
  height: ComponentDimension;
  text: string;
  variant: ButtonVariant;
  buttonSize: ButtonSize;
  danger: boolean;
  loading: boolean;
  buttonIcon: 'none' | 'start' | 'end' | 'both' | 'only';
  disabled: boolean;
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
    width: { mode: component === 'sidebar-action-button' ? 'auto' : component === 'sidebar' || component.startsWith('sidebar-') ? 'fixed' : component === 'global-layout' || component === 'page-layout' || component === 'scroll-box' || component === 'ascii-ocean' ? 'fill' : 'auto', value: component === 'sidebar-action-button' ? 32 : component === 'sidebar-session-item' ? 320 : component === 'sidebar' || component.startsWith('sidebar-') ? 256 : component === 'button' ? 180 : 320 },
    height: { mode: component === 'scroll-box' ? 'fixed' : component === 'sidebar' || component === 'global-layout' || component === 'page-layout' || component === 'ascii-ocean' ? 'fill' : 'auto', value: component === 'button' ? 48 : 360 },
    text: state === 'long' ? '这是一段用于检查窄容器换行的按钮文字，请观察不同宽度下的表现' : '点击试用',
    variant: state === 'secondary' || state === 'subtle' || state === 'ghost' || state === 'text' || state === 'link' ? state : 'primary',
    buttonSize: component === 'sidebar-action-button' ? 'sm' : 'md',
    danger: state === 'danger',
    loading: state === 'loading',
    buttonIcon: state === 'icons' ? 'start' : 'none',
    disabled: state === 'disabled',
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
    padding: component === 'global-layout' || component === 'page-layout' ? 24 : 0,
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
