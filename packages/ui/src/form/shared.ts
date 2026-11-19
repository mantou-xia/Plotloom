import { createContext, useContext, useEffect, useState, type RefObject } from 'react';

export type FormSize = 'sm' | 'md' | 'lg';
export interface FormOption { value: string; label: string; disabled?: boolean }
export const FormFieldContext = createContext({ required: false, invalid: false, disabled: false, inField: false });
export const useFormField = () => useContext(FormFieldContext);

/** Base UI 的内部值不会响应原生 reset；统一托管非受控值，受控字段仍由调用方重置。 */
export function useFormValue<T, Details extends unknown[]>(value: T | undefined, defaultValue: T, onValueChange: ((value: T, ...details: Details) => void) | undefined,
  ref: RefObject<HTMLElement | null>) {
  const [internal, setInternal] = useState({ value: defaultValue });
  useEffect(() => {
    const element = ref.current;
    const form = element && 'form' in element ? element.form as HTMLFormElement | null : element?.closest('form');
    const reset = (event: Event) => {
      // 等其他 reset 监听器处理完，再尊重 preventDefault 的结果。
      // 受控值也需重新渲染，让原生 reset 后的隐藏输入重新与 props 对齐。
      queueMicrotask(() => { if (!event.defaultPrevented) setInternal({ value: defaultValue }); });
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [ref, defaultValue, value]);
  return [value !== undefined ? value : internal.value, (next: T, ...details: Details) => {
    onValueChange?.(next, ...details);
    // 保留底层事件的取消能力；null 是合法空值，不能退回旧值。
    const event = details[0] as { isCanceled?: boolean } | undefined;
    if (value === undefined && !event?.isCanceled) setInternal({ value: next });
  }] as const;
}

export const useTextValue = useFormValue<string, []>;
