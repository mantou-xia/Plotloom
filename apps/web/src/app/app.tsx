import { GlobalLayout } from '@plotloom/ui/layouts/global-layout';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { ThemeRoot } from '@plotloom/ui/theme-root';
import { Button } from '@plotloom/ui/button';
import { ColorSwatches } from '@plotloom/ui/color-swatches';
import { THEME_PRESETS } from '@plotloom/ui/theme';
import { useState } from 'react';
import { useThemePreference } from '../features/settings/use-theme-preference';
import './app.css';

/** 品牌、页面导航和保存反馈属于应用；布局、按钮及选色能力来自通用组件库。 */
export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useThemePreference();
  return (
    <ThemeRoot color={theme.color}>
      <GlobalLayout sidebar={<nav className="plotloom-app-navigation" aria-label="应用导航">
        <span className="plotloom-app-brand">Plotloom</span>
        <Button variant={settingsOpen ? 'subtle' : 'ghost'} aria-current={settingsOpen ? 'page' : undefined} onClick={() => setSettingsOpen(true)}>设置</Button>
      </nav>}>
        <PageLayout padding={24} style={{ height: '100%' }}>
          {settingsOpen ? <ColorSwatches color={theme.color} onChange={theme.setColor} presets={THEME_PRESETS} label="主题色"
            feedback={theme.storageError ? <p className="plotloom-theme-save-error" role="status">颜色已应用，但未能保存，刷新后可能恢复默认。</p> : null} /> : null}
        </PageLayout>
      </GlobalLayout>
    </ThemeRoot>
  );
}
