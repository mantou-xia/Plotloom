import type { ComponentPropsWithRef, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Tooltip } from '../tooltip/tooltip.tsx';
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
  /** true 使用 aria-label 作为提示，字符串可补充当前操作状态。 */
  tooltip?: boolean | string;
}

/** 加载由调用方控制；保留原内容占位和可访问名称，原生禁用阻止点击及表单重复提交。 */
export function Button({ variant = 'primary', size = 'md', danger = false, loading = false,
  startIcon, endIcon, iconOnly = false, tooltip, disabled, children, className = '', type = 'button', ...props }: ButtonProps) {
  const inactive = disabled || loading;
  const button = <button {...props} type={type} disabled={inactive} aria-busy={loading || props['aria-busy']}
    data-danger={danger || undefined} data-loading={loading || undefined} data-icon-only={iconOnly || undefined}
    className={`plotloom-button plotloom-button--${variant} plotloom-button--${size} ${className}`}>
    <span className="plotloom-button__content" aria-hidden={iconOnly || undefined}>
      {!iconOnly && startIcon ? <span className="plotloom-button__icon" aria-hidden="true">{startIcon}</span> : null}
      {children}
      {!iconOnly && endIcon ? <span className="plotloom-button__icon" aria-hidden="true">{endIcon}</span> : null}
    </span>
    {loading ? <span className="plotloom-button__loading" aria-hidden="true"><LoaderCircle size={16} strokeWidth={2} /></span> : null}
  </button>;
  const hint = tooltip === true ? props['aria-label'] : tooltip;
  if (!hint) return button;
  // 只在原生按钮禁用时由外层接收悬停，按钮本身仍阻止点击和表单提交。
  const trigger = inactive ? <span className="pl-button-disabled-trigger" data-loading={loading || undefined}>{button}</span> : button;
  // 更换触发节点时重新绑定 Tooltip 的原生鼠标监听。
  return <Tooltip key={inactive ? 'disabled' : 'enabled'} content={hint} shake={false}>{trigger}</Tooltip>;
}
