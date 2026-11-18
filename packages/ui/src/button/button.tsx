import type { ComponentPropsWithRef, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'text' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  danger?: boolean;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** 纯图标模式下调用方必须提供 aria-label，图标作为 children 传入。 */
  iconOnly?: boolean;
}

/** 加载由调用方控制；保留原内容占位和可访问名称，原生禁用阻止点击及表单重复提交。 */
export function Button({ variant = 'primary', size = 'md', danger = false, loading = false,
  startIcon, endIcon, iconOnly = false, disabled, children, className = '', type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || props['aria-busy']}
    data-danger={danger || undefined} data-loading={loading || undefined} data-icon-only={iconOnly || undefined}
    className={`plotloom-button plotloom-button--${variant} plotloom-button--${size} ${className}`}>
    <span className="plotloom-button__content" aria-hidden={iconOnly || undefined}>
      {!iconOnly && startIcon ? <span className="plotloom-button__icon" aria-hidden="true">{startIcon}</span> : null}
      {children}
      {!iconOnly && endIcon ? <span className="plotloom-button__icon" aria-hidden="true">{endIcon}</span> : null}
    </span>
    {loading ? <span className="plotloom-button__loading" aria-hidden="true"><LoaderCircle size={16} strokeWidth={2} /></span> : null}
  </button>;
}
