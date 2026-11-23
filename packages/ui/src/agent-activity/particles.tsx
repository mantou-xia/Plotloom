import { memo, useEffect, useRef } from 'react';
import type { ParticleShape } from './activity.ts';
import { createActivityRenderer } from './particle-renderer.js';
import { useColorScheme } from '../theme/theme-root.tsx';

const SHAPES: Record<ParticleShape, number> = { magnifier: 0, cube: 1, bricks: 2, robot: 3, gift: 4, book: 5, pencil: 6, folder: 7, sphere: 8 };

/** 动画完全隔离于 React 渲染；隐藏、离屏、减少动态效果或任务终止时停止 RAF。 */
export const ActivityParticles = memo(function ActivityParticles({ shape, active, reducedMotion }: { shape: ParticleShape; active: boolean; reducedMotion: boolean }) {
  const scheme = useColorScheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<{ update: (shape: ParticleShape, active: boolean, reduced: boolean) => void } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const paint = createActivityRenderer(canvas);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let currentShape = shape, playing = active, reduced = reducedMotion, visible = true;
    let frame = 0, last = 0, elapsed = 0, phase = 0;
    let rotation = 0;
    let drag: { x: number; rotation: number; pointerId: number } | null = null;
    const draw = () => {
      const still = reduced || media.matches || !playing;
      paint(SHAPES[currentShape], still ? Math.max(2, phase) : phase, elapsed, reduced || media.matches, getComputedStyle(canvas).color, rotation);
    };
    const tick = (now: number) => {
      frame = 0;
      if (now - last >= 32) {
        const delta = Math.min((now - last) / 1000, .06);
        elapsed += delta; phase += delta; last = now; draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0; last = performance.now();
      draw();
      if (playing && !reduced && !media.matches && visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    control.current = { update(nextShape, nextActive, nextReduced) {
      if (currentShape !== nextShape) { currentShape = nextShape; phase = 0; }
      playing = nextActive; reduced = nextReduced; sync();
    } };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    // 换算画布缩放后的拖动距离；只修改视角，不重置动效或触发 React 更新。
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      drag = { x: event.clientX, rotation, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId); canvas.dataset.dragging = 'true';
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(bounds.width / 560, bounds.height / 530);
      rotation = drag.rotation + (event.clientX - drag.x) / scale * .008; draw();
    };
    const pointerEnd = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null; delete canvas.dataset.dragging;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault();
      rotation = event.key === 'Home' ? 0 : rotation + (event.key === 'ArrowLeft' ? -.18 : .18); draw();
    };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerEnd);
    canvas.addEventListener('pointercancel', pointerEnd);
    canvas.addEventListener('lostpointercapture', pointerEnd);
    canvas.addEventListener('keydown', keyDown);
    observer.observe(canvas);
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      control.current = null; cancelAnimationFrame(frame); observer.disconnect();
      media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd); canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('lostpointercapture', pointerEnd); canvas.removeEventListener('keydown', keyDown);
      if (drag && canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    };
    // 挂载时只建立一个渲染器；后续 props 通过 update 保留粒子过渡位置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Canvas 像素不会随 CSS 换色。主题切换也走同步绘制，停止状态只补一帧。
  useEffect(() => { control.current?.update(shape, active, reducedMotion); }, [shape, active, reducedMotion, scheme]);
  return <canvas ref={canvasRef} className="pl-agent-activity__canvas" data-shape={shape} tabIndex={0} role="img"
    aria-label="活动粒子：左右拖动或按左右方向键旋转，Home 恢复视角" />;
});
