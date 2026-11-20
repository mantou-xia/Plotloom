import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { MorphPanelLayoutContext, MenuTriggerOpenContext } from './contexts.ts';
import { SHARE_MOTION, CORNER_CURVATURE, continuousRadius, computedCornerCurvature, springEase, motionColor } from './motion.ts';
import { morphingPopoverStyles } from './styles.ts';

export interface MorphingTriggerProps {
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  'aria-haspopup': 'dialog';
}
export interface MorphingPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 普通节点自行连接开关；渲染函数直接将提供的属性传给 Button 即可。 */
  trigger: ReactNode | ((props: MorphingTriggerProps) => ReactNode);
  children: ReactNode;
  panelWidth?: number | string;
  panelAlign?: 'left' | 'right';
  panelPlacement?: 'above' | 'below';
  label?: string;
  className?: string;
  panelClassName?: string;
  style?: CSSProperties;
  reducedMotion?: boolean;
  panelShadow?: string;
  zIndex?: number;
  staggerContent?: boolean;
  triggerLayout?: 'inline' | 'block';
  /** 在浏览器顶层显示，避开滚动容器裁剪；仍保留原 DOM 的主题与事件关系。 */
  topLayer?: boolean;
  /** 内容自行绘制背景时使用；外层形变面板仍负责表面背景。 */
  unstyled?: boolean;
  layoutId?: string;
}
const OPEN_SHADOW = '0 6px 24px rgba(0,0,0,0.10)';
const CLOSED_SHADOW = '0 0 0 rgba(0,0,0,0)';

