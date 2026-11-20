import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import './settings.css';

export interface SettingsRowProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** 传入已有控件并提供其可访问名称；值、禁用及保存反馈仍由调用方控制。 */
  children: ReactNode;
}

/** 说明和控件按可用宽度自动换行；不把整行做成点击区，避免与内部控件重复触发。 */
export function SettingsRow({ title, description, children, className = '', ...props }: SettingsRowProps) {
  const id = useId();
  return <div {...props} className={`pl-settings-row ${className}`} role="group"
    aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}>
    <div className="pl-settings-row__description">
      <h4 id={`${id}-title`}>{title}</h4>
      {description ? <p id={`${id}-description`}>{description}</p> : null}
    </div>
    <div className="pl-settings-row__control">{children}</div>
  </div>;
}
