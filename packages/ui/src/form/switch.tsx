import { useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Switch as BaseSwitch } from 'deep-agent-base-ui/switch';
import { useFormField, useFormValue, type FormSize } from './shared.ts';
import './form.css';

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, 'className' | 'style' | 'render' | 'children'> {
  style?: CSSProperties;
  label?: ReactNode;
  size?: FormSize;
  invalid?: boolean;
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** 开关只通知 checked 变化，不自动保存或提示；滑块回弹不改变控件占位。 */
export function Switch({ label, size = 'md', invalid, required, className = '', style, checked, defaultChecked = false, onCheckedChange, ...props }: SwitchProps) {
  const field = useFormField();
  const root = useRef<HTMLLabelElement>(null);
  const [current, change] = useFormValue(checked, defaultChecked, onCheckedChange, root);
  return <label ref={root} className={`pl-form-choice ${className}`} data-size={size} style={style}>
    <BaseSwitch.Root {...props} checked={current} onCheckedChange={change} required={required ?? field.required} aria-invalid={invalid || field.invalid || props['aria-invalid']} className="pl-form-switch">
      <BaseSwitch.Thumb className="pl-form-switch__thumb" />
    </BaseSwitch.Root>
    {label ? <span>{label}</span> : null}
  </label>;
}
