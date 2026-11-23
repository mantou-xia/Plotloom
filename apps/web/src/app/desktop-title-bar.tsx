import { DesktopTitleBar as TitleBar } from '@plotloom/ui/layouts/desktop-title-bar';
import { useColorScheme } from '@plotloom/ui/theme-root';
import { useLayoutEffect, useRef } from 'react';

declare global {
  interface Window {
    plotloomDesktop?: { setTitleBarColor: (symbolColor: string, backgroundColor: string) => void };
  }
}

/** 主题模式或主色切换时，同步原生按钮的底色和图标色。 */
export function DesktopTitleBar({ accentColor }: { accentColor: string }) {
  const scheme = useColorScheme();
  const titleBar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!titleBar.current) return;
    const { color, backgroundColor } = getComputedStyle(titleBar.current);
    window.plotloomDesktop?.setTitleBarColor(color, backgroundColor);
  }, [scheme, accentColor]);

  return window.plotloomDesktop ? <TitleBar ref={titleBar} title="Plotloom" /> : null;
}
