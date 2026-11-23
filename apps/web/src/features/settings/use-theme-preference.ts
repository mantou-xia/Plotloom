import { useState } from 'react';
import { normalizeThemeColor, readThemeMode, writeThemeMode, type ThemeMode } from '@plotloom/ui/theme';
import { toast } from '@plotloom/ui/toast/utils';
import { readThemePreference, writeThemePreference } from './theme-preference.ts';

/** 首次渲染同步恢复主题；用户操作直接应用与保存，避免 effect 延迟换色。 */
export function useThemePreference() {
  const [preference, setPreference] = useState(readThemePreference);
  const [mode, updateMode] = useState(readThemeMode);

  function setColor(input: string) {
    const color = normalizeThemeColor(input);
    if (!color) return;
    const saved = writeThemePreference(color);
    setPreference({ color, storageError: !saved });
    if (saved) toast.success('主题色已保存', { id: 'theme-save' });
    else toast.error('颜色已应用，但未能保存，刷新后可能恢复默认。', { id: 'theme-save' });
  }

  /** 存储不可用时仍允许在当前窗口切换。 */
  function setMode(next: ThemeMode) {
    updateMode(next);
    if (!writeThemeMode(next)) toast.error('外观已切换，但未能保存。', { id: 'theme-mode-save' });
  }

  return { ...preference, mode, setMode, setColor };
}
