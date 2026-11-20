import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Card } from '../card/card.tsx';
import './settings.css';

export interface SettingsSectionProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
}

/** 设置分组统一标题、底色与行间分隔；children 直接组合 SettingsRow，不管理设置值。 */
export function SettingsSection({ title, description, children, className = '', ...props }: SettingsSectionProps) {
  const id = useId();
  return <section {...props} className={`pl-settings-section ${className}`} aria-labelledby={`${id}-title`}>
    <header className="pl-settings-section__header">
      <h3 id={`${id}-title`}>{title}</h3>
      {description ? <p>{description}</p> : null}
    </header>
    <Card className="pl-settings-section__body" padding={0} borderRadius={16} backgroundColor="var(--pl-surface-muted)">
      {children}
    </Card>
  </section>;
}
