import { useId, useImperativeHandle, useRef, type ComponentPropsWithRef, type CSSProperties } from 'react';
import { useGlassRefraction } from './use-glass-refraction.ts';
import './card.css';

export type CardMaterial = 'normal' | 'liquid-glass';

export interface CardProps extends ComponentPropsWithRef<'div'> {
  /** 普通材质保持实色背景；液态玻璃折射真实背景，非 Chromium 浏览器降级为模糊玻璃。 */
  material?: CardMaterial;
  /** 默认 8px，与项目基础控件统一；数字按 px 处理，也可传 CSS 长度。 */
  borderRadius?: CSSProperties['borderRadius'];
  /** 默认 12px；支持 CSS 简写，例如 '12px 16px'。 */
  padding?: CSSProperties['padding'];
  /** 默认纯白；液态玻璃中作为 10% 的染色，不遮挡背后的页面内容。 */
  backgroundColor?: CSSProperties['backgroundColor'];
  /** 默认关闭；开启时使用中性灰实线，不叠加阴影。 */
  bordered?: boolean;
}

/** 材质只处理背后的像素，不过滤 children；公开外观参数优先于 style。 */
export function Card({ borderRadius = 8, padding = 12, backgroundColor = '#ffffff', bordered = false,
  material = 'normal', className = '', style, children, ref, ...props }: CardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  const mapRef = useRef<SVGFEImageElement>(null);
  const filterId = `pl-card-glass-${useId().replace(/:/g, '')}`;
  const glass = material === 'liquid-glass';
  useImperativeHandle(ref, () => rootRef.current!, []);
  useGlassRefraction(rootRef, filterRef, mapRef, filterId, glass, borderRadius, className);

  return <div {...props} ref={rootRef} className={`plotloom-card ${className}`.trim()}
    data-material={material} data-bordered={bordered} style={{
    ...style, borderRadius, padding, '--pl-card-tint': backgroundColor,
    backgroundColor: glass ? 'var(--pl-card-glass-background)' : backgroundColor,
    border: bordered ? '1px solid var(--pl-border, #d4d4d8)' : 'none',
  } as CSSProperties}>
    {glass ? <svg className="plotloom-card__filter" width="0" height="0" aria-hidden="true" focusable="false">
      <defs><filter ref={filterRef} id={filterId} x="0" y="0" width="100%" height="100%"
        filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage ref={mapRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="field" />
        {/* 8 位贴图的 128 对齐到精确的 0.5，让卡片中心保持原位。 */}
        <feComponentTransfer in="field" result="centered-field">
          <feFuncR type="linear" intercept={-0.5 / 255} />
          <feFuncG type="linear" intercept={-0.5 / 255} />
        </feComponentTransfer>
        <feDisplacementMap in="SourceGraphic" in2="centered-field" scale="112" xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
    </svg> : null}
    {children}
  </div>;
}
