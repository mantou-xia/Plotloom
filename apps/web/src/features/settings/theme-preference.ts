import { DEFAULT_THEME_COLOR, normalizeThemeColor } from '@plotloom/ui/theme';

export const THEME_STORAGE_KEY = 'plotloom.theme-color';
export interface ThemePreference { color: string; storageError: boolean }

/** 颜色属于浏览器外观偏好；损坏的旧值回退默认，不把未经校验的数据传入样式。 */
export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return { color: stored ? normalizeThemeColor(stored) ?? DEFAULT_THEME_COLOR : DEFAULT_THEME_COLOR, storageError: false };
  } catch {
    return { color: DEFAULT_THEME_COLOR, storageError: true };
  }
}

/** 保存失败仍允许当前窗口换色，由界面明确告知没有持久保存。 */
export function writeThemePreference(color: string): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, color);
    return true;
  } catch {
    return false;
  }
}
