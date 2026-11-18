import { useLayoutEffect, useRef } from 'react';

// Adapted from LeiBox Elastic Panel Resize, independent DOM/SVG reconstruction.
// Source: https://leibox.pantoria.cn/docs/animations/elastic-panel-resize
// Design reference: Alvish — https://x.com/alvish/status/2111084319716647114/video/1

/** 每帧只更新布局与把手，不重渲染业务子树；取消和卸载时释放捕获、观察器和动画。 */
export function useElasticSidebar(initial: number, minimum: number, maximum: number, gap: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const handle = handleRef.current!;
    const path = pathRef.current!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let min = minimum, max = maximum, position = initial, target = initial;
    let velocity = 0, bend = 0, bendTarget = 0, bendVelocity = 0, raf = 0, last = 0;
    let drag: { id: number; x: number; start: number; previous: number } | null = null;
    const clamp = (value: number) => Math.max(min, Math.min(max, value));
    const draw = () => {
      root.style.setProperty('--pl-sidebar-width', `${position}px`);
      path.setAttribute('d', `M20 20 Q${20 + bend * 2} 50 20 80`);
      handle.setAttribute('aria-valuemin', String(Math.round(min)));
      handle.setAttribute('aria-valuemax', String(Math.round(max)));
      handle.setAttribute('aria-valuenow', String(Math.round(target)));
      handle.setAttribute('aria-valuetext', `侧边栏宽度 ${Math.round(target)} 像素`);
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000 || 1 / 60, 1 / 30);
      last = now;
      if (media.matches) { position = target; velocity = 0; bend = 0; bendVelocity = 0; }
      else for (let i = 0; i < 4; i++) {
        const step = dt / 4;
        if (!drag) { velocity += ((target - position) * 400 - velocity * 26) * step; position += velocity * step; }
        bendVelocity += ((bendTarget - bend) * 680 - bendVelocity * 34) * step;
        bend += bendVelocity * step;
      }
      draw();
      if (!media.matches && ((!drag && Math.abs(position - target) > 0.1) || Math.abs(velocity) > 0.1 || Math.abs(bendTarget - bend) > 0.01 || Math.abs(bendVelocity) > 0.1)) raf = requestAnimationFrame(tick);
      else if (!drag) { position = target; bend = 0; draw(); }
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const release = (cancel = false) => {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (cancel) target = clamp(previous.start);
      bendTarget = 0; velocity = 0;
      delete root.dataset.dragging;
      if (handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
      wake();
    };
    // 窄容器优先保留右侧可用空间；两列不换行，侧栏边界随容器实时收缩。
    const resize = () => {
      const css = getComputedStyle(root);
      const available = Math.max(0, root.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) - gap);
      max = Math.max(0, Math.min(maximum, available - Math.min(280, available * 0.55)));
      min = Math.min(minimum, max);
      release(true);
      position = target = clamp(target);
      velocity = 0; draw();
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, start: target, previous: event.clientX };
      position = target; velocity = 0;
      root.dataset.dragging = 'true';
      handle.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      const raw = drag.start + event.clientX - drag.x;
      target = clamp(raw);
      const excess = raw - target;
      // 仅越界部分施加阻尼，最多拉伸 15px；有效区间跟手，松开弹回合法宽度。
      position = media.matches ? target : target + Math.sign(excess) * Math.min(15, min / 3) * (1 - Math.exp(-Math.abs(excess) / 35));
      bendTarget = Math.max(-6, Math.min(6, (event.clientX - drag.previous) * 0.7 + Math.sign(excess) * 3));
      drag.previous = event.clientX;
      draw(); wake();
    };
    const up = (event: PointerEvent) => { if (drag?.id === event.pointerId) release(); };
    const cancel = (event: PointerEvent) => { if (drag?.id === event.pointerId) release(true); };
    const lost = () => release(true);
    const reset = () => { release(true); target = clamp(initial); bendTarget = 0; wake(); };
    const key = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') { if (drag) release(true); else reset(); return; }
      release();
      const step = event.shiftKey ? 32 : 8;
      target = clamp(event.key === 'Home' ? min : event.key === 'End' ? max : target + (event.key === 'ArrowRight' ? step : -step));
      wake();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', lost);
    handle.addEventListener('dblclick', reset);
    handle.addEventListener('keydown', key);
    media.addEventListener('change', wake);
    return () => {
      observer.disconnect();
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', lost);
      handle.removeEventListener('dblclick', reset);
      handle.removeEventListener('keydown', key);
      media.removeEventListener('change', wake);
      release(true);
      cancelAnimationFrame(raf);
    };
  }, [initial, minimum, maximum, gap]);
  return { rootRef, handleRef, pathRef };
}
