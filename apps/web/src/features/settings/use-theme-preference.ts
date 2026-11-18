import { useState } from 'react';
import { normalizeThemeColor } from '@plotloom/ui/theme';
import { readThemePreference, writeThemePreference } from './theme-preference.ts';

/** 首次渲染同步恢复主题；用户操作直接应用与保存，避免 effect 延迟换色。 */
export function useThemePreference() {
  const [preference, setPreference] = useState(readThemePreference);

  function setColor(input: string) {
    const color = normalizeThemeColor(input);
    if (!color) return;
    const saved = writeThemePreference(color);
    setPreference({ color, storageError: !saved });
  }

  return { ...preference, setColor };
}
