import { createContext, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createThemeTokens, resolveColorScheme, SYSTEM_DARK_QUERY, type ColorScheme, type ThemeMode } from './theme.ts';
import './theme.css';

const SchemeContext = createContext<ColorScheme | null>(null);
const readSystemScheme = () => matchMedia(SYSTEM_DARK_QUERY).matches;
const lightOnServer = () => false;
function subscribeSystemScheme(notify: () => void) {
  const media = matchMedia(SYSTEM_DARK_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

export function useColorScheme(): ColorScheme {
  return useContext(SchemeContext) ?? 'light';
}

/** 文档级主题也覆盖挂到 body 的弹层；嵌套主题仅覆盖自身子树。 */
export function ThemeRoot({ color, mode, documentTheme = false, children, style }: {
  color: string; mode?: ThemeMode; documentTheme?: boolean; children: ReactNode; style?: CSSProperties;
}) {
  const inherited = useContext(SchemeContext);
  const systemDark = useSyncExternalStore(subscribeSystemScheme, readSystemScheme, lightOnServer);
  const scheme = mode ? resolveColorScheme(mode, systemDark) : inherited ?? resolveColorScheme('system', systemDark);
  const tokens = useMemo(() => createThemeTokens(color, scheme), [color, scheme]);
  useLayoutEffect(() => {
    if (!documentTheme) return;
    const root = document.documentElement;
    root.dataset.plScheme = scheme;
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    return () => {
      delete root.dataset.plScheme;
      for (const name of Object.keys(tokens)) root.style.removeProperty(name);
    };
  }, [documentTheme, scheme, tokens]);
  return <SchemeContext.Provider value={scheme}>
    <div className="plotloom-theme" data-pl-scheme={scheme} style={{ ...tokens as CSSProperties, ...style }}>{children}</div>
  </SchemeContext.Provider>;
}
