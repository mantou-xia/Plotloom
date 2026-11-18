import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../../packages/ui/src/ascii-ocean/vendor/simulation.js';

/** 单独验证群游模型，不创建 renderer，因此不需要浏览器 Document 或 Canvas。 */
function school() {
  const { World } = createSimulation(7, null!);
  const world = new World([], 40);
  world.resize(960, 640, 8, 12);
  return world;
}

test('海洋实例具有独立随机状态，交错运行不影响同种子的场景', () => {
  const first = school();
  const second = school();
  for (let i = 0; i < 120; i++) { first.step(1 / 60); second.step(1 / 60); }
  assert.deepEqual(first.fish, second.fish);
  assert.ok(first.fish.every(fish => Number.isFinite(fish.x) && Number.isFinite(fish.y)));
});

test('指针避让和点击水波会改变附近鱼群轨迹', () => {
  const calm = school();
  const pointer = school();
  const splash = school();
  const fish = calm.fish[0]!;
  const x = fish.x - 30;
  const y = fish.y;
  Object.assign(pointer.pointer, { x, y, active: true });
  splash.splash(x, y);
  for (let i = 0; i < 10; i++) { calm.step(1 / 60); pointer.step(1 / 60); splash.step(1 / 60); }
  const distance = (world: ReturnType<typeof school>) => Math.hypot(world.fish[0]!.x - x, world.fish[0]!.y - y);
  assert.ok(distance(pointer) > distance(calm), '附近鱼群避开指针');
  assert.ok(distance(splash) > distance(calm), '附近鱼群远离点击位置');
});
