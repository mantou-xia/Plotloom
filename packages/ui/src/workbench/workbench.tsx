import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { ColorPicker } from '../color-picker/color-picker.tsx';
import { THEME_PRESETS } from '../theme/theme.ts';
import { componentCatalog, type ComponentExample } from './catalog.ts';
import { ComponentControls } from './component-controls.tsx';
import type { PreviewControls } from './controls.ts';
import './workbench.css';

export interface WorkbenchProps {
  example: ComponentExample;
  state: string;
  width: number;
  height: number;
  color: string;
  controls: PreviewControls;
  onControlsChange: (patch: Partial<PreviewControls>) => void;
  lastAction: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onSelect: (id: string) => void;
  onStateChange: (state: string) => void;
  onSizeChange: (width: number, height: number) => void;
  onColorChange: (color: string) => void;
  onReset: () => void;
}

/** 仅用于开发调试的界面；iframe 尺寸是实际 CSS 像素，原生缩放通过观察器回写控件。 */
export function ComponentWorkbench({ example, state, width, height, color, controls, onControlsChange, lastAction, frameRef, onSelect, onStateChange, onSizeChange, onColorChange, onReset }: WorkbenchProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [pickerRevision, setPickerRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [searchCollapsed, setSearchCollapsed] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const directoryId = useId();
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const matches = componentCatalog.filter((entry) => {
    const text = [entry.id, entry.name, entry.category, entry.description, ...entry.states.map((item) => item.name)].join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  // 搜索临时展开匹配分类；独立记录搜索中的折叠，清空后恢复原目录习惯，不切换当前预览。
  function updateSearch(value: string) {
    setSearch(value);
    setSearchCollapsed([]);
  }
  function toggleCategory(category: string) {
    const update = searching ? setSearchCollapsed : setCollapsed;
    update((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }
  // 尺寸在 Enter 或失焦时提交，避免输入第一位数字时就被最小尺寸截断。
  function commitSize(input: HTMLInputElement, dimension: 'width' | 'height') {
    const fallback = dimension === 'width' ? width : height;
    const minimum = dimension === 'width' ? 240 : 160;
    const maximum = dimension === 'width' ? 2400 : 1600;
    const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : fallback;
    const next = Math.max(minimum, Math.min(maximum, Math.round(value)));
    onSizeChange(dimension === 'width' ? next : width, dimension === 'height' ? next : height);
    input.value = String(next);
  }
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      if (nextWidth !== width || nextHeight !== height) onSizeChange(nextWidth, nextHeight);
    });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [width, height, onSizeChange]);

  return <div className="pl-workbench">
    <aside className="pl-workbench__sidebar">
      <header><strong>Plotloom</strong><span>组件调试台</span></header>
      <div className="pl-workbench__search">
        <Search size={16} aria-hidden="true" />
        <input ref={searchRef} type="search" aria-label="搜索组件" placeholder="搜索组件…" value={search}
          onChange={(event) => updateSearch(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); updateSearch(''); } }} />
        {search ? <Button className="pl-workbench__search-clear" variant="ghost" size="sm" iconOnly aria-label="清空组件搜索"
          onClick={() => { updateSearch(''); searchRef.current?.focus(); }}><X /></Button> : null}
      </div>
      <ScrollBox className="pl-workbench__directory" tabIndex={-1}>
        <nav aria-label="组件目录">
          {[...new Set(componentCatalog.map((entry) => entry.category))].map((category, index) => {
            const entries = matches.filter((entry) => entry.category === category);
            if (!entries.length) return null;
            const expanded = !(searching ? searchCollapsed : collapsed).includes(category);
            const groupId = `${directoryId}-category-${index}`;
            return <section key={category}>
              <h2><Button className="pl-workbench__category" variant="ghost" size="sm" aria-label={category}
                aria-expanded={expanded} aria-controls={groupId} onClick={() => toggleCategory(category)}>
                <span className="pl-workbench__category-label"><ChevronRight size={16} aria-hidden="true" />{category}</span>
                <span aria-hidden="true">{entries.length}</span>
              </Button></h2>
              <div id={groupId} hidden={!expanded}>
                {entries.map((entry) => <Button key={entry.id} variant={entry.id === example.id ? 'subtle' : 'ghost'} aria-current={entry.id === example.id ? 'page' : undefined} onClick={() => onSelect(entry.id)}>{entry.name}<span>{entry.states.length}</span></Button>)}
              </div>
            </section>;
          })}
          {!matches.length ? <p className="pl-workbench__search-empty">没有匹配的组件，请尝试其他名称或关键词。</p> : null}
        </nav>
      </ScrollBox>
      <footer role="status">{searching ? `找到 ${matches.length} / ${componentCatalog.length} 个组件` : `${componentCatalog.length} 个组件 · 直接引用组件库`}</footer>
    </aside>
    <main className="pl-workbench__main">
      <header className="pl-workbench__heading"><div><p>{example.category}</p><h1>{example.name}</h1><p>{example.description}</p></div><Button variant="ghost" onClick={() => { setPickerRevision((value) => value + 1); onReset(); }}>重置预览</Button></header>
      <div className="pl-workbench__toolbar"><strong>{example.states.find((item) => item.id === state)?.name}</strong><output aria-label="当前预览尺寸">{width} × {height} px</output></div>
      <div className="pl-workbench__canvas">
        <div ref={viewport} className="pl-workbench__viewport" style={{ width, height }}>
          <iframe ref={frameRef} src="?preview=1" title="组件预览" />
        </div>
      </div>
      <div className="pl-workbench__details"><p>{example.states.find((item) => item.id === state)?.description}</p><p>{example.interaction}</p><p>拖动画布右下角调整环境；组件宽高和属性在右侧独立设置。画布四周保留 24px 预览留白。</p><code>@plotloom/ui{example.exportPath.slice(1)}</code><p role="status">{lastAction || '尚未触发回调'}</p></div>
    </main>
    <aside className="pl-workbench__controls" aria-label="预览控制">
      <h2>预览控制</h2>
      <fieldset><legend>布局检查</legend>
        <label className="pl-workbench__check"><input type="checkbox" checked={controls.showBoxModel} onChange={(event) => onControlsChange({ showBoxModel: event.target.checked })} />显示边界与间距</label>
        <div className="pl-box-model-legend"><span>边界</span><span>padding 内边距</span><span>margin 外边距</span><span>gap 子项间距</span></div>
        <p className="pl-box-model-hint">悬停元素查看上、右、下、左的 padding / margin；悬停布局容器或紫色间隔查看行、列 gap。</p>
      </fieldset>
      <label htmlFor="example-state">初始样例</label>
      <select id="example-state" value={state} onChange={(event) => onStateChange(event.target.value)}>{example.states.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <ComponentControls component={example.id} controls={controls} onChange={onControlsChange} />
      <fieldset><legend>画布尺寸</legend><div className="pl-workbench__dimensions">
        <label>画布宽度（px）<input key={`width-${width}`} type="number" min="240" max="2400" defaultValue={width} onBlur={(event) => commitSize(event.target, 'width')} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        <label>画布高度（px）<input key={`height-${height}`} type="number" min="160" max="1600" defaultValue={height} onBlur={(event) => commitSize(event.target, 'height')} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      </div><div className="pl-workbench__sizes"><Button variant="ghost" onClick={() => onSizeChange(375, 667)}>窄屏</Button><Button variant="ghost" onClick={() => onSizeChange(768, 600)}>中屏</Button><Button variant="ghost" onClick={() => onSizeChange(1280, 800)}>宽屏</Button></div></fieldset>
      <label htmlFor="theme-preset">组件库配色</label>
      <select id="theme-preset" value={THEME_PRESETS.some((item) => item.color === color) ? color : 'custom'} onChange={(event) => { if (event.target.value !== 'custom') { setPickerRevision((value) => value + 1); onColorChange(event.target.value); } }}>
        <option value="custom" disabled>自定义颜色</option>{THEME_PRESETS.map((item) => <option key={item.color} value={item.color}>{item.name}</option>)}
      </select>
      <details><summary>自定义配色</summary><ColorPicker key={pickerRevision} color={color} onChange={onColorChange} /></details>
      <p className="pl-workbench__hint">调试配色仅在本调试台生效，不修改产品设置。</p>
    </aside>
  </div>;
}
