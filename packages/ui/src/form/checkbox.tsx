import { useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Checkbox as BaseCheckbox } from 'deep-agent-base-ui/checkbox';
import { Check, Minus } from 'lucide-react';
import { useFormField, useFormValue, type FormSize } from './shared.ts';
import './form.css';

export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, 'className' | 'style' | 'render' | 'children'> {
  style?: CSSProperties;
  label?: ReactNode;
  size?: FormSize;
  invalid?: boolean;
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** 原生隐藏输入保留提交/重置语义，视觉标记仅表达 checked/indeterminate，不复制业务状态。 */
export function Checkbox({ label, size = 'md', invalid, required, className = '', style, checked, defaultChecked = false, onCheckedChange, ...props }: CheckboxProps) {
  const field = useFormField();
  const root = useRef<HTMLLabelElement>(null);
  const [current, change] = useFormValue(checked, defaultChecked, onCheckedChange, root);
  return <label ref={root} className={`pl-form-choice ${className}`} data-size={size} style={style}>
    <BaseCheckbox.Root {...props} checked={current} onCheckedChange={change} required={required ?? field.required} aria-invalid={invalid || field.invalid || props['aria-invalid']} className="pl-form-check">
      <BaseCheckbox.Indicator keepMounted className="pl-form-check__mark">{props.indeterminate ? <Minus size={14} /> : <Check size={14} />}</BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
    {label ? <span>{label}</span> : null}
  </label>;
}
