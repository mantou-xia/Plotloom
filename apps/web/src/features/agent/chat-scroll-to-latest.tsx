import type { RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@plotloom/ui/button';
import './chat-scroll-to-latest.css';

export function ChatScrollToLatest({ visible, viewport }: {
  visible: boolean; viewport: RefObject<HTMLDivElement | null>;
}) {
  /** 先转移焦点以免球隐藏后丢失键盘位置，滚动过程中由页面按实际距离恢复跟随。 */
  function scrollToLatest() {
    const element = viewport.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ top: element.scrollHeight, behavior: reduceMotion ? 'instant' : 'smooth' });
  }

  if (!visible) return null;
  return <Button className="plotloom-chat-scroll-to-latest" variant="secondary" size="lg" iconOnly
    aria-label="回到最新消息" onClick={scrollToLatest}>
    <ArrowDown />
  </Button>;
}
