import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import './notice.css';

export type NoticeTone = 'info' | 'success' | 'error';

/** 在固定位置报告操作状态，失败使用高优先级读屏通知。 */
export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'error' ? CircleAlert : Info;
  return <div className="pl-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon size={16} aria-hidden="true" /><span>{children}</span>
  </div>;
}
