import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChartOptions } from '../../packages/ui/src/markdown/chart-options.ts';

test('数据图表接受柱、线、饼与数据集，强制文字 tooltip 和无动画', () => {
  for (const type of ['bar', 'line', 'pie']) {
    const result = parseChartOptions(JSON.stringify({ series: [{ type, data: [1, 2] }],
      tooltip: { trigger: 'item', renderMode: 'html' }, animation: true, dataset: { source: [[1, 2]] } }));
    assert.deepEqual(result.series, [{ type, data: [1, 2] }]);
    assert.deepEqual(result.dataset, { source: [[1, 2]] });
    assert.deepEqual(result.tooltip, { trigger: 'item', renderMode: 'richText', confine: true });
    assert.equal(result.animation, false);
  }
});

test('图表配置拒绝未完成 JSON、错误根节点及未支持的图表类型', () => {
  for (const source of ['{', 'null', '[]', '1', '{}', '{"series":[]}', '{"series":[{"type":"custom"}]}']) {
    assert.throws(() => parseChartOptions(source));
  }
});

test('模型图表不加载远程图片、不导航、不接入额外 graphic 能力', () => {
  for (const option of [
    { series: [{ type: 'line', symbol: 'image://https://example.com/a.png' }] },
    { title: { link: 'javascript:alert(1)' }, series: [{ type: 'pie' }] },
  ]) assert.throws(() => parseChartOptions(JSON.stringify(option)));
  const result = parseChartOptions(JSON.stringify({ series: [{ type: 'bar', data: [1] }], graphic: { type: 'image' }, toolbox: {} }));
  assert.equal(result.graphic, undefined);
  assert.equal(result.toolbox, undefined);
});
