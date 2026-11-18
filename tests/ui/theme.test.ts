import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio, createThemeTokens, DEFAULT_THEME_COLOR, normalizeThemeColor, THEME_PRESETS } from '../../packages/ui/src/theme/theme.ts';

test('HEX 输入规范化，半输入及不透明度不作为主题保存', () => {
  assert.equal(normalizeThemeColor(' #AbC '), '#aabbcc');
  assert.equal(normalizeThemeColor('ABC123'), '#abc123');
  for (const input of ['', '#12', '#1234', '#12345', '#12345678', 'red', '#gggggg']) {
    assert.equal(normalizeThemeColor(input), null);
  }
  assert.equal(createThemeTokens('bad color')['--pl-primary'], DEFAULT_THEME_COLOR);
});

test('任意主色保留原值，按钮状态、选中背景及链接前景达到普通文字对比度', () => {
  const colors = new Set(['#000000', '#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#777777', ...THEME_PRESETS.map(({ color }) => color)]);
  // RGB 网格覆盖高亮、低亮及高饱和颜色，防止仅在默认主题上验证文字可读性。
  for (let red = 0; red <= 255; red += 51) {
    for (let green = 0; green <= 255; green += 51) {
      for (let blue = 0; blue <= 255; blue += 51) {
        colors.add(`#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`);
      }
    }
  }
  for (const color of colors) {
    const tokens = createThemeTokens(color);
    assert.equal(tokens['--pl-primary'], color);
    for (const state of ['', '-hover', '-active']) {
      assert.ok(contrastRatio(tokens[`--pl-primary${state}`], tokens[`--pl-on-primary${state}`]) >= 4.5, `${color} ${state}`);
    }
    assert.ok(contrastRatio(tokens['--pl-primary-text'], tokens['--pl-primary-subtle']) >= 4.5, `${color} selected`);
    assert.ok(contrastRatio(tokens['--pl-primary-text'], '#ffffff') >= 4.5, `${color} link`);
    assert.ok(contrastRatio(tokens['--pl-primary-text'], '#f6f6f7') >= 4.5, `${color} muted link`);
    assert.ok(contrastRatio(tokens['--pl-focus'], '#ffffff') >= 3, `${color} focus`);
  }
});
