import type { ComponentDimension, PreviewControls } from './controls.ts';
import { SidebarControls } from './sidebar-controls.tsx';
import { buttonVariants } from './button-gallery.tsx';

interface Props {
  component: string;
  controls: PreviewControls;
  onChange: (patch: Partial<PreviewControls>) => void;
}

/** 只暴露当前组件实际使用的参数；数字在确认后提交，空值恢复当前值而不是意外变成零。 */
export function ComponentControls({ component, controls, onChange }: Props) {
  function commit(input: HTMLInputElement, current: number, min: number, max: number, apply: (value: number) => void) {
    const value = Number.isFinite(input.valueAsNumber) ? Math.round(input.valueAsNumber) : current;
    const next = Math.max(min, Math.min(max, value));
    apply(next);
    input.value = String(next);
  }
  const layout = component === 'page-layout' || component === 'global-layout';
  const numbers: { key: 'padding' | 'gap' | 'sidebarWidth' | 'swatchSize' | 'maxWidth'; label: string; min: number; max: number }[] = [];
  if (layout) numbers.push({ key: 'padding', label: '内容内边距（px）', min: 0, max: 160 });
  if (layout || component === 'color-swatches') numbers.push({ key: 'gap', label: '间距（px）', min: component === 'global-layout' ? 16 : 0, max: 120 });
  if (component === 'global-layout') numbers.push({ key: 'sidebarWidth', label: '侧栏初始宽度（px）', min: 180, max: 440 });
  if (component === 'page-layout') numbers.push({ key: 'maxWidth', label: '正文最大宽度（px）', min: 1, max: 2400 });
  if (component === 'color-swatches') numbers.push({ key: 'swatchSize', label: '圆点直径（px）', min: 24, max: 80 });
  return <>
    <fieldset><legend>组件尺寸</legend><div className="pl-workbench__dimensions">
      {(['width', 'height'] as const).map((axis) => {
        const label = axis === 'width' ? '组件宽度' : '组件高度';
        const dimension = controls[axis];
        return <div key={axis}>
          <label>{label}<select aria-label={`${label}模式`} value={dimension.mode} onChange={(event) => onChange({ [axis]: { ...dimension, mode: event.target.value as ComponentDimension['mode'] } })}>
            <option value="auto">自动</option><option value="fixed">固定 px</option><option value="fill">填满</option>
          </select></label>
          {dimension.mode === 'fixed' ? <label>像素<input aria-label={`${label}（px）`} key={`${axis}-${dimension.value}`} type="number" min="1" max="2400" defaultValue={dimension.value}
            onBlur={(event) => commit(event.target, dimension.value, 1, 2400, (value) => onChange({ [axis]: { ...dimension, value } }))}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label> : null}
        </div>;
      })}
    </div><p className="pl-workbench__hint">填满画布内的可用空间；自动使用组件自身尺寸。固定高度下内容可滚动。</p></fieldset>
    {component.startsWith('sidebar-') ? <SidebarControls component={component} controls={controls} onChange={onChange} /> : null}
    {component === 'ascii-ocean' ? <fieldset><legend>海洋背景属性</legend>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.oceanPaused} onChange={(event) => onChange({ oceanPaused: event.target.checked })} />暂停游动</label>
      <label>游动速度<select value={controls.oceanSpeed} onChange={(event) => onChange({ oceanSpeed: Number(event.target.value) })}>
        <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select></label>
      <p className="pl-workbench__hint">移动指针触发避让，点击或聚焦后按 Enter 制造水波。系统开启减少动态效果时自动保持静态。</p>
    </fieldset> : null}
    {component === 'page-layout' ? <fieldset><legend>一级页面属性</legend>
      <label>页面标题<input type="text" value={controls.pageTitle} onChange={(event) => onChange({ pageTitle: event.target.value })} /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.pageActions} onChange={(event) => onChange({ pageActions: event.target.checked })} />显示操作按钮</label>
      <p className="pl-workbench__hint">页头固定，正文独立滚动；按钮通过 actions 插槽传入，点击后可查看回调记录。</p>
    </fieldset> : null}
    {component === 'scroll-box' ? <fieldset><legend>滚动属性</legend>
      <label>滚动方向<select value={controls.orientation} onChange={(event) => onChange({ orientation: event.target.value as PreviewControls['orientation'] })}>
        <option value="vertical">纵向</option><option value="horizontal">横向</option><option value="both">双向</option>
      </select></label>
      <label>滚动条显示<select value={controls.scrollbarVisibility} onChange={(event) => onChange({ scrollbarVisibility: event.target.value as PreviewControls['scrollbarVisibility'] })}>
        <option value="auto">悬停或聚焦显示</option><option value="always">始终显示</option>
      </select></label>
    </fieldset> : null}
    {component === 'button' ? <fieldset><legend>按钮属性</legend>
      <label>按钮文字<input type="text" value={controls.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
      <label>按钮变体<select value={controls.variant} onChange={(event) => onChange({ variant: event.target.value as PreviewControls['variant'] })}>
        {buttonVariants.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>按钮尺寸<select value={controls.buttonSize} onChange={(event) => onChange({ buttonSize: event.target.value as PreviewControls['buttonSize'] })}>
        <option value="sm">小 · 32px</option><option value="md">中 · 40px</option><option value="lg">大 · 48px</option>
      </select></label>
      <label>图标位置<select value={controls.buttonIcon} onChange={(event) => onChange({ buttonIcon: event.target.value as PreviewControls['buttonIcon'] })}>
        <option value="none">无图标</option><option value="start">前置</option><option value="end">后置</option><option value="both">双侧</option><option value="only">纯图标</option>
      </select></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.danger} onChange={(event) => onChange({ danger: event.target.checked })} />危险操作</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.loading} onChange={(event) => onChange({ loading: event.target.checked })} />加载中</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={(event) => onChange({ disabled: event.target.checked })} />禁用按钮</label>
      <p className="pl-workbench__hint">参数作用于「交互试用」按钮；总览保留全部类型，便于对照。纯图标模式使用按钮文字作为可访问名称。</p>
    </fieldset> : null}
    {numbers.length ? <fieldset><legend>{layout ? '布局参数' : '色点参数'}</legend><div className="pl-workbench__dimensions">
      {numbers.map(({ key, label, min, max }) => <label key={key}>{label}<input key={controls[key]} type="number" min={min} max={max} defaultValue={controls[key]}
        onBlur={(event) => commit(event.target, controls[key], min, max, (value) => onChange({ [key]: value }))}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
    </div></fieldset> : null}
  </>;
}
