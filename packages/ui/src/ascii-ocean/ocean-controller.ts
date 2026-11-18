import { createSimulation } from './vendor/simulation.js';

export interface OceanOptions { paused: boolean; speed: number }

/** 每个背景独立拥有模拟、观察器和动画帧；React 只提交配置，不逐帧更新组件状态。 */
export function createOceanController(host: HTMLDivElement, canvas: HTMLCanvasElement) {
  const doc = host.ownerDocument;
  const win = doc.defaultView!;
  const { World, AsciiRenderer } = createSimulation(7, doc);
  const world = new World([
    { kind: 'hammerhead', size: 1 }, { kind: 'classic', size: 0.84 },
    { kind: 'zebra', size: 0.77 }, { kind: 'thresher', size: 0.7 },
  ], 180);
  const renderer = new AsciiRenderer(canvas);
  renderer.setFontFamily('PlotloomAsciiOceanMono, Consolas, monospace');
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let options: OceanOptions = { paused: false, speed: 1 };
  let width = 0;
  let height = 0;
  let ready = false;
  let visible = false;
  let destroyed = false;
  let frame = 0;
  let lastTime = 0;

  function render(dt: number) {
    if (ready && !destroyed) renderer.render(world, dt);
  }

  function canAnimate() {
    return ready && width > 0 && height > 0 && visible && !destroyed && !doc.hidden && !options.paused && !reducedMotion.matches;
  }

  /** 慢帧限制总时差并拆为最多 1/60 秒的模拟步，避免群游积分发散和回到页面时跳跃。 */
  function tick(now: number) {
    frame = 0;
    if (!canAnimate()) return;
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0) * options.speed;
    lastTime = now;
    if (dt > 0) {
      const steps = Math.ceil(dt * 60);
      for (let i = 0; i < steps; i++) world.step(dt / steps);
    }
    render(dt);
    frame = win.requestAnimationFrame(tick);
  }

  /** 隐藏、离屏、暂停或减少动态效果时不保留后台动画循环。 */
  function sync() {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (canAnimate()) frame = win.requestAnimationFrame(tick);
  }

  /** 容器尺寸变化时按比例迁移生物，保留当前场景；零尺寸容器等待下一次可见布局。 */
  function resize() {
    if (destroyed) return;
    const nextWidth = host.clientWidth;
    const nextHeight = host.clientHeight;
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    if (nextWidth === width && nextHeight === height && renderer.dpr === dpr) return;
    const sx = nextWidth / (width || nextWidth || 1);
    const sy = nextHeight / (height || nextHeight || 1);
    // 体型按容器短边的比例缩放，宽窄反复切换后能够恢复，不累积缩小。
    const scale = Math.min(nextWidth, nextHeight) / (Math.min(width, height) || Math.min(nextWidth, nextHeight) || 1);
    width = nextWidth;
    height = nextHeight;
    if (!width || !height) { sync(); return; }
    renderer.resize(width, height, dpr);
    if (ready) {
      for (const fish of world.fish) { fish.x *= sx; fish.y *= sy; }
      for (const shark of world.sharks) {
        for (let i = 0; i < shark.nodes.length; i += 2) {
          shark.nodes[i]! *= sx;
          shark.nodes[i + 1]! *= sy;
        }
        shark.length *= scale;
        shark.orbitRadius *= scale;
      }
    }
    world.resize(width, height, renderer.cellWidth, renderer.cellHeight);
    if (!ready) {
      // 预热群游，避免首帧呈现刚生成的直线骨架与堆叠鱼群。
      for (let i = 0; i < 180; i++) world.step(1 / 60);
      ready = true;
    }
    render(0);
    sync();
  }

  const clearPointer = () => { world.pointer.active = false; };
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (!visible) clearPointer();
    sync();
  });
  resizeObserver.observe(host);
  intersectionObserver.observe(host);
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('blur', clearPointer);
  win.addEventListener('resize', resize);
  reducedMotion.addEventListener('change', sync);
  resize();
  // 字体异步完成后，暂停场景也需重绘；卸载后的 Promise 不再访问画布。
  void doc.fonts.load('600 14px PlotloomAsciiOceanMono').then(() => render(0));

  return {
    update(next: OceanOptions) {
      options = { ...next, speed: Number.isFinite(next.speed) ? Math.max(0.25, Math.min(2, next.speed)) : 1 };
      sync();
    },
    pointer(x: number, y: number, active: boolean) { Object.assign(world.pointer, { x, y, active }); },
    clearPointer,
    splash(x: number, y: number) {
      if (!ready || destroyed) return;
      world.splash(x, y);
      render(0);
    },
    destroy() {
      destroyed = true;
      sync();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      doc.removeEventListener('visibilitychange', sync);
      win.removeEventListener('blur', clearPointer);
      win.removeEventListener('resize', resize);
      reducedMotion.removeEventListener('change', sync);
      canvas.width = canvas.height = renderer.bg.width = renderer.bg.height = 0;
    },
  };
}
