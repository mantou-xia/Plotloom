export interface LayoutBox { left: number; top: number; right: number; bottom: number }
interface Band { start: number; end: number; boxes: LayoutBox[] }

/** 合并同一行/列的占位；输入为 margin box，避免把子项外边距重复标成 gap。 */
function bands(boxes: LayoutBox[], horizontal: boolean): Band[] {
  const start = (box: LayoutBox) => horizontal ? box.left : box.top;
  const end = (box: LayoutBox) => horizontal ? box.right : box.bottom;
  const result: Band[] = [];
  for (const box of [...boxes].sort((a, b) => start(a) - start(b))) {
    const previous = result[result.length - 1];
    if (previous && start(box) < previous.end - 0.5) {
      previous.end = Math.max(previous.end, end(box));
      previous.boxes.push(box);
    } else result.push({ start: start(box), end: end(box), boxes: [box] });
  }
  return result;
}

/** 仅标记声明的 gap 宽度；对齐分配的额外空白不涂色，反向排列按视觉位置处理。 */
export function gapRegions(boxes: LayoutBox[], rowGap: number, columnGap: number, layout: 'grid' | 'row' | 'column'): LayoutBox[] {
  if (boxes.length < 2 || (!rowGap && !columnGap)) return [];
  const result: LayoutBox[] = [];
  const add = (items: Band[], gap: number, horizontal: boolean, crossStart: number, crossEnd: number) => {
    if (gap <= 0 || crossEnd <= crossStart) return;
    for (let index = 1; index < items.length; index++) {
      const before = items[index - 1].end, after = items[index].start;
      // 被压缩或重叠的区域只画实际可见部分，不覆盖相邻子项。
      const size = Math.min(gap, after - before);
      if (size <= 0) continue;
      const start = before + (after - before - size) / 2;
      result.push(horizontal
        ? { left: start, right: start + size, top: crossStart, bottom: crossEnd }
        : { left: crossStart, right: crossEnd, top: start, bottom: start + size });
    }
  };
  const left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
  const top = Math.min(...boxes.map(box => box.top)), bottom = Math.max(...boxes.map(box => box.bottom));
  if (layout === 'grid') {
    add(bands(boxes, true), columnGap, true, top, bottom);
    add(bands(boxes, false), rowGap, false, left, right);
  } else {
    const horizontal = layout === 'row';
    const lines = bands(boxes, !horizontal);
    add(lines, horizontal ? rowGap : columnGap, !horizontal, horizontal ? left : top, horizontal ? right : bottom);
    // flex 换行后每行独立计算，最后一行不足一行时也不会跨行误连。
    for (const line of lines) add(bands(line.boxes, horizontal), horizontal ? columnGap : rowGap, horizontal, line.start, line.end);
  }
  return result;
}

/** 从真实 flex/grid 直接子项采样；文字匿名项和 SVG 图标同样参与 gap 布局。 */
export function readGapRegions(element: HTMLElement, style: CSSStyleDeclaration): LayoutBox[] {
  const grid = style.display === 'grid' || style.display === 'inline-grid';
  const flex = style.display === 'flex' || style.display === 'inline-flex';
  if (!grid && !flex) return [];
  const rowGap = parseFloat(style.rowGap) || 0, columnGap = parseFloat(style.columnGap) || 0;
  if (!rowGap && !columnGap) return [];
  const boxes: LayoutBox[] = [];
  for (const child of element.childNodes) {
    if (child instanceof Element) {
      const childStyle = getComputedStyle(child);
      if (childStyle.display === 'none' || childStyle.position === 'absolute' || childStyle.position === 'fixed') continue;
      const rect = child.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      boxes.push({
        left: rect.left - (parseFloat(childStyle.marginLeft) || 0), right: rect.right + (parseFloat(childStyle.marginRight) || 0),
        top: rect.top - (parseFloat(childStyle.marginTop) || 0), bottom: rect.bottom + (parseFloat(childStyle.marginBottom) || 0),
      });
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(child);
      boxes.push(range.getBoundingClientRect());
    }
  }
  return gapRegions(boxes, rowGap, columnGap, grid ? 'grid' : style.flexDirection.startsWith('column') ? 'column' : 'row');
}
