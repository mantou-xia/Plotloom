export type ToastKind = 'success' | 'error' | 'info' | 'loading';
export interface ToastOptions { id?: string; duration?: number }
export interface ToastItem {
  id: string; message: string; kind: ToastKind; duration: number;
  count: number; revision: number; exiting: boolean;
}
export interface ToastMessages<T> {
  loading: string;
  success: string | ((value: T) => string);
  error?: string | ((cause: unknown) => string);
}

/** 纯状态调度，不依赖 React 或请求实现；计时由实际可见的 Toast 负责，排队时不会过期。 */
export function createToastStore() {
  let items: ToastItem[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  function emit() { for (const listener of listeners) listener(); }
  function remove(id: string) { items = items.filter(item => item.id !== id); emit(); }
  function dismiss(id: string) {
    // 等待中的提示没有退出动画，直接移除，避免占用后续展示名额。
    if (items.findIndex(item => item.id === id) >= 3) { remove(id); return; }
    items = items.map(item => item.id === id ? { ...item, exiting: true } : item); emit();
  }
  function show(kind: ToastKind, message: string, options: ToastOptions = {}) {
    const existing = options.id ? items.find(item => item.id === options.id)
      : kind === 'loading' ? undefined : items.find(item => !item.exiting && item.kind === kind && item.message === message);
    const id = existing?.id ?? options.id ?? `toast-${++sequence}`;
    const item: ToastItem = { id, message, kind, duration: options.duration ?? (kind === 'loading' ? 0 : kind === 'error' ? 6000 : 3500),
      count: existing && !options.id ? existing.count + 1 : 1, revision: (existing?.revision ?? 0) + 1, exiting: false };
    items = existing ? items.map(current => current.id === id ? item : current) : [...items, item];
    emit(); return id;
  }
  const store = {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => items,
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    info: (message: string, options?: ToastOptions) => show('info', message, options),
    loading: (message: string, options?: ToastOptions) => show('loading', message, options),
    dismiss, remove,
    clear() { items = []; emit(); },
    /** 一次操作复用同一个 id；错误继续抛出给业务处理，主动取消静默撤销提示。 */
    async promise<T>(operation: () => Promise<T>, messages: ToastMessages<T>): Promise<T> {
      const id = store.loading(messages.loading);
      try {
        const result = await operation();
        // 用户已关闭或清空的任务提示不在完成时重新出现。
        if (items.some(item => item.id === id && !item.exiting)) store.success(typeof messages.success === 'function' ? messages.success(result) : messages.success, { id });
        return result;
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') dismiss(id);
        else if (items.some(item => item.id === id && !item.exiting)) store.error(typeof messages.error === 'function' ? messages.error(cause) : messages.error ?? toastErrorMessage(cause), { id });
        throw cause;
      }
    },
  };
  return store;
}

export function toastErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : '操作失败，请重试。';
}
export type ToastStore = ReturnType<typeof createToastStore>;
/** 每个应用挂载一个 ToastViewport；普通工具函数可直接调用这个实例。 */
export const toast = createToastStore();
