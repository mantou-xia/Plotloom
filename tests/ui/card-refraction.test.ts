import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRefractionField } from '../../packages/ui/src/card/refraction.ts';

test('玻璃中心不位移，四边折射方向对称且所有像素完全不透明', () => {
  const width = 160;
  const height = 100;
  const field = createRefractionField(width, height, 20);
  const pixel = (x: number, y: number) => Array.from(field.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
  assert.deepEqual(pixel(80, 50), [128, 128, 128, 255]);
  assert.deepEqual(pixel(0, 0), [128, 128, 128, 255]);
  assert.ok(pixel(2, 50)[0]! > 128 && pixel(157, 50)[0]! < 128);
  assert.equal(pixel(2, 50)[0]! + pixel(157, 50)[0]!, 256);
  assert.equal(pixel(80, 2)[1]! + pixel(80, 97)[1]!, 256);
  assert.ok(pixel(80, 2)[1]! > 128 && pixel(80, 97)[1]! < 128);
  for (let i = 3; i < field.length; i += 4) assert.equal(field[i], 255);
});

test('尺寸变化和无圆角仍生成有效贴图，大圆角按实际短边收敛', () => {
  for (const [width, height] of [[360, 220], [80, 24], [1, 1]]) {
    assert.equal(createRefractionField(width!, height!, 0).length, width! * height! * 4);
    assert.deepEqual(createRefractionField(width!, height!, 160), createRefractionField(width!, height!, Math.min(width!, height!) / 2));
  }
});
