import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { createThemeTokens } from './theme.ts';
import './theme.css';

/** 通过 CSS 变量向整个产品传播受控主题；不读取存储，也不依赖应用状态。 */
export function ThemeRoot({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  const tokens = useMemo(() => createThemeTokens(color), [color]);
  return <div className="plotloom-theme" style={{ ...tokens as CSSProperties, ...style }}>{children}</div>;
}
