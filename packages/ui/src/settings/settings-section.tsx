import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import './settings.css';

export interface SettingsSectionProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/** 设置分组统一标题、行间分隔和底部操作位置，设置值与保存行为由调用方管理。 */
export function SettingsSection({ title, description, actions, children, className = '', ...props }: SettingsSectionProps) {
  const id = useId();
  return <section {...props} className={`pl-settings-section ${className}`} aria-labelledby={`${id}-title`}>
    <header className="pl-settings-section__header">
      <h3 id={`${id}-title`}>{title}</h3>
      {description ? <p>{description}</p> : null}
    </header>
    <div className="pl-settings-section__body">{children}</div>
    {actions ? <footer className="pl-settings-section__actions">{actions}</footer> : null}
  </section>;
}
