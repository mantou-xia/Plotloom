import { DesktopTitleBar as TitleBar } from '@plotloom/ui/layouts/desktop-title-bar';
import { useColorScheme } from '@plotloom/ui/theme-root';
import { useLayoutEffect, useRef } from 'react';
import type { DesktopStorage } from '../features/settings/storage-settings';

declare global {
  interface Window {
    plotloomDesktop?: {
      setTitleBarColor: (symbolColor: string, backgroundColor: string) => void;
      storage?: DesktopStorage;
    };
  }
}

/** 原生按钮位于网页上方，按页面蒙层的颜色合成原生背景和图标。 */
function dimTitleBarColor(context: CanvasRenderingContext2D, color: string, overlay: string) {
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = overlay;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${red}, ${green}, ${blue})`;
}

export function DesktopTitleBar({ accentColor }: { accentColor: string }) {
  const scheme = useColorScheme();
  const titleBar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const bar = titleBar.current;
    const desktop = window.plotloomDesktop;
    if (!bar || !desktop) return;
    const { color, backgroundColor } = getComputedStyle(bar);
    let wasModal: boolean | undefined;
    const sync = () => {
      const modal = document.querySelector('dialog:modal') !== null;
      if (modal === wasModal) return;
      wasModal = modal;
      if (!modal) {
        desktop.setTitleBarColor(color, backgroundColor);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context) {
        const overlay = getComputedStyle(bar, '::after').backgroundColor;
        desktop.setTitleBarColor(dimTitleBarColor(context, color, overlay), dimTitleBarColor(context, backgroundColor, overlay));
      } else desktop.setTitleBarColor(color, backgroundColor);
    };
    // 同时处理已挂载弹窗的开关，以及打开后卸载的弹窗和抽屉。
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    sync();
    return () => observer.disconnect();
  }, [scheme, accentColor]);

  return window.plotloomDesktop ? <TitleBar ref={titleBar} title="Plotloom" /> : null;
}