/** 从 LeiBox MorphingMenuShell 提取。保留原始动效，只处理通用布局和生命周期，无业务数据依赖。 */
export function MorphingPopover({ open, onOpenChange, trigger, children, panelWidth,
  panelAlign = 'left', panelPlacement = 'above', label = '功能面板', className = '', panelClassName = '', style,
  reducedMotion, panelShadow = OPEN_SHADOW, zIndex = 50, staggerContent = false, triggerLayout = 'inline',
  unstyled = false, layoutId, topLayer = false,
}: MorphingPopoverProps) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousOpen = useRef(open);
  const hasChangedOpen = useRef(false);
  const latest = useRef({ open, onOpenChange });
  latest.current = { open, onOpenChange };
  const [present, setPresent] = useState(open);
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const showPanel = open || present;
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!event.composedPath().includes(containerRef.current!)) latest.current.onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.onOpenChange(false);
    };
    const document = containerRef.current!.ownerDocument;
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useLayoutEffect(() => {
    const shell = shellRef.current, anchor = anchorRef.current, compact = compactRef.current;
    const panel = panelRef.current, content = contentRef.current;
    if (!shell || !anchor || !compact) return;
    const document = shell.ownerDocument;
    const window = document.defaultView!;
    const getComputedStyle = window.getComputedStyle.bind(window);
    const activeElement = () => (shell.getRootNode() as Document | ShadowRoot).activeElement;
    const prefersReducedMotion = () => reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 默认展开属于静态初始画面。StrictMode 会重放 effect，不能把第二次 setup
    // 当成用户打开面板，否则外壳已展开、文字却重新从透明和 y=6 开始跳入。
    if (previousOpen.current !== open) hasChangedOpen.current = true;
    const initiallyOpen = open && !hasChangedOpen.current;
    previousOpen.current = open;
    let disposed = false;
    let timeline: gsap.core.Timeline | undefined;
    let resize: gsap.core.Tween | undefined;
    let restoreFocus = shell.contains(activeElement());
    // 读取真实触发器尺寸；展开时用占位维持工具栏布局，关闭后恢复自然排版。
    const compactSize = () => {
      if (triggerLayout === "block") compact.style.width = `${anchor.clientWidth}px`;
      const button = compact.querySelector("button");
      const css = getComputedStyle(button ?? compact);
      // offsetWidth/Height 会取整，导致浮层占位与原按钮相差小数像素，甚至触发标题换行。
      // 读取布局尺寸保留精度；不取变换后的矩形，避免收起时的 scale 污染下一次占位。
      const compactCss = getComputedStyle(compact);
      const width = parseFloat(compactCss.width), height = parseFloat(compactCss.height);
      return {
        width,
        height,
        radius: Math.min(parseFloat(css.borderTopLeftRadius) || height / 2, height / 2),
        curvature: computedCornerCurvature(css),
        background: motionColor(css.backgroundColor)
      };
    };
    let closed = compactSize();
    const restClosed = () => {
      if (shell.matches(':popover-open')) shell.hidePopover();
      shell.removeAttribute('popover');
      gsap.set(compact, { opacity: 1, clearProps: "position,left,right,top,bottom,transform,maxWidth" });
      gsap.set(shell, { clearProps: "position,left,right,top,bottom,width,height,maxWidth,overflow,borderRadius,backgroundColor,boxShadow,transform,--morph-corner-curvature" });
      anchor.style.width = "";
      anchor.style.height = "";
      if (triggerLayout === "block") compact.style.width = "100%";
    };
    compact.inert = open;
    if (panel) panel.inert = !open;
    if (!showPanel || !panel || !content) {
      restClosed();
      return;
    }
    if (open) setPresent(true);
    anchor.style.width = triggerLayout === "block" ? "100%" : `${closed.width}px`;
    anchor.style.height = `${closed.height}px`;
    if (shell.style.position !== (topLayer ? 'fixed' : 'absolute')) {
      gsap.set(shell, {
        position: topLayer ? 'fixed' : 'absolute',
        width: closed.width,
        height: closed.height,
        maxWidth: "none",
        borderRadius: closed.radius,
        "--morph-corner-curvature": closed.curvature,
        backgroundColor: closed.background
      });
    }
    // 顶层外壳以视口坐标跟随原位占位，避免父级 overflow/transform 改变裁剪和定位。
    const positionShell = () => {
      const rect = anchor.getBoundingClientRect();
      gsap.set(shell, {
        left: panelAlign === 'left' ? topLayer ? rect.left : 0 : 'auto',
        right: panelAlign === 'right' ? topLayer ? window.innerWidth - rect.right : 0 : 'auto',
        bottom: panelPlacement === 'above' ? topLayer ? window.innerHeight - rect.bottom : 0 : 'auto',
        top: panelPlacement === 'below' ? topLayer ? rect.top : 0 : 'auto',
      });
    };
    if (topLayer) {
      shell.setAttribute('popover', 'manual');
      if (!shell.matches(':popover-open')) shell.showPopover();
    } else if (shell.hasAttribute('popover')) {
      if (shell.matches(':popover-open')) shell.hidePopover();
      shell.removeAttribute('popover');
    }
    positionShell();
    gsap.set(compact, {
      position: "absolute",
      // 弹簧收回会短暂小于按钮的自然宽度。按钮不得跟随外壳被挤窄换行，
      // 否则选项更新后的标签会从一行跳成两行；动画结束后恢复正常宽度约束。
      maxWidth: "none",
      left: panelAlign === "left" ? 0 : "auto",
      right: panelAlign === "right" ? 0 : "auto",
      bottom: panelPlacement === "above" ? 0 : "auto",
      top: panelPlacement === "below" ? 0 : "auto"
    });
    // 面板以触发器底边/顶边为锚点；视口不足时仅限制内容滚动，不缩放文字。
    const expandedSize = () => {
      panel.style.width = "";
      const scrollTop = content.scrollTop;
      content.style.maxHeight = "";
      content.style.overflowY = "";
      const width = Math.min(content.offsetWidth, window.innerWidth - 32);
      panel.style.width = `${width}px`;
      const rect = anchor.getBoundingClientRect();
      const availableHeight = panelPlacement === "above" ? rect.bottom - 16 : window.innerHeight - rect.top - 16;
      if (panel.offsetHeight > availableHeight) {
        content.style.maxHeight = `${Math.max(24, availableHeight)}px`;
        content.style.overflowY = "auto";
        content.scrollTop = scrollTop;
      }
      const left = panelAlign === "right" ? rect.right - width : rect.left;
      return {
        width,
        height: panel.offsetHeight,
        x: Math.max(16, Math.min(left, window.innerWidth - width - 16)) - left
      };
    };
    let expanded = expandedSize();
    const finish = () => {
      if (disposed || latest.current.open !== open) return;
      setLayoutAnimating(false);
      if (open) shell.style.overflow = "visible";
      else {
        restClosed();
        setPresent(false);
      }
    };
    const focus = () => {
      if (!disposed && restoreFocus && (!activeElement() || activeElement() === document.body) && latest.current.open === open) {
        (open ? panel : compact.querySelector("button"))?.focus({ preventScroll: true });
      }
    };
    // 保留 LeiBox 的宽高独立弹簧、延时、模糊及交错动画；关闭动画结束后才卸载内容。
    const play = () => {
      timeline?.kill();
      resize?.kill();
      const reduced = prefersReducedMotion() || initiallyOpen;
      if (reduced) {
        gsap.set(shell, {
          width: open ? expanded.width : closed.width,
          height: open ? expanded.height : closed.height,
          x: open ? expanded.x : 0,
          borderRadius: open ? continuousRadius(16) : closed.radius,
          "--morph-corner-curvature": open ? CORNER_CURVATURE : closed.curvature,
          backgroundColor: open ? motionColor(getComputedStyle(panel).backgroundColor) : closed.background,
          boxShadow: open ? panelShadow : CLOSED_SHADOW
        });
        gsap.set(compact, { opacity: open ? 0 : 1, scale: 1 });
        gsap.set(panel, { opacity: open ? 1 : 0, filter: "blur(0px)" });
        finish();
        focus();
        return;
      }
      setLayoutAnimating(true);
      shell.style.overflow = "hidden";
      const motion = open ? SHARE_MOTION.open : SHARE_MOTION.close;
      timeline = gsap.timeline({ onComplete: finish });
      timeline.to(shell, {
        width: open ? expanded.width : closed.width,
        duration: motion.width.duration,
        ease: springEase(motion.width.stiffness, motion.width.damping, motion.width.duration)
      }, motion.width.delay);
      timeline.to(shell, {
        height: open ? expanded.height : closed.height,
        duration: motion.height.duration,
        ease: springEase(motion.height.stiffness, motion.height.damping, motion.height.duration)
      }, motion.height.delay);
      timeline.to(shell, {
        x: open ? expanded.x : 0,
        borderRadius: open ? continuousRadius(16) : closed.radius,
        "--morph-corner-curvature": open ? CORNER_CURVATURE : closed.curvature,
        backgroundColor: open ? motionColor(getComputedStyle(panel).backgroundColor) : closed.background,
        boxShadow: open ? panelShadow : CLOSED_SHADOW,
        duration: 0.22,
        ease: "power2.out"
      }, 0);
      timeline.to(compact, { opacity: open ? 0 : 1, duration: 0.14, ease: "power2.out" }, open ? 0 : 0.2);
      if (!open) timeline.fromTo(compact, { scale: 0.95 }, {
        scale: 1,
        duration: 0.48,
        ease: springEase(300, 21, 0.48)
      }, 0.2);
      timeline.to(panel, {
        opacity: open ? 1 : 0,
        filter: open ? "blur(0px)" : "blur(5px)",
        duration: open ? 0.24 : 0.18,
        ease: "power2.out"
      }, open ? 0.12 : 0);
      if (open && staggerContent) {
        const rows = Array.from(content.querySelectorAll("[role=menuitem], [data-menu-item]")).slice(0, 24);
        timeline.fromTo(rows, { opacity: 0, y: 6 }, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: Math.min(0.025, 0.16 / Math.max(1, rows.length)),
          ease: springEase(280, 24, 0.5)
        }, 0.13);
      }
      timeline.call(focus, [], 0.36);
    };
    play();
    // 动态内容和窗口尺寸变化沿原版 resize 弹簧重新定位，并在卸载时清理监听和动画。
    const retarget = () => {
      if (disposed) return;
      closed = compactSize();
      if (!latest.current.open) return;
      positionShell();
      const next = expandedSize();
      if (Math.abs(next.width - expanded.width) < 0.5 && Math.abs(next.height - expanded.height) < 0.5 && Math.abs(next.x - expanded.x) < 0.5) return;
      const widthChanged = Math.abs(next.width - expanded.width) >= 0.5;
      expanded = next;
      resize?.kill();
      gsap.killTweensOf(shell, widthChanged ? "width,height,x" : "height,x");
      const motion = SHARE_MOTION.resize;
      resize = gsap.to(shell, {
        ...widthChanged ? { width: expanded.width } : {},
        x: expanded.x,
        height: expanded.height,
        duration: prefersReducedMotion() ? 0 : motion.duration,
        ease: springEase(motion.stiffness, motion.damping, motion.duration)
      });
    };
    const observer = new ResizeObserver(retarget);
    observer.observe(content);
    observer.observe(compact);
    const outsideFocus = (event: FocusEvent) => {
      if (!event.composedPath().includes(shell)) restoreFocus = false;
    };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("focusin", outsideFocus);
    window.addEventListener("resize", retarget);
    if (topLayer) window.addEventListener('scroll', retarget, true);
    media.addEventListener("change", play);
    return () => {
      disposed = true;
      timeline?.kill();
      resize?.kill();
      observer.disconnect();
      document.removeEventListener("focusin", outsideFocus);
      window.removeEventListener("resize", retarget);
      if (topLayer) window.removeEventListener('scroll', retarget, true);
      media.removeEventListener("change", play);
    };
  }, [open, showPanel, panelAlign, panelPlacement, panelShadow, triggerLayout, reducedMotion, panelWidth, topLayer]);

  const triggerNode = typeof trigger === 'function' ? trigger({ onClick: () => onOpenChange(!open),
    'aria-expanded': open, 'aria-controls': showPanel ? panelId : undefined, 'aria-haspopup': 'dialog' }) : trigger;
  return <div ref={containerRef} className={'pl-morphing-popover ' + className} style={style} data-trigger-layout={triggerLayout}>
    {/* 样式放在所属树内，普通文档和原版 Shadow DOM 使用同一份定义。 */}
    <style>{morphingPopoverStyles}</style>
    <div ref={anchorRef} className="pl-morphing-popover__anchor">
      <div ref={shellRef} className="pl-morphing-popover__shell morph-menu-shell" data-motion-id={layoutId ?? panelId}
        data-state={open ? 'open' : 'closed'} data-morph-placement={panelPlacement}
        style={{ zIndex: showPanel ? zIndex : undefined, pointerEvents: !open && present ? 'none' : undefined }}>
        <div ref={compactRef} className="pl-morphing-popover__compact morph-menu-compact">
          <MenuTriggerOpenContext.Provider value={open}>{triggerNode}</MenuTriggerOpenContext.Provider>
        </div>
        {showPanel ? <div ref={panelRef} id={panelId} role="dialog" aria-label={label} data-morph-panel
          aria-hidden={!open} tabIndex={-1} className="pl-morphing-popover__panel morph-menu-expanded ui-menu-surface"
          style={{ opacity: 0, pointerEvents: open ? 'auto' : 'none' }}>
          <MorphPanelLayoutContext.Provider value={layoutAnimating}>
            <div ref={contentRef} className={'pl-morphing-popover__content morph-menu-content ' + panelClassName}
              style={{ width: panelWidth, background: unstyled ? 'transparent' : undefined }}>{children}</div>
          </MorphPanelLayoutContext.Provider>
        </div> : null}
      </div>
    </div>
  </div>;
}
