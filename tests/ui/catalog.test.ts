import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { componentCatalog } from '../../packages/ui/src/workbench/catalog.ts';

test('组件调试台覆盖所有公开产品组件，每个组件登记可选状态和交互说明', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/ui/package.json', import.meta.url), 'utf8'));
  // workbench 是开发工具入口；检查所有公开产品 TSX 导出，后续新增导出也必须登记。
  const components = Object.entries(manifest.exports as Record<string, string>).filter(([path, file]) => !path.startsWith('./workbench') && file.endsWith('.tsx')).map(([path]) => path).sort();
  assert.deepEqual(componentCatalog.map((entry) => entry.exportPath).sort(), components);
  assert.equal(new Set(componentCatalog.map((entry) => entry.id)).size, componentCatalog.length);
  for (const entry of componentCatalog) {
    assert.ok(entry.description && entry.interaction && entry.category, entry.id);
    assert.ok(entry.states.length > 0, entry.id);
    assert.equal(new Set(entry.states.map((state) => state.id)).size, entry.states.length);
    assert.ok(entry.states.every((state) => state.id && state.name && state.description), entry.id);
    assert.ok(entry.width >= 240 && entry.width <= 2400 && entry.height >= 160 && entry.height <= 1600, entry.id);
  }
});
