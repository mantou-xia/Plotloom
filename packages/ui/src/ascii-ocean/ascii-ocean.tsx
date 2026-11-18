import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { createOceanController } from './ocean-controller';
import './ascii-ocean.css';

export interface AsciiOceanProps {
  className?: string;
  /** 默认填满父容器；父容器须有确定高度，或在这里指定组件高度。 */
  style?: CSSProperties;
  /** 暂停自动游动；系统开启减少动态效果时也保持静态。 */
  paused?: boolean;
  /** 游动速度倍率，0.25—2，默认 1。 */
  speed?: number;
  /** 点击或 Enter 制造水波后回传组件内的 CSS 像素坐标。 */
  onSplash?: (point: { x: number; y: number }) => void;
}

/** 独立字符海洋背景：实例生命周期与配置更新分离，改变速度和暂停状态不重建鱼群。 */
export function AsciiOcean({ className = '', style, paused = false, speed = 1, onSplash }: AsciiOceanProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<ReturnType<typeof createOceanController> | null>(null);
  useEffect(() => {
    const controller = createOceanController(hostRef.current!, canvasRef.current!);
    controllerRef.current = controller;
    return () => { controller.destroy(); controllerRef.current = null; };
  }, []);
  useEffect(() => { controllerRef.current?.update({ paused, speed }); }, [paused, speed]);

  // 按画布实际显示尺寸换算，保证调试台缩放与普通页面中的鼠标命中位置一致。
  function point(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.clientWidth / rect.width, y: (event.clientY - rect.top) * canvas.clientHeight / rect.height };
  }
  function splash(position: { x: number; y: number }) {
    controllerRef.current?.splash(position.x, position.y);
    onSplash?.(position);
  }
  return <div ref={hostRef} className={`plotloom-ascii-ocean ${className}`} style={style}>
    <canvas ref={canvasRef} tabIndex={0} role="img" aria-label="ASCII 鲨鱼与鱼群。移动指针避让，点击水面或按回车制造水波。"
      onPointerMove={(event) => { const p = point(event); controllerRef.current?.pointer(p.x, p.y, event.pointerType !== 'touch'); }}
      onPointerLeave={() => controllerRef.current?.clearPointer()}
      onPointerCancel={() => controllerRef.current?.clearPointer()}
      onBlur={() => controllerRef.current?.clearPointer()}
      onClick={(event) => splash(point(event))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); splash({ x: event.currentTarget.clientWidth / 2, y: event.currentTarget.clientHeight / 2 }); }
      }} />
  </div>;
}
