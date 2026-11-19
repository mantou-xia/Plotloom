import { toast, toastErrorMessage, type ToastMessages } from '@plotloom/ui/toast/utils';

/** 按业务操作边界包裹请求或按钮任务；内部请求保持静默，避免一次点击重复提示。 */
export async function runWithToast<T>(operation: () => Promise<T>, messages: ToastMessages<T>): Promise<
  { ok: true; value: T } | { ok: false }
> {
  try { return { ok: true, value: await toast.promise(operation, messages) }; }
  catch { return { ok: false }; }
}

/** 后台读取只报告失败；中止属于切页清理，不是错误，同类错误通过稳定 id 合并。 */
export function notifyRequestError(cause: unknown, key: string) {
  if (cause instanceof Error && cause.name === 'AbortError') return;
  toast.error(toastErrorMessage(cause), { id: key });
}
