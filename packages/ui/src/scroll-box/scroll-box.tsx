import { useImperativeHandle, useLayoutEffect, useRef, type ComponentPropsWithRef } from 'react';
import './scroll-box.css';

export interface ScrollBoxProps extends ComponentPropsWithRef<'div'> {
  /** 仅所选方向允许用户滚动；调用方通过 style 或 className 约束盒子尺寸。 */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** auto 悬停或聚焦显示，always 始终显示；hidden 不预留轨道，仍可滚动。 */
  scrollbarVisibility?: 'auto' | 'always' | 'hidden';
  /** 默认固定轨道尺寸；全宽内容可选择仅在对应方向溢出时占位。 */
  reserveScrollbarSpace?: boolean;
}

/** 统一滚动入口保留原生交互；滑块显隐只改变颜色，轨道占位由调用方选择。 */
export function ScrollBox({ orientation = 'vertical', scrollbarVisibility = 'auto', reserveScrollbarSpace = true, className = '', tabIndex = 0, style, ref, ...props }: ScrollBoxProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const overflow = reserveScrollbarSpace ? 'scroll' : 'auto';
  useImperativeHandle(ref, () => elementRef.current!, []);
  useLayoutEffect(() => {
    const element = elementRef.current!;
    let frame = 0;
    // 只对确实可滚动的内容着色，避免空轨道也出现可见滑块。
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
      // 始终按组件配置选择滚动方向；按需模式不为空轨道留边。
      overflowX: orientation === 'vertical' ? 'hidden' : overflow,
      overflowY: orientation === 'horizontal' ? 'hidden' : overflow,
      scrollbarGutter: reserveScrollbarSpace && orientation !== 'horizontal' && scrollbarVisibility !== 'hidden' ? 'stable' : 'auto',
    }} />;
}
