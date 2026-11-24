import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, CircleAlert, Copy, MessageSquare, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Dialog } from '../dialog/dialog.tsx';
import { Textarea } from '../form/textarea.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import './message-actions.css';

export interface MessageFeedback { rating: 'like' | 'dislike' | null; comment: string }

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
  feedback?: MessageFeedback;
  feedbackDisabled?: boolean;
  onFeedbackChange?: (feedback: MessageFeedback) => void | Promise<void>;
  onError?: (action: 'copy' | 'regenerate' | 'feedback', error: unknown) => void;
  className?: string;
  style?: CSSProperties;
}

/** 回答操作通过回调保存评价，等待状态保留原按钮空间，文字反馈在独立弹窗中编辑。 */
export function MessageActions({ text, subject = '回答', onRegenerate, regenerating = false, disabled = false,
  regenerateDisabled = false, onCopy, feedback, feedbackDisabled, onFeedbackChange, onError, className = '', style }: MessageActionsProps) {
  const [copyResult, setCopyResult] = useState<{ text: string; status: 'done' | 'error' } | null>(null);
  const [copying, setCopying] = useState(false);
  const [pending, setPending] = useState(false);
  const [regenerateError, setRegenerateError] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<string | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const feedbackLock = useRef(false);
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
  const rating = feedback?.rating ?? null;
  const comment = feedback?.comment ?? '';
  const feedbackUnavailable = disabled || feedbackDisabled || savingFeedback;

  /** 等待持久化结果再关闭弹窗，失败时保留用户填写的文字。 */
  async function saveFeedback(next: MessageFeedback, close = false) {
    if (!onFeedbackChange || feedbackUnavailable || feedbackLock.current) return;
    feedbackLock.current = true;
    setSavingFeedback(true);
    setFeedbackError('');
    try {
      await onFeedbackChange(next);
      if (close && mounted.current) setFeedbackDraft(null);
    } catch (error) {
      if (close && mounted.current) setFeedbackError('保存失败，请重试。');
      else onError?.('feedback', error);
    } finally {
      feedbackLock.current = false;
      if (mounted.current) setSavingFeedback(false);
    }
  }

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
    {onFeedbackChange ? <>
      {([{ value: 'like', label: '点赞', Icon: ThumbsUp }, { value: 'dislike', label: '点踩', Icon: ThumbsDown }] as const).map(({ value, label, Icon }) =>
        <Tooltip key={value} content={label} shake={false}>
          <Button variant="ghost" size="sm" iconOnly aria-label={label} aria-pressed={rating === value}
            disabled={feedbackUnavailable} onClick={() => void saveFeedback({ rating: rating === value ? null : value, comment })}><Icon /></Button>
        </Tooltip>)}
      <Tooltip content="反馈" shake={false}>
        <Button variant="ghost" size="sm" iconOnly aria-label="反馈" data-has-comment={Boolean(comment)}
          disabled={feedbackUnavailable} onClick={() => { setFeedbackError(''); setFeedbackDraft(comment); }}><MessageSquare /></Button>
      </Tooltip>
      {feedbackDraft !== null ? <Dialog open title="回答反馈" description="反馈保存在本机，可随 Agent 使用记录手动导出。"
        dismissOnBackdrop={false} onOpenChange={open => { if (!open && !savingFeedback) setFeedbackDraft(null); }}
        footer={<>
          <Button variant="secondary" disabled={savingFeedback} onClick={() => setFeedbackDraft(null)}>取消</Button>
          <Button disabled={feedbackUnavailable} loading={savingFeedback}
            onClick={() => void saveFeedback({ rating, comment: feedbackDraft.trim() }, true)}>保存反馈</Button>
        </>}>
        <Textarea aria-label="反馈内容" placeholder="哪里做得好，或者哪里可以改进？" rows={4} maxLength={2000}
          value={feedbackDraft} onValueChange={setFeedbackDraft} />
        <p className="pl-message-actions__feedback-error" role="status">{feedbackError}</p>
      </Dialog> : null}
    </> : null}
    <span className="pl-message-actions__status" role="status" aria-live="polite" aria-atomic="true">
      {copyStatus === 'done' ? subject + '已复制' : copyStatus === 'error' ? '复制失败，请重试' : ''}
      {regenerateError && !busy ? '重新生成失败，请重试' : ''}
    </span>
  </div>;
}
