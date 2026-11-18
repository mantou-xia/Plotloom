import type { PreviewControls } from './controls.ts';

/** 控件仅修改公开 props，组合预览与原子预览使用同一组件实现。 */
export function SidebarControls({ component, controls, onChange }: {
  component: string; controls: PreviewControls; onChange: (patch: Partial<PreviewControls>) => void;
}) {
  // 外层分类只暴露自身支持的参数，不混用内层分组的图标与缩进配置。
  if (component === 'sidebar-section') return <fieldset><legend>外层分类属性</legend>
    <label>分类标题<input value={controls.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
    <ContentStateControls controls={controls} onChange={onChange} />
    {([{ key: 'sidebarExpanded', label: '展开' }, { key: 'disabled', label: '禁用标题切换' }, { key: 'sidebarActions', label: '显示分类操作' }] as const)
      .map(({ key, label }) => <label key={key} className="pl-workbench__check"><input type="checkbox" checked={controls[key]}
        onChange={(event) => onChange({ [key]: event.target.checked })} />{label}</label>)}
  </fieldset>;
  const group = component === 'sidebar-group' || component === 'sidebar-group-header';
  const action = component === 'sidebar-action-button';
  const session = component === 'sidebar-session-item';
  const flags: Array<{ key: 'sidebarActive' | 'sidebarExpanded' | 'sidebarIcon' | 'sidebarActions' | 'sessionPinned' | 'disabled' | 'loading' | 'danger'; label: string }> = [
    { key: 'disabled', label: '禁用' },
    ...(action ? [{ key: 'loading' as const, label: '加载' }, { key: 'danger' as const, label: '危险操作' }] : [
      { key: group ? 'sidebarExpanded' as const : 'sidebarActive' as const, label: group ? '展开' : '选中' },
      ...(session ? [{ key: 'sessionPinned' as const, label: '已置顶' }] : [{ key: 'sidebarIcon' as const, label: '显示图标' }]), { key: 'sidebarActions' as const, label: '显示操作区' },
    ]),
  ];
  const numbers: Array<{ key: 'sidebarRowHeight' | 'sidebarIconSize' | 'sidebarGap' | 'sidebarIndent' | 'sidebarIndicatorWidth' | 'sidebarIndicatorHeight'; label: string; min: number; max: number }> = action ? [] : [
    { key: 'sidebarRowHeight', label: '行高', min: 32, max: 80 },
    ...(session ? [] : [{ key: 'sidebarIconSize' as const, label: '图标尺寸', min: 12, max: 32 },
      { key: 'sidebarGap' as const, label: '图标文字间距', min: 0, max: 32 }]),
    ...(group ? [] : [
      { key: 'sidebarIndicatorWidth' as const, label: '选中短线宽度', min: 2, max: 8 },
      { key: 'sidebarIndicatorHeight' as const, label: '选中短线高度', min: 8, max: 28 },
    ]),
    ...(component === 'sidebar-group' ? [{ key: 'sidebarIndent' as const, label: '内容缩进', min: 0, max: 64 }] : []),
  ];
  return <fieldset><legend>侧栏组件属性</legend>
    <label>文字<input value={controls.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
    {component === 'sidebar-group' ? <ContentStateControls controls={controls} onChange={onChange} /> : null}
    {group ? <label>展开／收起图标<select value={controls.sidebarGroupIcon} onChange={(event) => onChange({ sidebarGroupIcon: event.target.value as PreviewControls['sidebarGroupIcon'] })}>
      <option value="folder">文件夹（默认）</option><option value="book">书籍（业务传入示例）</option>
    </select></label> : null}
    {session ? <>
      <label>相对时间<input value={controls.sessionTimeLabel} onChange={(event) => onChange({ sessionTimeLabel: event.target.value })} /></label>
      <label>任务状态<select value={controls.sessionStatus} onChange={(event) => onChange({ sessionStatus: event.target.value as PreviewControls['sessionStatus'] })}>
        <option value="none">无状态</option><option value="running">正在进行</option><option value="unread">已完成未查看</option><option value="failed">失败</option>
      </select></label>
    </> : null}
    {flags.map(({ key, label }) => <label key={key} className="pl-workbench__check"><input type="checkbox" checked={controls[key]} onChange={(event) => onChange({ [key]: event.target.checked })} />{label}</label>)}
    {action ? <label>图标按钮尺寸<select value={controls.buttonSize} onChange={(event) => onChange({ buttonSize: event.target.value as PreviewControls['buttonSize'] })}>
      <option value="sm">小</option><option value="md">中</option><option value="lg">大</option>
    </select></label> : null}
    {numbers.map(({ key, label, min, max }) => <label key={key}>{label}（px）<input type="number" min={min} max={max} key={controls[key]} defaultValue={controls[key]}
      onBlur={(event) => { const value = event.target.valueAsNumber; const next = Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : controls[key]; event.target.value = String(next); onChange({ [key]: next }); }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
  </fieldset>;
}

/** 两种容器共享公开状态参数，切换状态即可验证文案、颜色及折叠。 */
function ContentStateControls({ controls, onChange }: {
  controls: PreviewControls; onChange: (patch: Partial<PreviewControls>) => void;
}) {
  return <>
    <label>内容状态<select value={controls.sidebarContentState} onChange={(event) => onChange({ sidebarContentState: event.target.value as PreviewControls['sidebarContentState'] })}>
      <option value="ready">正常</option><option value="empty">空态</option><option value="error">异常态</option>
    </select></label>
    <label>空态文案<input value={controls.sidebarEmptyText} onChange={(event) => onChange({ sidebarEmptyText: event.target.value })} /></label>
    <label>异常文案<input value={controls.sidebarErrorText} onChange={(event) => onChange({ sidebarErrorText: event.target.value })} /></label>
  </>;
}
