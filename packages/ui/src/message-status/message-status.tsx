import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CircleAlert, CircleStop, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import './message-status.css';

export type MessageStatusValue = 'waiting' | 'failed' | 'stopped';
export interface MessageStatusProps {
  /** null 隐藏内容但保留 48px 状态行，避免状态出现或消失挤动相邻内容。 */
  status: MessageStatusValue | null;
  /** 仅 failed 展示，按纯文本处理；调用方提供可向用户展示的错误说明。 */
  errorMessage?: string;
  /** 仅失败或停止时可用；不传则不显示重试入口。 */
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  retryDisabled?: boolean;
  onRetryError?: (error: unknown) => void;
  className?: string;
  style?: CSSProperties;
}

const labels = {
  waiting: { title: '等待响应', description: '正在等待模型返回内容。', Icon: LoaderCircle },
  failed: { title: '生成失败', description: '本次回答未能完成。', Icon: CircleAlert },
  stopped: { title: '已停止', description: '本次生成已停止。', Icon: CircleStop },
};

/** 独立消息状态行；只展示调用方提供的状态，重试完成不擅自认定生成已开始或成功。 */
export function MessageStatus({ status, errorMessage, onRetry, retrying = false, retryDisabled = false,
  onRetryError, className = '', style }: MessageStatusProps) {
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // 宿主进入新的状态或重新发起请求时，旧的请求失败提示不再适用。
  useEffect(() => { setRetryError(false); }, [status, retrying]);
  const content = status ? labels[status] : null;
  const Icon = content?.Icon;
  const description = status === 'failed' && errorMessage?.trim() ? errorMessage : content?.description ?? '';
  const canRetry = (status === 'failed' || status === 'stopped') && !!onRetry;
  const busy = pending || retrying;
  const retryLabel = busy ? '正在重试' : retryError ? '重试未能发起，点击重试' : '重试生成';

  /** 同步锁覆盖连续点击；只捕获重试回调失败，生成结果仍由宿主通过 status 更新。 */
  async function retry() {
    if (!canRetry || !onRetry || retryDisabled || busy || lock.current) return;
    lock.current = true;
    setPending(true);
    setRetryError(false);
    let failed = false;
    let failure: unknown;
    try { await onRetry(); }
    catch (error) { failed = true; failure = error; }
    finally { lock.current = false; }
    if (!mounted.current) return;
    setPending(false);
    setRetryError(failed);
    if (failed) onRetryError?.(failure);
  }

  return <div className={`pl-message-status ${className}`} style={style} data-state={status ?? 'hidden'}>
    <div className="pl-message-status__content" hidden={!content}>
      {Icon ? <Icon className="pl-message-status__icon" size={18} aria-hidden="true" /> : null}
      <div className="pl-message-status__text" role="status" aria-live="polite" aria-atomic="true">
        <span className="pl-message-status__title">{content?.title}</span>
        <Tooltip content={description} shake={false}>
          <span className="pl-message-status__description" tabIndex={status === 'failed' && !!errorMessage?.trim() ? 0 : undefined}>{description}</span>
        </Tooltip>
      </div>
      <div className="pl-message-status__action">
        {canRetry ? <Tooltip content={retryLabel} shake={false}>
          <Button variant="ghost" size="sm" iconOnly aria-label={retryLabel} loading={busy} disabled={retryDisabled}
            onClick={retry} data-retry-error={retryError && !busy || undefined}>
            {retryError && !busy ? <CircleAlert /> : <RotateCcw />}
          </Button>
        </Tooltip> : null}
      </div>
      <span className="pl-message-status__feedback" role="status" aria-live="polite">{canRetry && retryError && !busy ? '重试未能发起，请重试' : ''}</span>
    </div>
  </div>;
}
