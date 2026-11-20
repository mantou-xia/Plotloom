import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, CircleAlert, Copy, RotateCcw } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import './message-actions.css';

export interface MessageActionsProps {
  /** 回答原文，复制时保留 Markdown、空格和换行。不同消息应使用不同 React key。 */
  text: string;
  subject?: '回答' | '消息';
  /** 不传时不展示重新生成；组件不决定消息替换规则，也不请求业务接口。 */
  onRegenerate?: () => void | Promise<void>;
  /** 宿主生成期间保持禁用；回调 Promise 未结束时组件也会阻止重复触发。 */
  regenerating?: boolean;
  disabled?: boolean;
  regenerateDisabled?: boolean;
  onCopy?: () => void;
  onError?: (action: 'copy' | 'regenerate', error: unknown) => void;
  className?: string;
  style?: CSSProperties;
}

/** 回答操作只承担复制和回调触发；所有反馈复用原按钮占位，避免挤动消息与邻近操作。 */
export function MessageActions({ text, subject = '回答', onRegenerate, regenerating = false, disabled = false,
  regenerateDisabled = false, onCopy, onError, className = '', style }: MessageActionsProps) {
  const [copyResult, setCopyResult] = useState<{ text: string; status: 'done' | 'error' } | null>(null);
  const [copying, setCopying] = useState(false);
  const [pending, setPending] = useState(false);
  const [regenerateError, setRegenerateError] = useState(false);
  const copyLock = useRef(false);
  const regenerateLock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!copyResult) return;
    const timer = window.setTimeout(() => setCopyResult(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyResult]);
  const copyStatus = copyResult?.text === text ? copyResult.status : null;
  const busy = regenerating || pending;
  const copyLabel = copying ? '正在复制' : copyStatus === 'done' ? '已复制' + subject : copyStatus === 'error' ? '复制失败，点击重试' : '复制' + subject;
  const regenerateLabel = busy ? '正在重新生成' : regenerateError ? '重新生成失败，点击重试' : '重新生成';

  /** 剪贴板失败留在原按钮反馈；只报告当前原文的结果，不把旧文本的成功用于新回答。 */
  async function copy() {
    if (disabled || !text.trim() || copyLock.current) return;
    copyLock.current = true;
    setCopying(true);
    setCopyResult(null);
    let failed = false;
    let failure: unknown;
    try { await navigator.clipboard.writeText(text); }
    catch (error) { failed = true; failure = error; }
    finally { copyLock.current = false; }
    if (!mounted.current) return;
    setCopying(false);
    setCopyResult({ text, status: failed ? 'error' : 'done' });
    if (failed) onError?.('copy', failure);
    else onCopy?.();
  }

  /** 同步锁在 React 下一次渲染前生效，避免连续点击发出多次重新生成请求。 */
  async function regenerate() {
    if (!onRegenerate || disabled || regenerateDisabled || busy || regenerateLock.current) return;
    regenerateLock.current = true;
    setPending(true);
    setRegenerateError(false);
    let failed = false;
    let failure: unknown;
    try { await onRegenerate(); }
    catch (error) { failed = true; failure = error; }
    finally { regenerateLock.current = false; }
    if (!mounted.current) return;
    setPending(false);
    setRegenerateError(failed);
    if (failed) onError?.('regenerate', failure);
  }

  return <div className={`pl-message-actions ${className}`} style={style} role="group" aria-label={subject + '操作'}>
    <Tooltip content={!text.trim() ? '暂无可复制内容' : copyLabel} shake={false}>
      <Button variant="ghost" size="sm" iconOnly aria-label={copyLabel} loading={copying}
        disabled={disabled || !text.trim()} onClick={copy} data-feedback={copyStatus ?? undefined}>
        {copyStatus === 'done' ? <Check /> : copyStatus === 'error' ? <CircleAlert /> : <Copy />}
      </Button>
    </Tooltip>
    {onRegenerate ? <Tooltip content={regenerateLabel} shake={false}>
      <Button variant="ghost" size="sm" iconOnly aria-label={regenerateLabel} loading={busy}
        disabled={disabled || regenerateDisabled} onClick={regenerate} data-feedback={regenerateError && !busy ? 'error' : undefined}>
        {regenerateError && !busy ? <CircleAlert /> : <RotateCcw />}
      </Button>
    </Tooltip> : null}
    <span className="pl-message-actions__status" role="status" aria-live="polite" aria-atomic="true">
      {copyStatus === 'done' ? subject + '已复制' : copyStatus === 'error' ? '复制失败，请重试' : ''}
      {regenerateError && !busy ? '重新生成失败，请重试' : ''}
    </span>
  </div>;
}
