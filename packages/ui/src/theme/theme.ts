import { generate } from '@ant-design/colors';

export const DEFAULT_THEME_COLOR = '#2563eb';
export const THEME_PRESETS = [
  { name: '湖蓝', color: DEFAULT_THEME_COLOR },
  { name: '青绿', color: '#0f766e' },
  { name: '森林', color: '#15803d' },
  { name: '琥珀', color: '#d97706' },
  { name: '玫瑰', color: '#be123c' },
  { name: '紫罗兰', color: '#7c3aed' },
] as const;

/** 只接受不透明的 3/6 位 HEX，统一成六位小写；不把半输入状态当成新主题。 */
export function normalizeThemeColor(value: string): string | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`.toLowerCase();
}

/** 使用 sRGB 相对亮度计算对比度；调用方传入已规范化的六位 HEX。 */
export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 黑白前景选对比度较高者，保证任意用户颜色上的普通文字可读。 */
export function foregroundFor(background: string): string {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000')
    ? '#ffffff' : '#000000';
}

/** 主色保持用户选择，派生状态独立配前景；文字与焦点用足够深的同色系颜色。 */
export function createThemeTokens(input: string): Record<`--pl-${string}`, string> {
  const color = normalizeThemeColor(input) ?? DEFAULT_THEME_COLOR;
  const palette = generate(color);
  const hover = palette[4];
  const active = palette[6];
  // 黑色等输入的最浅色阶仍可能偏暗；选中区域需要浅底，回退中性浅灰保持语义。
  const subtle = contrastRatio(palette[0], '#000000') >= 7 ? palette[0] : '#f6f6f7';
  const text = [color, ...palette.slice(6), '#000000'].find((candidate) =>
    contrastRatio(candidate, '#ffffff') >= 4.5 && contrastRatio(candidate, subtle) >= 4.5
      && contrastRatio(candidate, '#f6f6f7') >= 4.5,
  )!;
  return {
    '--pl-primary': color,
    '--pl-primary-hover': hover,
    '--pl-primary-active': active,
    '--pl-on-primary': foregroundFor(color),
    '--pl-on-primary-hover': foregroundFor(hover),
    '--pl-on-primary-active': foregroundFor(active),
    '--pl-primary-subtle': subtle,
    '--pl-primary-text': text,
    '--pl-focus': text,
  };
}
