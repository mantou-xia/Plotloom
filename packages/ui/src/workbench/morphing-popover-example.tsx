import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { MorphingPopover } from '../morphing-popover/morphing-popover.tsx';
import type { PreviewControls } from './controls.ts';
import './morphing-popover-example.css';

/** 可直接粘贴的最小组合；与预览共用方向、宽度和内容类型，不包含调试台逻辑。 */
function exampleCode(custom: boolean, width: number, placement: 'above' | 'below', align: 'left' | 'right', reduced: boolean, topLayer: boolean) {
  return `import { useState } from 'react';
import { Button } from '@plotloom/ui/button';
import { MorphingPopover } from '@plotloom/ui/morphing-popover';

export function MyComposerAction() {
  const [open, setOpen] = useState(false);
  ${custom ? '' : "const [selected, setSelected] = useState('简洁');"}
  return (
    <MorphingPopover open={open} onOpenChange={setOpen}
      label="${custom ? '自定义面板' : '输出选项'}" panelWidth={${width}}
      panelPlacement="${placement}" panelAlign="${align}"${reduced ? '\n      reducedMotion' : ''}${topLayer ? '\n      topLayer' : ''}
      trigger={props => (
        <Button {...props} size="sm" variant="secondary"
          style={{ borderRadius: 999 }}>
          ${custom ? '自定义工具' : '输出：{selected}'}
        </Button>
      )}>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        ${custom ? `<strong>自定义面板</strong>
        <p>这里可以放表单、列表、说明或你自己的组件。</p>
        <Button onClick={() => setOpen(false)}>完成</Button>` : `<strong>输出选项</strong>
        {['简洁', '详细'].map(value => (
          <Button key={value} variant="ghost"
            aria-pressed={selected === value}
            onClick={() => { setSelected(value); setOpen(false); }}>
            {value}
          </Button>
        ))}`}
      </div>
    </MorphingPopover>
  );
}`;
}

/** 用普通 Button 和任意内容演示通用外壳；不引入模型、权限等业务依赖。 */
export function MorphingPopoverExample({ state, controls, onAction }: {
  state: string; controls: PreviewControls; onAction: (value: string) => void;
}) {
  // 调试台切换样例会重新挂载。默认展开才能立即看见方向、对齐和内容差异。
  const [open, setOpen] = useState(state !== 'closed');
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState('简洁');
  const [copyStatus, setCopyStatus] = useState('');
  const custom = state === 'custom-content';
  const width = controls.width.mode === 'fixed' ? controls.width.value : 264;
  const topLayer = state === 'top-layer';
  const placement = state === 'below' || topLayer ? 'below' : 'above';
  const align = state === 'right' ? 'right' : 'left';
  const reduced = state === 'reduced-motion';
  const code = exampleCode(custom, width, placement, align, reduced, topLayer);
  const changeOpen = (next: boolean) => { setOpen(next); onAction('onOpenChange(' + next + ')'); };
  /** 复制失败时保留可选中的完整代码，不把失败误报为成功。 */
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopyStatus('已复制'); }
    catch { setCopyStatus('复制失败，请选中下方代码复制'); }
  }
  return <section className="pl-morph-example" aria-label="形变容器使用示例">
    <div className="pl-morph-example__toolbar">
      <div><strong>按钮 → 任意面板</strong><p>切换样例直接查看效果；收起后点击按钮，体验完整形变。</p></div>
      {/* 这是预览控制，不作为“面板外点击”处理，避免 mousedown 关闭后 click 又反向打开。 */}
      <Button size="sm" variant="secondary" onMouseDown={event => event.stopPropagation()} onClick={() => changeOpen(!open)}>{open ? '收起预览' : '展开预览'}</Button>
    </div>
    <p className="pl-morph-example__status" role="status">{open ? '已展开' : '已收起'} · {placement === 'above' ? '向上' : '向下'} · {align === 'left' ? '左对齐' : '右对齐'} · {reduced ? '无动画' : '弹簧形变'}</p>
    <div className="pl-morph-example__stage" style={topLayer ? { overflow: 'hidden', height: 100, minHeight: 100 } : undefined}>
    <MorphingPopover open={open} onOpenChange={changeOpen}
      label={custom ? '自定义面板' : '输出选项'} panelWidth={width}
      panelPlacement={placement} panelAlign={align} topLayer={topLayer}
      reducedMotion={reduced ? true : undefined} staggerContent={!custom}
      trigger={props => <Button {...props} size="sm" variant="secondary" style={{ borderRadius: 999 }} endIcon={<ChevronDown />}>{custom ? '自定义工具' : '输出：' + selected}</Button>}>
      {custom ? <div className="pl-morph-example__custom">
        <strong>自定义面板</strong>
        <p>这里可以放表单、列表、说明或你自己的组件。</p>
        <div className="pl-morph-example__slots"><span>trigger<br />按钮内容</span><span>children<br />面板内容</span></div>
        <Button size="sm" onClick={() => { changeOpen(false); onAction('自定义面板：完成'); }}>完成</Button>
      </div> :
      <div style={{ padding: 12, display: 'grid', gap: 6 }}>
        <strong>输出选项</strong>
        {(more ? ['简洁', '详细', '列表', '表格'] : ['简洁', '详细']).map(value => <Button key={value} data-menu-item size="sm" variant="ghost"
          aria-pressed={value === selected} onClick={() => { setSelected(value); setOpen(false); onAction('选择：' + value); }}>{value}</Button>)}
        <Button size="sm" variant="ghost" onClick={() => setMore(value => !value)}>{more ? '收起选项' : '更多选项'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>关闭面板</Button>
      </div>}
    </MorphingPopover>
    </div>
    <div className="pl-morph-example__guide">
      <strong>新增一个对话框工具按钮</strong>
      <p>1. 用 trigger 放入按钮。2. 用 children 放入任意面板内容。3. 用 open / onOpenChange 管理开关。容器统一负责定位、尺寸变化和形变动画。</p>
      <div className="pl-morph-example__toolbar"><strong>最小复用代码</strong><Button size="sm" variant="ghost" onClick={copyCode}>复制代码</Button></div>
      <p role="status">{copyStatus || '代码随当前样例和面板宽度更新，可直接创建新的按钮组件。'}</p>
      <pre tabIndex={0} aria-label="最小复用代码"><code>{code}</code></pre>
    </div>
  </section>;
}
