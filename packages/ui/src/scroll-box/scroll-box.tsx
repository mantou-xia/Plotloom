import { useImperativeHandle, useLayoutEffect, useRef, type ComponentPropsWithRef } from 'react';
import './scroll-box.css';

export interface ScrollBoxProps extends ComponentPropsWithRef<'div'> {
  /** 仅所选方向允许用户滚动；调用方通过 style 或 className 约束盒子尺寸。 */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** auto 悬停或聚焦显示，always 始终显示；hidden 不预留轨道，仍可滚动。 */
  scrollbarVisibility?: 'auto' | 'always' | 'hidden';
}

/** 统一滚动入口：保持原生滚轮、触摸、键盘及 ref 能力，只改变滚动条颜色而不切换布局。 */
export function ScrollBox({ orientation = 'vertical', scrollbarVisibility = 'auto', className = '', tabIndex = 0, style, ref, ...props }: ScrollBoxProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => elementRef.current!, []);
  useLayoutEffect(() => {
    const element = elementRef.current!;
    let frame = 0;
    // 保留原生滚动槽占位，只控制是否着色，避免无溢出时 Windows 仍绘制箭头。
    const measure = () => {
      frame = 0;
      const scrollable = (orientation !== 'horizontal' && element.scrollHeight > element.clientHeight)
        || (orientation !== 'vertical' && element.scrollWidth > element.clientWidth);
      const value = String(scrollable);
      if (element.dataset.scrollable !== value) element.dataset.scrollable = value;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    // 根尺寸与内容尺寸都需要观察：列表变长、折叠或图片加载不一定改变根尺寸。
    const observeSizes = () => {
      resize.disconnect();
      resize.observe(element);
      for (const child of element.children) resize.observe(child);
    };
    const mutations = new MutationObserver((records) => {
      if (records.every(record => record.target === element && record.attributeName === 'data-scrollable')) return;
      if (records.some(record => record.type === 'childList')) observeSizes();
      schedule();
    });
    observeSizes();
    mutations.observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
    measure();
    return () => { resize.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame); };
  }, [orientation]);
  return <div {...props} ref={elementRef} tabIndex={tabIndex}
    className={`plotloom-scroll-box ${className}`}
    data-orientation={orientation} data-scrollbar-visibility={scrollbarVisibility}
    style={{
      ...style,
      // 固定滚动机制，避免通用尺寸样式的 overflow:auto 破坏占位保证。
      overflowX: orientation === 'vertical' ? 'hidden' : 'scroll',
      overflowY: orientation === 'horizontal' ? 'hidden' : 'scroll',
      scrollbarGutter: orientation === 'horizontal' || scrollbarVisibility === 'hidden' ? 'auto' : 'stable',
    }} />;
}
