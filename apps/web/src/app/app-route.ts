import { useEffect, useState } from 'react';
import { settingsCategories, type SettingsCategory } from '../features/settings/settings-page';
import type { AppPage } from '../features/navigation/app-sidebar';

interface AppRoute {
  page: Exclude<AppPage, 'settings'>;
  sessionId: string | null;
  projectPath: string;
  settings: SettingsCategory | null;
}

/** 沿用已有 #chat= 链接。设置保留底层页面信息，直接打开或刷新也能返回。 */
function readRoute(): AppRoute {
  const params = new URLSearchParams(location.hash.slice(1));
  const page = params.get('page');
  const section = params.get('settings');
  return {
    page: page === 'skills' || page === 'novels' ? page : 'chat',
    sessionId: params.get('chat') || null,
    projectPath: params.get('project') ?? '',
    settings: section === null ? null : Object.hasOwn(settingsCategories, section) ? section as SettingsCategory : 'appearance',
  };
}

/** 浏览器前进、后退及同页链接都从地址恢复，组件只提交导航意图。 */
export function useAppRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function updateRoute(change: Partial<AppRoute>, mode: 'push' | 'replace' | 'open-settings' = 'push') {
    // 异步操作结束后合并实际地址，避免用请求发起时的快照覆盖用户导航。
    const next = { ...readRoute(), ...change };
    const params = new URLSearchParams();
    if (next.page !== 'chat') params.set('page', next.page);
    if (next.sessionId) params.set('chat', next.sessionId);
    else if (next.projectPath) params.set('project', next.projectPath);
    if (next.settings) params.set('settings', next.settings);
    const hash = params.size ? `#${params}` : '';
    if (hash === location.hash) return;
    const url = location.pathname + location.search + hash;
    if (mode === 'replace') history.replaceState(next.settings ? history.state : null, '', url);
    else history.pushState(mode === 'open-settings' ? { returnFromSettings: true } : null, '', url);
    setRoute(readRoute());
  }

  function closeSettings() {
    if (history.state?.returnFromSettings) history.back();
    else updateRoute({ settings: null }, 'replace');
  }

  function clearSession(id: string, projectPath: string) {
    if (readRoute().sessionId === id) updateRoute({ sessionId: null, projectPath }, 'replace');
  }

  return { route, updateRoute, closeSettings, clearSession };
}
