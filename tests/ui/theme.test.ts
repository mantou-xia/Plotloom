import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio, createThemeTokens, DEFAULT_THEME_COLOR, normalizeThemeColor, normalizeThemeMode, resolveColorScheme, THEME_PRESETS } from '../../packages/ui/src/theme/theme.ts';

test('显式模式覆盖系统，缺失或非法设置跟随系统', () => {
  assert.equal(normalizeThemeMode('old'), 'system');
  assert.equal(normalizeThemeMode(null), 'system');
  assert.equal(resolveColorScheme('system', true), 'dark');
  assert.equal(resolveColorScheme('system', false), 'light');
  assert.equal(resolveColorScheme('light', true), 'light');
  assert.equal(resolveColorScheme('dark', false), 'dark');
});

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
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = createThemeTokens(color, scheme);
      assert.equal(tokens['--pl-primary'], color);
      for (const state of ['', '-hover', '-active']) {
        assert.ok(contrastRatio(tokens[`--pl-primary${state}`], tokens[`--pl-on-primary${state}`]) >= 4.5, `${color} ${state}`);
      }
      assert.ok(contrastRatio(tokens['--pl-primary-text'], tokens['--pl-primary-subtle']) >= 4.5, `${color} selected`);
      const surfaces = scheme === 'dark' ? ['#18191c', '#222428', '#2c2e34'] : ['#ffffff', '#f6f6f7'];
      for (const surface of surfaces) {
        assert.ok(contrastRatio(tokens['--pl-primary-text'], surface) >= 4.5, `${color} ${scheme} link`);
        assert.ok(contrastRatio(tokens['--pl-focus'], surface) >= 3, `${color} ${scheme} focus`);
      }
    }
  }
});
