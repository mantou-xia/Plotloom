import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../button/button.tsx';
import './cover-card.css';

export interface CoverCardAction {
  id: string;
  label: string;
  tooltip?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface CoverCardProps {
  title: string;
  imageSrc?: string;
  background?: CSSProperties['background'];
  openLabel?: string;
  onOpen: () => void;
  actions?: readonly CoverCardAction[];
  style?: CSSProperties;
}

/** 主操作与封面上的操作按钮并列，避免嵌套按钮，也避免点击操作时打开卡片。 */
export function CoverCard({ title, imageSrc, background, openLabel, onOpen, actions = [], style }: CoverCardProps) {
  return <div className="pl-cover-card" style={style}>
    <Button variant="ghost" className="pl-cover-card__open" aria-label={openLabel ?? title} title={title}
      style={{ background }} onClick={onOpen}>
      {imageSrc && <img src={imageSrc} alt="" />}
      <span className="pl-cover-card__title">{title}</span>
    </Button>
    {actions.length > 0 && <div className="pl-cover-card__actions">
      {actions.map(action => <Button key={action.id} iconOnly variant="ghost" size="sm" aria-label={action.label}
        title={action.tooltip ?? action.label} disabled={action.disabled} onClick={action.onClick}>{action.icon}</Button>)}
    </div>}
  </div>;
}
