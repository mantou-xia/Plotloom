import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hexToRgbFields, rgbFieldsToHex } from '../../packages/ui/src/color-picker/color-values.ts';

test('RGB 编辑仍提交六位 HEX，保留零值和通道顺序', () => {
  assert.equal(rgbFieldsToHex(['0', '82', '217']), '#0052d9');
  assert.equal(rgbFieldsToHex(['255', '255', '255']), '#ffffff');
  assert.equal(rgbFieldsToHex(['0', '0', '0']), '#000000');
  assert.deepEqual(hexToRgbFields('#2563eb'), ['37', '99', '235']);
  for (const r of [0, 1, 127, 255]) for (const g of [0, 1, 127, 255]) for (const b of [0, 1, 127, 255]) {
    const fields = [r, g, b].map(String);
    assert.deepEqual(hexToRgbFields(rgbFieldsToHex(fields)!), fields);
  }
});

test('空通道、越界和非整数不会覆盖当前颜色', () => {
  for (const invalid of ['', ' ', '-1', '256', '1.5', '1e2', 'NaN', 'ff']) {
    assert.equal(rgbFieldsToHex([invalid, '82', '217']), null, invalid);
  }
  assert.equal(rgbFieldsToHex(['0', '82']), null);
  assert.equal(rgbFieldsToHex(['0', '82', '217', '1']), null);
});
