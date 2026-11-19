import { useRef, type Ref } from 'react';
import { NumberField } from 'deep-agent-base-ui/number-field';
import { Minus, Plus } from 'lucide-react';
import { useFormField, useFormValue, type FormSize } from './shared.ts';
import './form.css';

export interface NumberInputProps extends Omit<NumberField.Root.Props, 'className' | 'render' | 'children'> {
  size?: FormSize;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/** 空值用 null 表示；步进、范围约束及小数运算由 NumberField 处理，滚轮不会意外改值。 */
export function NumberInput({ size = 'md', invalid, required, placeholder, inputRef, className = '', value, defaultValue, onValueChange, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, ...props }: NumberInputProps) {
  const field = useFormField();
  const root = useRef<HTMLDivElement>(null);
  const [current, change] = useFormValue(value, defaultValue ?? null, onValueChange, root);
  return <NumberField.Root {...props} ref={root} value={current} onValueChange={change} required={required ?? field.required} allowWheelScrub={false}
    className={`pl-form-number ${className}`} data-size={size} data-invalid={invalid || field.invalid || undefined}>
    <NumberField.Group className="pl-form-control">
      <NumberField.Decrement className="pl-form-step" aria-label="减少数值"><Minus size={16} /></NumberField.Decrement>
      <NumberField.Input ref={inputRef} className="pl-form-text" placeholder={placeholder} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} aria-invalid={invalid || field.invalid || undefined} />
      <NumberField.Increment className="pl-form-step" aria-label="增加数值"><Plus size={16} /></NumberField.Increment>
    </NumberField.Group>
  </NumberField.Root>;
}
