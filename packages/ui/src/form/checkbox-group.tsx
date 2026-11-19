import { useRef } from 'react';
import { CheckboxGroup as BaseCheckboxGroup } from 'deep-agent-base-ui/checkbox-group';
import { Field } from 'deep-agent-base-ui/field';
import { Checkbox } from './checkbox.tsx';
import { useFormField, useFormValue, type FormOption, type FormSize } from './shared.ts';
import './form.css';

export interface CheckboxGroupProps extends Omit<BaseCheckboxGroup.Props, 'className' | 'render' | 'children'> {
  options: readonly FormOption[];
  name?: string;
  readOnly?: boolean;
  size?: FormSize;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** 每个勾选项以相同 name 提交独立值，组内通过 Field.Item 关联各自标签，避免覆盖组标签。 */
export function CheckboxGroup({ options, name, size = 'md', orientation = 'vertical', className = '', value, defaultValue = [], onValueChange, readOnly, ...props }: CheckboxGroupProps) {
  const root = useRef<HTMLDivElement>(null);
  // Field.Item 依赖 Field.Root；独立使用时保留原生标签，不创建无宿主字段项。
  const Item = useFormField().inField ? Field.Item : 'div';
  const [current, change] = useFormValue(value, defaultValue, onValueChange, root);
  return <BaseCheckboxGroup {...props} ref={root} value={current} onValueChange={change} className={`pl-form-options ${className}`} data-orientation={orientation}>
    {options.map(option => <Item key={option.value}><Checkbox name={name} value={option.value} label={option.label}
      size={size} disabled={option.disabled} readOnly={readOnly} required={false} /></Item>)}
  </BaseCheckboxGroup>;
}
