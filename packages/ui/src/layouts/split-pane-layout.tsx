import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './split-pane-layout.css';

export interface SplitPaneLayoutProps {
  children?: ReactNode;
  panel?: ReactNode;
  panelTitle: string;
  panelActions?: ReactNode;
  /** undefined 使用默认标题栏；null 允许内容自带标签栏。自定义时调用方提供关闭入口。 */
  panelHeader?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初次挂载的右侧像素宽度；之后保留用户调节结果。 */
  defaultPanelWidth?: number;
  minPanelWidth?: number;
  maxPanelWidth?: number;
  minMainWidth?: number;
  /** 按容器宽度判定；不会低于两侧最小宽度之和。 */
  breakpoint?: number;
  /** 仅在用户完成调宽后回调；跨刷新持久化由应用处理。 */
  onPanelWidthChange?: (width: number) => void;
  className?: string;
  /** 父容器需有界高度；默认占满父容器。 */
  style?: CSSProperties;
}

/** 与 PageLayout 同级的页面布局：二选一使用，只管理尺寸和阅读容器。 */
export function SplitPaneLayout({ children, panel, panelTitle, panelActions, panelHeader, open, onOpenChange,
  defaultPanelWidth = 400, minPanelWidth = 280, maxPanelWidth = 720, minMainWidth = 320,
  breakpoint = 760, onPanelWidthChange, className = '', style }: SplitPaneLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mainPane = useRef<HTMLDivElement>(null);
  const sidePane = useRef<HTMLDivElement>(null);
  const panelRef = useRef<PanelImperativeHandle>(null);
  const motionRef = useRef<Animation[]>([]);
  const previousMode = useRef<boolean | null>(null);
  const lastWidth = useRef(defaultPanelWidth);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const [narrow, setNarrow] = useState(false);
  const [retained, setRetained] = useState(open);
  if (open && !retained) setRetained(true);
  const visible = open || retained;
  const closing = !open && visible;
  const titleId = useId();
  const mainId = useId();
  const sideId = useId();

  useLayoutEffect(() => {
    const node = root.current!;
    const measure = () => setNarrow(node.clientWidth < Math.max(breakpoint, minMainWidth + minPanelWidth + 8));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [breakpoint, minMainWidth, minPanelWidth]);

  useLayoutEffect(() => {
    const container = root.current!;
    const node = dialog.current!;
    const main = mainPane.current!;
    const side = sidePane.current!;
    const panel = panelRef.current!;
    const mode = previousMode.current;
    previousMode.current = narrow;
    const wasMoving = motionRef.current.some(animation => animation.playState === 'running');
    // 先读取当前帧再取消旧动画，快速反向时从屏幕上正在显示的位置继续。
    const fromSide = mode === false ? Number(getComputedStyle(side).flexGrow) : 0;
    const fromOverlay = mode === true && (!open || wasMoving) ? getComputedStyle(node).transform : 'translateX(100%)';
    motionRef.current.forEach(animation => animation.cancel());
    motionRef.current = [];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // resize/getSize 也可能触发布局计算，先禁用锚定，反向时不间断地保持阅读位置。
    if (visible && !narrow && !reduceMotion) container.dataset.moving = '';
    else delete container.dataset.moving;

    if (open && !narrow) panel.resize(Math.max(minPanelWidth, Math.min(maxPanelWidth, lastWidth.current)));
    else panel.collapse();
    const toSide = panel.getSize().asPercentage;

    if (!visible || (!open && mode !== narrow) || reduceMotion
      || (narrow && open && mode === narrow && node.open && !wasMoving)
      || (!narrow && fromSide === toSide)) {
      if (!open && visible) setRetained(false);
      else delete container.dataset.moving;
      return;
    }

    const timing = { duration: 320, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' } as const;
    const animations = narrow
      ? [node.animate([{ transform: fromOverlay }, { transform: open ? 'none' : 'translateX(100%)' }], timing)]
      : [
          main.animate([{ flexGrow: 100 - fromSide }, { flexGrow: 100 - toSide }], timing),
          side.animate([{ flexGrow: fromSide }, { flexGrow: toSide }], timing),
        ];
    animations.forEach(animation => { animation.id = 'pl-split-pane-motion'; });
    motionRef.current = animations;
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (motionRef.current !== animations) return;
      // 保留退场末帧直到 dialog 真正关闭，避免原位置在关闭提交前闪现。
      if (!open) {
        setRetained(false);
        return;
      }
      motionRef.current = [];
      animations.forEach(animation => animation.cancel());
      delete container.dataset.moving;
    });
  }, [open, narrow, visible, minPanelWidth, maxPanelWidth]);

  useLayoutEffect(() => {
    const node = dialog.current!;
    const active = node.ownerDocument.activeElement;
    if (visible && !wasOpen.current) returnFocus.current = active instanceof HTMLElement ? active : null;
    const focusInside = node.contains(active);
    // 同一个 dialog 在桌面为非模态面板，窄屏提升到 top layer；内容始终挂载。
    if (node.open) node.close();
    if (visible) {
      if (narrow) node.showModal();
      else node.show();
      if (focusInside && active instanceof HTMLElement) active.focus({ preventScroll: true });
    } else if (wasOpen.current && focusInside) returnFocus.current?.focus({ preventScroll: true });
    wasOpen.current = visible;
  }, [visible, narrow]);

  useLayoutEffect(() => {
    const node = dialog.current;
    return () => {
      const animations = motionRef.current;
      motionRef.current = [];
      animations.forEach(animation => animation.cancel());
      if (node?.open) node.close();
    };
  }, []);

  /** 调宽从已展开的布局开始，避免尚在过渡的宽度与分隔条的键盘或指针操作竞争。 */
  function finishOpening() {
    if (open) motionRef.current.forEach(animation => animation.cancel());
  }

  return <div ref={root} className={`pl-split-pane ${className}`} data-layout="split-pane"
    data-mode={narrow ? 'overlay' : 'split'} data-closing={closing || undefined} style={style}>
    <Group className="pl-split-pane__group" orientation="horizontal" onLayoutChanged={(layout, meta) => {
      // 只记录真实操作，避免关闭/窄屏造成的零宽度覆盖用户偏好。
      if (!meta.isUserInteraction || narrow || !open) return;
      // 键盘回调可能早于 imperative ref 更新；以本次事件携带的新布局计算。
      const width = layout[sideId] / 100 * (root.current!.clientWidth - 8);
      if (width === 0) onOpenChange(false);
      else { lastWidth.current = width; onPanelWidthChange?.(width); }
    }}>
      <Panel id={mainId} elementRef={mainPane} minSize={narrow ? 0 : minMainWidth}>
        <ScrollBox className="pl-split-pane__main" role="region" aria-label="主内容">{children}</ScrollBox>
      </Panel>
      <Separator className="pl-split-pane__separator" aria-label="调整右侧面板宽度" disabled={!open || narrow}
        onPointerDownCapture={finishOpening} onKeyDownCapture={event => {
          // End 与关闭按钮共用受控退场，避免分栏库在动画读取起始宽度前直接归零。
          if (event.key === 'End' && open && !narrow) {
            event.preventDefault();
            onOpenChange(false);
          } else finishOpening();
        }}
        style={{ display: !visible || narrow ? 'none' : undefined }} />
      <Panel id={sideId} elementRef={sidePane} panelRef={panelRef} defaultSize={open ? defaultPanelWidth : 0} minSize={minPanelWidth}
        maxSize={maxPanelWidth} collapsible groupResizeBehavior="preserve-pixel-size">
        <dialog ref={dialog} className="pl-split-pane__panel" data-mode={narrow ? 'overlay' : 'split'}
          data-closing={closing || undefined}
          aria-labelledby={panelHeader === undefined ? titleId : undefined} aria-label={panelHeader !== undefined ? panelTitle : undefined}
          onCancel={event => { event.preventDefault(); onOpenChange(false); }}
          onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onOpenChange(false); } }}
          onClick={event => {
            if (!narrow || event.target !== event.currentTarget) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onOpenChange(false);
          }}>
          {panelHeader === undefined ? <header className="pl-split-pane__header">
            <h2 id={titleId}>{panelTitle}</h2>
            {panelActions ? <div className="pl-split-pane__actions">{panelActions}</div> : null}
            <Button variant="ghost" size="sm" iconOnly aria-label="关闭右侧面板" onClick={() => onOpenChange(false)}><X /></Button>
          </header> : panelHeader}
          <ScrollBox className="pl-split-pane__body" role="region" aria-label="右侧面板内容">{panel}</ScrollBox>
        </dialog>
      </Panel>
    </Group>
  </div>;
}
