import { useEffect, type CSSProperties, type RefObject } from 'react';
import { createRefractionField } from './refraction.ts';

/**
 * 仅液态材质建立观察器；尺寸/圆角变化才重建贴图，页面滚动与动画交由浏览器实时采样。
 * CSS.supports 只能检测语法，Firefox/WebKit 可能接受 url 却不渲染背景位移，故限定 Chromium。
 */
export function useGlassRefraction(rootRef: RefObject<HTMLDivElement | null>,
  filterRef: RefObject<SVGFilterElement | null>, mapRef: RefObject<SVGFEImageElement | null>,
  filterId: string, enabled: boolean, borderRadius: CSSProperties['borderRadius'], className: string) {
  useEffect(() => {
    const root = rootRef.current;
    const filter = filterRef.current;
    const map = mapRef.current;
    if (!enabled || !root || !filter || !map || !/Chrom(e|ium)\/|Edg\//.test(navigator.userAgent)) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let previous = '';
    function update() {
      frame = 0;
      if (!root || !filter || !map || !context) return;
      // offset 尺寸不受调用方 transform 缩放影响，避免贴图与布局尺寸错位。
      const width = root.offsetWidth;
      const height = root.offsetHeight;
      if (!width || !height) return;
      const corner = getComputedStyle(root).borderTopLeftRadius;
      const radius = parseFloat(corner) * (corner.endsWith('%') ? Math.min(width, height) / 100 : 1);
      const key = `${width}:${height}:${radius}`;
      if (key === previous) return;
      previous = key;
      canvas.width = width;
      canvas.height = height;
      const pixels = context.createImageData(width, height);
      pixels.data.set(createRefractionField(width, height, radius));
      context.putImageData(pixels, 0, 0);
      filter.setAttribute('width', String(width));
      filter.setAttribute('height', String(height));
      map.setAttribute('width', String(width));
      map.setAttribute('height', String(height));
      map.setAttribute('href', canvas.toDataURL());
      root.style.setProperty('--pl-card-filter', `url("#${filterId}") blur(.65px) saturate(1.12)`);
    }
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(update);
    });
    observer.observe(root, { box: 'border-box' });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.style.removeProperty('--pl-card-filter');
    };
  }, [rootRef, filterRef, mapRef, filterId, enabled, borderRadius, className]);
}
