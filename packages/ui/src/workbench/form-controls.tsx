import type { PreviewControls } from './controls.ts';

/** 仅呈现当前控件实际使用的 props，值变化由画布内真实交互触发。 */
export function FormControls({ component, controls, onChange }: {
  component: string; controls: PreviewControls; onChange: (patch: Partial<PreviewControls>) => void;
}) {
  const toggles: [keyof Pick<PreviewControls, 'disabled' | 'formReadOnly' | 'formRequired' | 'formClearable' | 'formSearchable' | 'formMultiple' | 'formShowCount' | 'formIndeterminate'>, string][] = [['disabled', '禁用字段']];
  if (component !== 'form-field') toggles.push(['formReadOnly', '只读']);
  if (component !== 'checkbox-group') toggles.push(['formRequired', '必填']);
  if (component === 'input' || component === 'select') toggles.push(['formClearable', '允许清空']);
  if (component === 'select') toggles.push(['formSearchable', '允许搜索'], ['formMultiple', '多选']);
  if (component === 'textarea') toggles.push(['formShowCount', '显示字数']);
  if (component === 'checkbox') toggles.push(['formIndeterminate', '半选状态']);
  return <fieldset><legend>表单参数</legend>
    {(['formLabel', 'formDescription', 'formError'] as const).map((key, index) => <label key={key}>{['标签', '辅助说明', '错误信息'][index]}<input type="text" value={controls[key]} onChange={event => onChange({ [key]: event.target.value })} /></label>)}
    {['input', 'textarea', 'select', 'number-input'].includes(component) ? <label>占位文字<input type="text" value={controls.formPlaceholder} onChange={event => onChange({ formPlaceholder: event.target.value })} /></label> : null}
    {component !== 'form-field' ? <label>尺寸<select value={controls.buttonSize} onChange={event => onChange({ buttonSize: event.target.value as PreviewControls['buttonSize'] })}><option value="sm">小</option><option value="md">中</option><option value="lg">大</option></select></label> : null}
    {component === 'input' ? <label>输入类型<select value={controls.formInputType} onChange={event => onChange({ formInputType: event.target.value as PreviewControls['formInputType'] })}><option value="text">文本</option><option value="password">密码</option><option value="email">邮箱</option></select></label> : null}
    {component.endsWith('-group') ? <label>排列方向<select value={controls.orientation} onChange={event => onChange({ orientation: event.target.value as 'vertical' | 'horizontal' })}><option value="vertical">纵向</option><option value="horizontal">横向</option></select></label> : null}
    {component === 'number-input' ? (['formMin', 'formMax', 'formStep'] as const).map((key, index) => <label key={key}>{['最小值', '最大值', '步长'][index]}<input type="number" step="any" key={controls[key]} defaultValue={controls[key]} onBlur={event => {
      const next = event.target.valueAsNumber;
      if (Number.isFinite(next) && (key !== 'formStep' || next > 0) && (key !== 'formMin' || next <= controls.formMax) && (key !== 'formMax' || next >= controls.formMin)) onChange({ [key]: next });
      else event.target.value = String(controls[key]);
    }} /></label>) : null}
    {toggles.map(([key, label]) => <label className="pl-workbench__check" key={key}><input type="checkbox" checked={controls[key]} onChange={event => onChange({ [key]: event.target.checked })} />{label}</label>)}
  </fieldset>;
}
