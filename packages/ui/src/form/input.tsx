import { useImperativeHandle, useRef, useState, type Ref, type ReactNode, type CSSProperties } from 'react';
import { Input as BaseInput } from 'deep-agent-base-ui/input';
import { Eye, EyeOff, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { useFormField, useTextValue, type FormSize } from './shared.ts';
import './form.css';

export interface InputProps extends Omit<BaseInput.Props, 'size' | 'className' | 'style' | 'render' | 'value' | 'defaultValue' | 'onValueChange' | 'type'> {
  style?: CSSProperties;
  type?: 'text' | 'password' | 'email' | 'url' | 'tel' | 'search';
  size?: FormSize;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  clearable?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  invalid?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/** 文本、清空及密码显隐统一值与焦点；清空/显隐按钮不提交表单，也不产生业务提示。 */
export function Input({ size = 'md', type = 'text', value, defaultValue = '', onValueChange, clearable = false,
  startIcon, endIcon, invalid, required, disabled, readOnly, className = '', style, ref, ...props }: InputProps) {
  const field = useFormField();
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  const [text, change] = useTextValue(value, defaultValue, onValueChange, input);
  const [revealed, setRevealed] = useState(false);
  return <div className={`pl-form-control pl-form-input ${className}`} data-size={size} data-invalid={invalid || field.invalid || undefined} style={style}>
    {startIcon ? <span className="pl-form-icon" aria-hidden="true">{startIcon}</span> : null}
    <BaseInput {...props} ref={input} type={type === 'password' && revealed ? 'text' : type} value={text} onValueChange={change}
      disabled={disabled || field.disabled} readOnly={readOnly} required={required ?? field.required} aria-invalid={invalid || field.invalid || props['aria-invalid']}
      className="pl-form-text" />
    {clearable && text && !readOnly ? <Button className="pl-form-action" size="sm" variant="ghost" iconOnly aria-label="清空输入" disabled={disabled || field.disabled}
      onClick={() => { change(''); input.current?.focus(); }}><X /></Button> : null}
    {type === 'password' ? <Button className="pl-form-action" size="sm" variant="ghost" iconOnly aria-label={revealed ? '隐藏密码' : '显示密码'}
      aria-pressed={revealed} disabled={disabled || field.disabled} onClick={() => { setRevealed(current => !current); input.current?.focus(); }}>{revealed ? <EyeOff /> : <Eye />}</Button> : null}
    {endIcon ? <span className="pl-form-icon" aria-hidden="true">{endIcon}</span> : null}
  </div>;
}
