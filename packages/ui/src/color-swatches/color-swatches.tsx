import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { ColorPicker } from '../color-picker/color-picker.tsx';
import { foregroundFor } from '../theme/theme.ts';
import './color-swatches.css';

export interface ColorSwatchesProps {
  color: string;
  onChange: (color: string) => void;
  presets: readonly { name: string; color: string }[];
  label?: string;
  swatchSize?: number;
  gap?: number;
  style?: CSSProperties;
  feedback?: ReactNode;
}

/** 通用颜色入口：预设与自定义共用受控值；主题、持久化和业务反馈均由调用方提供。 */
export function ColorSwatches({ color, onChange, presets, label = '颜色', swatchSize = 40, gap = 14, style, feedback }: ColorSwatchesProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const custom = !presets.some((preset) => preset.color === color);
  // 外部预设替换颜色时清理旧输入草稿；关闭弹窗不会撤销已经应用的颜色。
  function selectPreset(next: string) {
    setRevision((value) => value + 1);
    onChange(next);
  }
  // 原生模态层管理焦点、Esc、外部关闭及焦点归还，避免组件重复维护焦点陷阱。
  function openPicker() {
    dialog.current?.showModal();
    setOpen(true);
  }
  return <div className="plotloom-color-swatches" style={{ '--pl-swatch-size': `${swatchSize}px`, ...style } as CSSProperties}>
    <div className="plotloom-color-swatches__presets" role="group" aria-label={label} style={{ gap }}>
      {presets.map((preset) => <button key={preset.color} type="button" className="plotloom-color-swatches__swatch"
        style={{ background: preset.color, color: foregroundFor(preset.color) }} aria-label={preset.name} title={preset.name}
        aria-pressed={color === preset.color} onClick={() => selectPreset(preset.color)}>
        {color === preset.color ? <Check size={20} aria-hidden="true" /> : null}
      </button>)}
      <button type="button" className="plotloom-color-swatches__swatch plotloom-color-swatches__add"
        aria-label={`自定义${label}`} title={custom ? `自定义${label}：${color}` : `自定义${label}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} aria-pressed={custom} onClick={openPicker}>
        <Plus size={20} aria-hidden="true" />
      </button>
    </div>
    {!open ? feedback : null}
    <dialog ref={dialog} id={`${id}-dialog`} className="plotloom-color-swatches__dialog" aria-labelledby={`${id}-title`} closedby="any" onClose={() => setOpen(false)}>
      <div className="plotloom-color-swatches__dialog-heading">
        <h2 id={`${id}-title`}>自定义颜色</h2>
        <button type="button" className="plotloom-color-swatches__close" aria-label="关闭自定义颜色" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      </div>
      <ColorPicker key={revision} color={color} onChange={onChange} />
      {feedback}
    </dialog>
  </div>;
}
