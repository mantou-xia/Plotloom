import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gapRegions } from '../../packages/ui/src/workbench/gap-regions.ts';

test('grid 同时标记行列间隔，不涂到子项内部', () => {
  const boxes = [
    { left: 0, top: 0, right: 40, bottom: 20 }, { left: 52, top: 0, right: 92, bottom: 20 },
    { left: 0, top: 28, right: 40, bottom: 48 }, { left: 52, top: 28, right: 92, bottom: 48 },
  ];
  assert.deepEqual(gapRegions(boxes, 8, 12, 'grid'), [
    { left: 40, right: 52, top: 0, bottom: 48 }, { left: 0, right: 92, top: 20, bottom: 28 },
  ]);
});

test('flex 换行分别标记行间距和行内间距，反向 DOM 顺序不影响结果', () => {
  const boxes = [
    { left: 0, top: 0, right: 40, bottom: 20 }, { left: 50, top: 0, right: 90, bottom: 20 },
    { left: 0, top: 28, right: 30, bottom: 48 },
  ];
  const expected = [
    { left: 0, right: 90, top: 20, bottom: 28 }, { left: 40, right: 50, top: 0, bottom: 20 },
  ];
  assert.deepEqual(gapRegions(boxes, 8, 10, 'row'), expected);
  assert.deepEqual(gapRegions(boxes.toReversed(), 8, 10, 'row'), expected);
});

test('纵向 flex 使用 row-gap，分配的额外空白不全部算作 gap', () => {
  assert.deepEqual(gapRegions([
    { left: 0, top: 0, right: 80, bottom: 20 }, { left: 0, top: 60, right: 80, bottom: 80 },
  ], 10, 18, 'column'), [{ left: 0, right: 80, top: 35, bottom: 45 }]);
});

test('单个子项或 gap 为零时不绘制间距', () => {
  const box = { left: 0, top: 0, right: 80, bottom: 20 };
  assert.deepEqual(gapRegions([box], 10, 10, 'grid'), []);
  assert.deepEqual(gapRegions([box, { ...box, top: 40, bottom: 60 }], 0, 0, 'column'), []);
});
