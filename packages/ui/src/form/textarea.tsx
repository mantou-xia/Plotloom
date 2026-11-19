import { useImperativeHandle, useRef, type ComponentPropsWithRef } from 'react';
import { Field } from 'deep-agent-base-ui/field';
import { useFormField, useTextValue, type FormSize } from './shared.ts';
import './form.css';

export interface TextareaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'value' | 'defaultValue' | 'children'> {
  size?: FormSize;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  showCount?: boolean;
  invalid?: boolean;
}

/** 字数统计与原生 maxLength 使用同一字符串长度规则，避免显示计数和输入限制不一致。 */
export function Textarea({ size = 'md', value, defaultValue = '', onValueChange, showCount = false, invalid,
  required, disabled, readOnly, rows = 4, className = '', style, ref, ...props }: TextareaProps) {
  const field = useFormField();
  const input = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  const [text, change] = useTextValue(value, defaultValue, onValueChange, input);
  return <div className={`pl-form-textarea ${className}`} data-size={size} data-invalid={invalid || field.invalid || undefined} style={style}>
    <Field.Control ref={input} render={<textarea {...props} rows={rows} />} value={text} onValueChange={change}
      disabled={disabled} readOnly={readOnly} required={required ?? field.required} aria-invalid={invalid || field.invalid || props['aria-invalid']}
      className="pl-form-control pl-form-textarea__input" />
    {showCount ? <span className="pl-form-count" aria-label="已输入字数">{text.length}{props.maxLength !== undefined ? ` / ${props.maxLength}` : ''}</span> : null}
  </div>;
}
