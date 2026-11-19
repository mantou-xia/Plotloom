import { useRef, useState, type CSSProperties } from 'react';
import { Combobox } from 'deep-agent-base-ui/combobox';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { useFormField, useFormValue, type FormOption, type FormSize } from './shared.ts';
import './form.css';

interface SelectCommonProps {
  options: readonly FormOption[];
  name?: string;
  id?: string;
  size?: FormSize;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  emptyText?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-describedby'?: string;
}
export type SelectProps = SelectCommonProps & (
  { multiple?: false; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string | null) => void }
  | { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
);

/** 用字符串 id 对外传值，搜索仅匹配选项标签；底层负责键盘、焦点归还及隐藏表单字段。 */
export function Select({ size = 'md', placeholder = '请选择', searchable = true, clearable = true, emptyText = '没有匹配的选项',
  className = '', style, ...props }: SelectProps) {
  const field = useFormField();
  const trigger = useRef<HTMLButtonElement>(null);
  const [current, change] = useFormValue<string | string[] | null, []>(props.value, props.defaultValue ?? (props.multiple ? [] : null), value => {
    if (props.multiple) props.onValueChange?.(Array.isArray(value) ? value : []);
    else props.onValueChange?.(typeof value === 'string' ? value : null);
  }, trigger);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const label = (value: string) => props.options.find(option => option.value === value)?.label ?? value;
  return <Combobox.Root<string, boolean> items={props.options.map(option => option.value)} multiple={props.multiple ?? false}
    value={current} name={props.name} disabled={props.disabled} readOnly={props.readOnly}
    required={props.required ?? field.required} itemToStringLabel={label} filter={searchable ? undefined : null}
    onValueChange={change} onOpenChange={open => {
      // 弹层放在当前主题/原生模态容器下，既继承主题，也不被模态顶层遮挡。
      if (open) setContainer(trigger.current?.closest<HTMLElement>('dialog:modal') ?? trigger.current?.closest<HTMLElement>('.plotloom-theme') ?? null);
    }}>
    <div className={`pl-form-control pl-form-select ${className}`} data-size={size} data-invalid={props.invalid || field.invalid || undefined} style={style}>
      <Combobox.Trigger ref={trigger} id={props.id} className="pl-form-select__trigger" aria-label={props['aria-label']}
        aria-describedby={props['aria-describedby']} aria-invalid={props.invalid || field.invalid || undefined}>
        <span className="pl-form-select__value"><Combobox.Value>{(value: string | string[] | null) => {
          const values = Array.isArray(value) ? value : value === null ? [] : [value];
          return values.length ? values.map(label).join('、') : <span className="pl-form-placeholder">{placeholder}</span>;
        }}</Combobox.Value></span>
        <ChevronDown size={16} className="pl-form-select__chevron" aria-hidden="true" />
      </Combobox.Trigger>
      {clearable && !props.readOnly ? <Combobox.Clear className="pl-form-step" aria-label="清空选择"><X size={16} /></Combobox.Clear> : null}
    </div>
    <Combobox.Portal container={container}>
      <Combobox.Positioner sideOffset={6} className="pl-form-select__positioner">
        <Combobox.Popup className="pl-form-select__popup" data-size={size}>
          {searchable ? <div className="pl-form-select__search"><Search size={16} aria-hidden="true" /><Combobox.Input aria-label="搜索选项" placeholder="搜索选项…" className="pl-form-text" /></div> : null}
          <ScrollBox className="pl-form-select__scroll" tabIndex={-1}>
            <Combobox.Empty className="pl-form-select__empty">{emptyText}</Combobox.Empty>
            <Combobox.List>{(value: string) => <Combobox.Item key={value} value={value}
              disabled={props.options.find(option => option.value === value)?.disabled} className="pl-form-select__option">
              <span>{label(value)}</span><Combobox.ItemIndicator className="pl-form-select__selected"><Check size={16} /></Combobox.ItemIndicator>
            </Combobox.Item>}
            </Combobox.List>
          </ScrollBox>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>;
}
