import type { CSSProperties, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import './skill-item.css';

export interface SkillItemProps {
  name: string;
  description: string;
  icon: ReactNode;
  /** 调用方组织完整诊断文案；组件不判断技能来源或运行条件。 */
  warning?: string;
  onClick?: () => void;
  status?: string;
  className?: string;
  style?: CSSProperties;
}

/** 可复用技能列表条目，放在 ul/ol 中；宽度与列数由父布局决定，不包含后端契约。 */
export function SkillItem({ name, description, icon, warning, onClick, status, className = '', style }: SkillItemProps) {
  return <li className={`plotloom-skill-item ${className}`} style={style}>
    {onClick ? <button type="button" className="plotloom-skill-item__trigger" aria-label={`查看 ${name} 详情`} onClick={onClick} /> : null}
    <span className="plotloom-skill-item__icon" aria-hidden="true">{icon}</span>
    <div className="plotloom-skill-item__content">
      <h3>{name}</h3>
      <p title={description}>{description}</p>
      {status ? <span className="plotloom-skill-item__status">{status}</span> : null}
      {warning ? <small><TriangleAlert size={14} aria-hidden="true" />{warning}</small> : null}
    </div>
  </li>;
}
