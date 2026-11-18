import { useEffect, useRef, useState, type RefObject } from 'react';
import { readGapRegions } from './gap-regions.ts';

const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;

/** 调试层只读真实 DOM 盒模型，在独立画布绘制，避免修改组件样式或拦截交互。 */
export function BoxModelOverlay({ stageRef }: { stageRef: RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState<string[]>([]);
  useEffect(() => {
    const stage = stageRef.current!;
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;
    let frame = 0;
    let hovered: HTMLElement | null = null;
    let pointer: { x: number; y: number } | null = null;
    let elements: HTMLElement[] = [];
    const eligible = (element: Element): element is HTMLElement => element instanceof HTMLElement
      && !element.matches('.pl-example-target, .pl-example-feedback, script, style');

    // 同一帧合并尺寸、内容和滚动变化；关闭检查时完整释放观察器及事件。
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = new ResizeObserver(schedule);
    const collect = () => {
      elements = Array.from(stage.querySelectorAll('*')).filter(eligible);
      resize.disconnect();
      resize.observe(stage);
      elements.forEach((element) => resize.observe(element));
    };

    function draw() {
      frame = 0;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      let hit = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
      // SVG 图标归属到其 HTML 容器，避免图标路径成为检查目标。
      while (hit && !(hit instanceof HTMLElement)) hit = hit.parentElement;
      hovered = hit;
      if (!hovered || !stage.contains(hovered) || !eligible(hovered)) hovered = null;
      const ordered = hovered ? [...elements.filter((element) => element !== hovered), hovered] : elements;
      let nextInfo: string[] = [];
      for (const element of ordered) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'contents') continue;
        const selected = element === hovered;
        const padding = sides.map((side) => parseFloat(style.getPropertyValue(`padding-${side.toLowerCase()}`)) || 0);
        const margin = sides.map((side) => parseFloat(style.getPropertyValue(`margin-${side.toLowerCase()}`)) || 0);
        const border = sides.map((side) => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0);
        context.save();
        // 祖先的滚动裁切必须同步到调试层，隐藏的内容不能透过容器显示。
        for (let parent = element.parentElement; parent && stage.contains(parent); parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent);
          const box = parent.getBoundingClientRect();
          const clipX = parentStyle.overflowX !== 'visible';
          const clipY = parentStyle.overflowY !== 'visible';
          if (clipX || clipY) {
            context.beginPath();
            context.rect(clipX ? box.left + parent.clientLeft : 0, clipY ? box.top + parent.clientTop : 0,
              clipX ? parent.clientWidth : window.innerWidth, clipY ? parent.clientHeight : window.innerHeight);
            context.clip();
          }
        }
        context.globalAlpha = selected ? 0.42 : hovered ? 0.035 : 0.13;
        context.fillStyle = '#0d9488';
        const x = rect.left + border[3], y = rect.top + border[0];
        const width = rect.width - border[1] - border[3], height = rect.height - border[0] - border[2];
        context.fillRect(x, y, width, padding[0]);
        context.fillRect(x, y + height - padding[2], width, padding[2]);
        context.fillRect(x, y + padding[0], padding[3], Math.max(0, height - padding[0] - padding[2]));
        context.fillRect(x + width - padding[1], y + padding[0], padding[1], Math.max(0, height - padding[0] - padding[2]));
        context.fillStyle = '#ea8a23';
        // 负 margin 向盒内标记，读数保留符号；折叠 margin 按各元素计算值展示，不相加。
        context.fillRect(rect.left, rect.top - margin[0], rect.width, margin[0]);
        context.fillRect(rect.right, rect.top, margin[1], rect.height);
        context.fillRect(rect.left, rect.bottom, rect.width, margin[2]);
        context.fillRect(rect.left - margin[3], rect.top, margin[3], rect.height);
        // gap 属于父布局，复用同一裁切与透明度；路径一次填充，行列交叉处不重复加深。
        context.save();
        // overflow:visible 的网格轨道可能超出自身宽度，不能提前裁掉可滚动到的 gap。
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          context.beginPath();
          context.rect(style.overflowX !== 'visible' ? x : 0, style.overflowY !== 'visible' ? y : 0,
            style.overflowX !== 'visible' ? element.clientWidth : window.innerWidth,
            style.overflowY !== 'visible' ? element.clientHeight : window.innerHeight);
          context.clip();
        }
        context.fillStyle = '#8b5cf6';
        context.beginPath();
        for (const gap of readGapRegions(element, style)) context.rect(gap.left, gap.top, gap.right - gap.left, gap.bottom - gap.top);
        context.fill();
        context.restore();
        context.globalAlpha = selected ? 1 : hovered ? 0.12 : 0.45;
        context.strokeStyle = '#525252';
        context.lineWidth = selected ? 2 : 1;
        context.strokeRect(rect.left, rect.top, rect.width, rect.height);
        context.restore();
        if (selected) nextInfo = [
          `${element.tagName.toLowerCase()}${element.classList[0] ? `.${element.classList[0]}` : ''} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`,
          `padding: ${padding.join(' / ')} px`,
          `margin: ${margin.join(' / ')} px`,
          ...(/^(inline-)?(flex|grid)$/.test(style.display) ? [`gap: 行 ${style.rowGap === 'normal' ? '0px' : style.rowGap} / 列 ${style.columnGap === 'normal' ? '0px' : style.columnGap}`] : []),
        ];
      }
      setInfo((current) => current.join('|') === nextInfo.join('|') ? current : nextInfo);
    }
    const move = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; schedule(); };
    const leave = () => { pointer = null; schedule(); };
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList')) collect();
      schedule();
    });
    collect();
    mutations.observe(stage, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    schedule();
    return () => {
      resize.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', leave);
    };
  }, [stageRef]);
  return <><canvas ref={canvasRef} className="pl-box-model-overlay" aria-hidden="true" />
    {info.length ? <output className="pl-box-model-info" aria-label="元素盒模型">{info.map((line, index) => <span key={index}>{line}</span>)}</output> : null}
  </>;
}
