import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Field } from 'deep-agent-base-ui/field';
import { FormFieldContext } from './shared.ts';
import './form.css';

export interface FormFieldProps extends ComponentPropsWithRef<'div'> {
  label: ReactNode;
  description?: ReactNode;
  /** 业务校验错误由调用方传入；不触发 Toast。 */
  error?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

/** 标签、说明与错误自动关联内部控件；一个字段包裹一个控件或一组选项。 */
export function FormField({ label, description, error, required = false, disabled = false, name,
  className = '', children, ...props }: FormFieldProps) {
  return <Field.Root {...props} name={name} disabled={disabled} invalid={error ? true : undefined} className={`pl-form-field ${className}`}>
    <FormFieldContext value={{ required, invalid: Boolean(error), disabled, inField: true }}>
      <Field.Label className="pl-form-label">{label}{required ? <span className="pl-form-required" aria-hidden="true">*</span> : null}</Field.Label>
      {children}
      {description ? <Field.Description className="pl-form-description">{description}</Field.Description> : null}
      {error ? <Field.Error match className="pl-form-error">{error}</Field.Error> : null}
    </FormFieldContext>
  </Field.Root>;
}
