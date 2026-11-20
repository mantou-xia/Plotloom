import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../button/button.tsx';
import './code-block.css';

interface Props {
  code: string;
  language: string;
  streaming?: boolean;
  className?: string;
  style?: CSSProperties;
  actions?: ReactNode;
  children: ReactNode;
}

/** 内部共享外框：普通代码与图表源码使用同一复制反馈，图表自行提供正文和切换操作。 */
export function CodeBlockFrame({ code, language, streaming = false, className = '', style, actions, children }: Props) {
  const [copy, setCopy] = useState<{ source: string; status: 'done' | 'error' } | null>(null);
  const request = useRef(0);
  // 内容替换或卸载后，旧剪贴板请求不得把成功状态写回新代码块。
  useEffect(() => () => { request.current++; }, [code]);
  useEffect(() => {
    if (!copy) return;
    // 成功仅通过图标变色反馈；重复复制会重新计时，2.2 秒后恢复默认颜色。
    const timer = setTimeout(() => setCopy(null), 2200);
    return () => clearTimeout(timer);
  }, [copy]);
  const status = copy?.source === code ? copy.status : 'idle';
  /** 复制原始内容；浏览器拒绝权限或不支持 Clipboard API 时保留手动复制入口。 */
  async function copyCode() {
    const current = ++request.current;
    try {
      await navigator.clipboard.writeText(code);
      if (current === request.current) setCopy({ source: code, status: 'done' });
    } catch {
      if (current === request.current) setCopy({ source: code, status: 'error' });
    }
  }
  return <section className={`pl-code-block ${className}`} style={style} aria-label={`${language}内容`} aria-busy={streaming}>
    <div className="pl-code-block__toolbar"><span className="pl-code-block__language">{language === 'text' ? '纯文本' : language}</span><div>
      {actions}
      <Button variant="ghost" size="sm" iconOnly className="pl-code-block__copy" data-copied={status === 'done' || undefined}
        disabled={!code} onClick={() => void copyCode()} aria-label="复制代码"><Copy /></Button>
    </div></div>
    <span className="pl-code-block__status" role="status">{status === 'error' ? '复制失败，请选择源码后手动复制。' : ''}</span>
    {children}
  </section>;
}
