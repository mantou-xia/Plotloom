import { useId, useState, type CSSProperties } from 'react';
import { Check, Plus } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { foregroundFor, normalizeThemeColor } from '../theme/theme.ts';
import { hexToRgbFields, rgbFieldsToHex } from './color-values.ts';
import './color-picker.css';

const PRESET_COLORS = [
  '#e6f4ff', '#a3d3ff', '#7abaff', '#4e98f2', '#2575e6', '#0052d9', '#003eb3', '#002c8c', '#001d66', '#001040',
  '#fff1f0', '#ffccc7', '#ffa39e', '#ff7875', '#ff4d4f', '#f5222d', '#cf1322', '#a8071a', '#820014', '#5c0011',
  '#fff6e8', '#ffe4bf', '#ffd096', '#fcb76d', '#f09541', '#e37318', '#bd550b', '#963b02', '#702700', '#4a1700',
  '#e8f5ed', '#c1e8d2', '#95d6b4', '#6dc799', '#4ab883', '#2ba471', '#1a7d57', '#0e573d', '#053023', '#010a08',
  '#ffffff', '#f5f5f5', '#e7e7e7', '#dcdcdc', '#a6a6a6', '#8b8b8b', '#737373', '#555555', '#333333', '#000000',
];

export interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  defaultFormat?: 'HEX' | 'RGB';
  style?: CSSProperties;
}

/** 常驻纯色面板：格式只影响输入展示；取色、色板和输入始终通过六位 HEX 回调。 */
export function ColorPicker({ color, onChange, defaultFormat = 'HEX', style }: ColorPickerProps) {
  const id = useId();
  const [format, setFormat] = useState(defaultFormat);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const values = draft ?? (format === 'HEX' ? [color] : hexToRgbFields(color));
  const parsed = format === 'HEX' ? normalizeThemeColor(values[0]) : rgbFieldsToHex(values);
  const invalid = parsed === null;

  // 输入期间保留草稿；HEX 缩写在确认时展开，RGB 每次只修改当前通道。
  function commitDraft() {
    if (draft === null || !parsed) return;
    // 完整输入已实时提交，失焦只清理草稿，避免重复回调令宿主回写过期颜色。
    if (parsed !== color) onChange(parsed);
    setDraft(null);
  }

  function selectColor(next: string) {
    setDraft(null);
    onChange(next);
  }

  // 手动记录最终选择，避免拖动色面时把每一帧的中间色塞入历史；仅保留本面板最近十色。
  function rememberColor() {
    setRecentColors((current) => [color, ...current.filter((item) => item !== color)].slice(0, 10));
  }

  return (
    <div className="plotloom-color-picker" role="group" aria-label="纯色选择器" style={style}>
      <div className="plotloom-color-picker__palette">
        <HexColorPicker color={color} onChange={selectColor} aria-label="选择颜色" />
        <span className="plotloom-color-picker__current" style={{ background: color }} role="img" aria-label={`当前颜色 ${color}`} title={color} />
      </div>
      <div className="plotloom-color-picker__fields">
        <select className="plotloom-color-picker__format" aria-label="颜色格式" value={format} onChange={(event) => { setFormat(event.target.value as 'HEX' | 'RGB'); setDraft(null); }}>
          <option value="HEX">HEX</option><option value="RGB">RGB</option>
        </select>
        <div className="plotloom-color-picker__channels">
          {values.map((value, index) => <input
            key={`${format}-${index}`}
            className="plotloom-color-picker__input"
            aria-label={format === 'HEX' ? 'HEX 颜色值' : `RGB ${['R', 'G', 'B'][index]}`}
            inputMode={format === 'RGB' ? 'numeric' : 'text'}
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              const next = values.map((field, fieldIndex) => fieldIndex === index ? event.target.value : field);
              setDraft(next);
              const normalized = format === 'RGB' ? rgbFieldsToHex(next) : /^#?[\da-f]{6}$/i.test(next[0].trim()) ? normalizeThemeColor(next[0]) : null;
              if (normalized) onChange(normalized);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitDraft(); }
              // 清理草稿，同时保留宿主弹窗的原生 Esc 关闭行为。
              if (event.key === 'Escape') setDraft(null);
            }}
          />)}
        </div>
      </div>
      {invalid ? <p id={`${id}-error`} className="plotloom-color-picker__error" role="status">
        {format === 'HEX' ? '请输入 3 或 6 位 HEX 颜色。' : 'RGB 各通道请输入 0—255 的整数。'}
      </p> : null}
      <section className="plotloom-color-picker__section" aria-labelledby={`${id}-recent`}>
        <div className="plotloom-color-picker__heading"><h4 id={`${id}-recent`}>最近使用颜色</h4>
          <button type="button" className="plotloom-color-picker__add" onClick={rememberColor} aria-label="添加当前颜色到最近使用" title="添加当前颜色"><Plus size={16} aria-hidden="true" /></button>
        </div>
        <div className="plotloom-color-picker__swatches">
          {recentColors.map((item) => <button key={item} type="button" className="plotloom-color-picker__swatch" style={{ background: item, color: foregroundFor(item) }} aria-label={`最近颜色 ${item}`} title={item} aria-pressed={color === item} onClick={() => selectColor(item)}>{color === item ? <Check size={12} aria-hidden="true" /> : null}</button>)}
        </div>
        {recentColors.length === 0 ? <p className="plotloom-color-picker__empty">点击添加按钮记录当前颜色</p> : null}
      </section>
      <section className="plotloom-color-picker__section" aria-labelledby={`${id}-presets`}>
        <div className="plotloom-color-picker__heading"><h4 id={`${id}-presets`}>系统预设颜色</h4></div>
        <div className="plotloom-color-picker__swatches">
          {PRESET_COLORS.map((item) => <button key={item} type="button" className="plotloom-color-picker__swatch" style={{ background: item, color: foregroundFor(item) }} aria-label={`预设颜色 ${item}`} title={item} aria-pressed={color === item} onClick={() => selectColor(item)}>{color === item ? <Check size={12} aria-hidden="true" /> : null}</button>)}
        </div>
      </section>
    </div>
  );
}
