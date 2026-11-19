import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

test('TaskComposer 校验上游源码与已登记的通用组件提取版本', async () => {
  const base = new URL('../../packages/ui/src/task-composer/original/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('source.json', base), 'utf8'));
  assert.equal(Object.keys(manifest.sha256).length, 4);
  for (const [file, hash] of Object.entries(manifest.sha256)) {
    const content = await readFile(new URL(file, base));
    assert.equal(createHash('sha256').update(content).digest('hex'), manifest.localChanges?.[file]?.sha256 ?? hash, file);
  }
});
