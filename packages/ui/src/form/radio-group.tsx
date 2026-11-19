import { useRef } from 'react';
import { RadioGroup as BaseRadioGroup } from 'deep-agent-base-ui/radio-group';
import { Radio } from 'deep-agent-base-ui/radio';
import { Field } from 'deep-agent-base-ui/field';
import { useFormField, useFormValue, type FormOption, type FormSize } from './shared.ts';
import './form.css';

export interface RadioGroupProps extends Omit<BaseRadioGroup.Props<string | null>, 'className' | 'render' | 'children'> {
  options: readonly FormOption[];
  size?: FormSize;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  invalid?: boolean;
}

/** 组内方向键切换与单一 Tab 入口交给底层处理；值由调用方控制或 defaultValue 初始化。 */
export function RadioGroup({ options, size = 'md', orientation = 'vertical', required, invalid, className = '', value, defaultValue, onValueChange, ...props }: RadioGroupProps) {
  const field = useFormField();
  const Item = field.inField ? Field.Item : 'div';
  const root = useRef<HTMLDivElement>(null);
  const [current, change] = useFormValue(value, defaultValue ?? null, onValueChange, root);
  return <BaseRadioGroup {...props} ref={root} value={current} onValueChange={change} required={required ?? field.required} aria-invalid={invalid || field.invalid || props['aria-invalid']}
    className={`pl-form-options ${className}`} data-orientation={orientation}>
    {options.map(option => <Item key={option.value}><label className="pl-form-choice" data-size={size}>
      <Radio.Root value={option.value} disabled={option.disabled} className="pl-form-radio"><Radio.Indicator keepMounted className="pl-form-radio__mark" /></Radio.Root>
      <span>{option.label}</span>
    </label></Item>)}
  </BaseRadioGroup>;
}
