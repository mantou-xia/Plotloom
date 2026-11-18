import { useRef, useState } from 'react';
import { BoxModelOverlay } from './box-model-overlay.tsx';
import { ArrowRight, Plus } from 'lucide-react';
import { ButtonGallery } from './button-gallery.tsx';
import { SidebarAtomExample } from './sidebar-atom-example.tsx';
import { SidebarExample } from './sidebar-example.tsx';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { AsciiOcean } from '../ascii-ocean/ascii-ocean.tsx';
import { ColorPicker } from '../color-picker/color-picker.tsx';
import { ColorSwatches } from '../color-swatches/color-swatches.tsx';
import { GlobalLayout } from '../layouts/global-layout.tsx';
import { PageLayout } from '../layouts/page-layout.tsx';
import { ThemeRoot } from '../theme/theme-root.tsx';
import { THEME_PRESETS } from '../theme/theme.ts';
import { componentSizeStyle, type PreviewControls } from './controls.ts';
import './preview.css';

export interface ComponentPreviewProps {
  component: string;
  state: string;
  color: string;
  controls: PreviewControls;
  onColorChange: (color: string) => void;
  onAction: (action: string) => void;
}

/** 样例只组合通用组件与占位内容；尺寸和属性走公开 props，不通过外层盒子伪造组件尺寸。 */
export function ComponentPreview({ component, state, color, controls, onColorChange, onAction }: ComponentPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [clicks, setClicks] = useState(0);
  const [scrollItems, setScrollItems] = useState(state === 'empty' ? 0 : state === 'short' ? 1 : 24);
  const [pickerColor, setPickerColor] = useState<string | null>(state === 'black' ? '#000000' : state === 'white' ? '#ffffff' : null);
  const style = componentSizeStyle(controls);
  const click = () => { setClicks((count) => count + 1); onAction('onClick'); };
  const content = state === 'empty' ? null : Array.from({ length: state === 'overflow' ? 24 : 3 }, (_, index) => <div className="pl-example-block" key={index}>内容块 {index + 1}</div>);
  let target;
  if (component.startsWith('sidebar-')) target = <SidebarAtomExample component={component} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'sidebar') target = <SidebarExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'ascii-ocean') target = <AsciiOcean style={{ ...style, overflow: 'hidden' }}
    paused={controls.oceanPaused} speed={controls.oceanSpeed}
    onSplash={({ x, y }) => onAction(`onSplash(${Math.round(x)}, ${Math.round(y)})`)} />;
  if (component === 'scroll-box') target = <>
    <div className="pl-example-scroll-actions">
      <Button variant="subtle" onClick={() => setScrollItems((count) => count + 8)}>增加内容</Button>
      <Button variant="ghost" onClick={() => setScrollItems((count) => Math.max(0, count - 8))}>减少内容</Button>
      <span role="status">{scrollItems} 个内容块</span>
    </div>
    <ScrollBox style={style} orientation={controls.orientation} scrollbarVisibility={controls.scrollbarVisibility} aria-label="滚动内容示例" role="region">
      <div className={`pl-example-scroll-content pl-example-scroll-content--${controls.orientation}`}>
        {Array.from({ length: scrollItems }, (_, index) => <div className="pl-example-block" key={index}>内容块 {index + 1}</div>)}
      </div>
    </ScrollBox>
  </>;
  if (component === 'global-layout') target = <GlobalLayout style={style} sidebarWidth={controls.sidebarWidth} gap={controls.gap} contentPadding={controls.padding}
    sidebar={state === 'empty' ? null : <SidebarExample key={state} state={state} style={{ height: '100%' }} onAction={onAction} />}>
    {state === 'empty' ? null : <div style={{ display: 'grid', gap: 16 }}><strong>内容区</strong><p>侧栏融入主题背景，右侧内容卡片独立滚动。</p>{content}</div>}
  </GlobalLayout>;
  // PageLayout 自己管理正文滚动；通用尺寸控制的 overflow 不应让页头参与滚动。
  if (component === 'page-layout') target = <PageLayout style={{ ...style, overflow: 'hidden' }}
    title={controls.pageTitle} maxWidth={controls.maxWidth} padding={controls.padding} gap={controls.gap}
    actions={controls.pageActions ? <>
      <Button variant="secondary" onClick={() => onAction('PageLayout.actions.secondary.onClick')}>次要操作</Button>
      <Button onClick={() => onAction('PageLayout.actions.primary.onClick')}>主要操作</Button>
    </> : undefined}>{content}</PageLayout>;
  if (component === 'color-swatches') target = <ColorSwatches style={style} color={color} onChange={onColorChange} presets={THEME_PRESETS} swatchSize={controls.swatchSize} gap={controls.gap} />;
  if (component === 'color-picker') target = <ColorPicker style={style} defaultFormat={state === 'rgb' ? 'RGB' : 'HEX'} color={pickerColor ?? color} onChange={(next) => { setPickerColor(null); onColorChange(next); }} />;
  if (component === 'theme-root') target = <ThemeRoot color={color} style={style}>
    <p>外层主题</p><Button onClick={click}>主要按钮</Button> <Button variant="subtle" onClick={click}>浅底按钮</Button>
    {state === 'nested' ? <ThemeRoot color="#0f766e" style={{ minHeight: 0, padding: 16 }}><p>内层固定青绿</p><Button onClick={click}>内层按钮</Button></ThemeRoot> : <p className="pl-example-theme-text">文字与选中状态跟随主题变量。</p>}
  </ThemeRoot>;
  if (component === 'button') target = <>
    <section className="pl-button-playground" aria-label="交互试用">
      <h2>交互试用</h2><p>右侧调整类型、尺寸和状态，在这里检查真实效果。</p>
      <Button style={style} variant={controls.variant} size={controls.buttonSize} danger={controls.danger}
        loading={controls.loading} disabled={controls.disabled} iconOnly={controls.buttonIcon === 'only'}
        aria-label={controls.buttonIcon === 'only' ? controls.text || '添加内容' : undefined}
        startIcon={controls.buttonIcon === 'start' || controls.buttonIcon === 'both' ? <Plus /> : undefined}
        endIcon={controls.buttonIcon === 'end' || controls.buttonIcon === 'both' ? <ArrowRight /> : undefined} onClick={click}>
        {controls.buttonIcon === 'only' ? <Plus /> : controls.text}
      </Button>
    </section>
    <ButtonGallery onAction={click} />
  </>;
  // 按钮总览内容较长，统一使用组件库的稳定占位滚动容器。
  const overlay = controls.showBoxModel ? <BoxModelOverlay stageRef={stageRef} /> : null;
  if (component === 'button') return <><ScrollBox ref={stageRef} className="pl-example-stage pl-example-stage--buttons" role="region" aria-label="按钮总览" tabIndex={-1}>
    {target}<p className="pl-example-feedback" role="status">已点击 {clicks} 次</p>
  </ScrollBox>{overlay}</>;
  return <><div ref={stageRef} className="pl-example-stage"><div className="pl-example-target">{target}</div>
    {component === 'button' || component === 'theme-root' ? <p className="pl-example-feedback" role="status">已点击 {clicks} 次</p> : null}
  </div>{overlay}</>;
}
