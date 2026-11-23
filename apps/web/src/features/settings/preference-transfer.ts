import { DEFAULT_THEME_COLOR, normalizeThemeColor, normalizeThemeMode, THEME_MODE_KEY } from '@plotloom/ui/theme';
import { THEME_STORAGE_KEY } from './theme-preference.ts';

export const NOVEL_SHELF_SORT_KEY = 'plotloom:novel-shelf-sort';
const filename = 'Plotloom-preferences.json';
const shelfSorts = ['newest', 'oldest', 'title'];

/** 用白名单导出产品偏好，浏览器里的草稿、会话标识和其他数据留在原处。 */
export function exportPreferences() {
  const sort = localStorage.getItem(NOVEL_SHELF_SORT_KEY);
  const snapshot = {
    version: 1,
    themeMode: normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY)),
    themeColor: normalizeThemeColor(localStorage.getItem(THEME_STORAGE_KEY) ?? '') ?? DEFAULT_THEME_COLOR,
    shelfSort: sort && shelfSorts.includes(sort) ? sort : 'newest',
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 先验证完整文件，再更新已知偏好。刷新后由应用根统一读取主题和书架排序。 */
export async function importPreferences(file: File) {
  const invalid = '无法读取偏好文件，请选择 Plotloom 导出的 JSON 文件。';
  if (file.size > 4096) throw new Error(invalid);
  const snapshot = await file.text().then(text => {
    try { return JSON.parse(text); } catch { throw new Error(invalid); }
  });
  if (!(snapshot && snapshot.version === 1)) throw new Error(invalid);
  const { themeMode, themeColor, shelfSort } = snapshot;
  const color = typeof themeColor === 'string' ? normalizeThemeColor(themeColor) : null;
  if (normalizeThemeMode(themeMode) !== themeMode || !color || !shelfSorts.includes(shelfSort)) throw new Error(invalid);
  localStorage.setItem(THEME_MODE_KEY, themeMode);
  localStorage.setItem(THEME_STORAGE_KEY, color);
  localStorage.setItem(NOVEL_SHELF_SORT_KEY, shelfSort);
  window.location.reload();
}
