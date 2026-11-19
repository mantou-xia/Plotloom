import { useState, type CSSProperties, type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Input } from '../form/input.tsx';
import { Textarea } from '../form/textarea.tsx';
import { Select } from '../form/select.tsx';
import { Checkbox } from '../form/checkbox.tsx';
import { CheckboxGroup } from '../form/checkbox-group.tsx';
import { RadioGroup } from '../form/radio-group.tsx';
import { Switch } from '../form/switch.tsx';
import { NumberInput } from '../form/number-input.tsx';
import { FormField } from '../form/form-field.tsx';
import { Button } from '../button/button.tsx';
import type { PreviewControls } from './controls.ts';
import './form-example.css';

const options = [{ value: 'alpha', label: '选项 Alpha' }, { value: 'beta', label: '选项 Beta' }, { value: 'gamma', label: '选项 Gamma（禁用）', disabled: true }];

/** 全部使用公开组件参数；非受控示例验证原生提交/重置，受控接入由业务自行管理值。 */
export function FormExample({ component, state, controls: c, style, onAction }: {
  component: string; state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [result, setResult] = useState('尚未提交');
  const common = { size: c.buttonSize, readOnly: c.formReadOnly, style };
  const report = (value: unknown) => onAction(`onValueChange(${JSON.stringify(value)})`);
  let control: ReactNode;
  if (component === 'input') control = <Input {...common} name="value" type={c.formInputType} placeholder={c.formPlaceholder} defaultValue="示例文本" clearable={c.formClearable} startIcon={<Mail />} onValueChange={report} />;
  if (component === 'textarea') control = <Textarea {...common} name="value" placeholder={c.formPlaceholder} defaultValue="多行内容" maxLength={120} showCount={c.formShowCount} onValueChange={report} />;
  if (component === 'select') control = c.formMultiple
    ? <Select {...common} key="multiple" name="value" multiple defaultValue={['alpha']} options={state === 'empty' ? [] : options} placeholder={c.formPlaceholder} searchable={c.formSearchable} clearable={c.formClearable} onValueChange={report} />
    : <Select {...common} key="single" name="value" defaultValue={state === 'empty' ? null : 'alpha'} options={state === 'empty' ? [] : options} placeholder={c.formPlaceholder} searchable={c.formSearchable} clearable={c.formClearable} onValueChange={report} />;
  if (component === 'checkbox') control = <Checkbox {...common} name="value" value="accepted" label="勾选此项" defaultChecked indeterminate={c.formIndeterminate} onCheckedChange={report} />;
  if (component === 'checkbox-group') control = <CheckboxGroup {...common} name="value" options={options} defaultValue={['alpha']} orientation={c.orientation === 'horizontal' ? 'horizontal' : 'vertical'} onValueChange={report} />;
  if (component === 'radio-group') control = <RadioGroup {...common} name="value" options={options} defaultValue="alpha" orientation={c.orientation === 'horizontal' ? 'horizontal' : 'vertical'} onValueChange={report} />;
  if (component === 'switch') control = <Switch {...common} name="value" value="enabled" label="启用此项" defaultChecked onCheckedChange={report} />;
  if (component === 'number-input') control = <NumberInput {...common} name="value" defaultValue={2} min={c.formMin} max={c.formMax} step={c.formStep} placeholder={c.formPlaceholder} onValueChange={report} />;
  return <form className="pl-form-example" onSubmit={event => {
    event.preventDefault();
    const values = Array.from(new FormData(event.currentTarget).entries());
    setResult(JSON.stringify(values));
    onAction(`submit ${JSON.stringify(values)}`);
  }} onReset={() => { setResult('已重置为初始值'); onAction('reset'); }}>
    <FormField label={c.formLabel} description={c.formDescription} error={c.formError} required={c.formRequired} disabled={c.disabled} style={component === 'form-field' ? style : undefined}>
      {component === 'form-field' ? <Input name="title" placeholder="请输入内容" defaultValue="字段内容" clearable /> : control}
    </FormField>
    {component === 'form-field' ? <>
      <FormField label="多行输入" disabled={c.disabled}><Textarea name="notes" defaultValue="补充说明" showCount maxLength={80} rows={2} /></FormField>
      <FormField label="选择项" disabled={c.disabled}><Select name="choice" options={options} defaultValue="alpha" /></FormField>
      <FormField label="数值" disabled={c.disabled}><NumberInput name="amount" defaultValue={2} min={0} max={10} step={0.5} /></FormField>
      <FormField label="多选项" disabled={c.disabled}><CheckboxGroup name="tags" options={options.slice(0, 2)} defaultValue={['alpha']} orientation="horizontal" /></FormField>
      <FormField label="单选项" disabled={c.disabled}><RadioGroup name="radio" options={options.slice(0, 2)} defaultValue="alpha" orientation="horizontal" /></FormField>
      <Switch name="enabled" label="启用" defaultChecked disabled={c.disabled} />
    </> : null}
    <div className="pl-form-example__actions"><Button type="submit" size="sm">提交示例</Button><Button type="reset" size="sm" variant="secondary">重置</Button></div>
    <output className="pl-form-example__result" aria-live="polite">{result}</output>
  </form>;
}
