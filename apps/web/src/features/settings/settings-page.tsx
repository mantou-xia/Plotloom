import { useEffect, useRef } from 'react';
import { Archive, ArrowLeft, Box, HardDrive, Palette, Plug, Puzzle, Smartphone, Sparkles, Wrench } from 'lucide-react';
import { ProviderConfiguration, DefaultModelConfiguration, GlobalSkills } from './configuration';
import { ToolsSettings } from './tools-settings';
import { AgentProfileSettings } from './agent-profile';
import { StorageSettings } from './storage-settings';
import { MobileAccessSettings } from './mobile-access';
import { ColorSwatches } from '@plotloom/ui/color-swatches';
import { Sidebar } from '@plotloom/ui/sidebar';
import { SidebarNavItem } from '@plotloom/ui/sidebar/nav-item';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { THEME_MODES, THEME_PRESETS, normalizeThemeMode, type ThemeMode } from '@plotloom/ui/theme';
import { RadioGroup } from '@plotloom/ui/radio-group';
import './settings-page.css';

import { ArchiveList, type ArchiveListProps } from './archive-list';

interface SettingsPageProps extends ArchiveListProps {
  archiveStatus: 'loading' | 'ready' | 'error';
  section: SettingsCategory;
  onModelsChange: () => void;
  onSkillsChange: (deletedId?: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

const appearanceOptions = Object.entries(THEME_MODES).map(([value, label]) => ({ value, label }));

/** 进入设置时将焦点交给返回按钮，侧栏宽度和拖拽把手由应用外层布局管理。 */
export const settingsCategories = { appearance: '外观', providers: '模型服务', defaults: '默认模型', persona: 'Agent 人设', mobile: '手机接入', skills: '技能', tools: '工具', storage: '存储', archive: '归档' } as const;
export type SettingsCategory = keyof typeof settingsCategories;
export function SettingsSidebar({ onBack, section, onSelect }: { onBack: () => void; section: SettingsCategory; onSelect: (section: SettingsCategory) => void }) {
  const back = useRef<HTMLDivElement>(null);
  // 进入新页面后提供明确的键盘起点，不把焦点留在已隐藏的主导航中。
  useEffect(() => { back.current?.querySelector('button')?.focus({ preventScroll: true }); }, []);
  return <Sidebar style={{ height: '100%' }} label="设置导航"
      header={<div className="plotloom-settings-sidebar__header" ref={back}>
        <SidebarNavItem label="返回" icon={<ArrowLeft />} onClick={onBack} />
        <h1>设置</h1>
      </div>}
      navItems={<>
        <p className="plotloom-settings-sidebar__group">偏好设置</p>
        {(['providers', 'defaults', 'persona', 'mobile', 'skills', 'tools', 'appearance', 'storage', 'archive'] as const)
          .map(id => <SidebarNavItem key={id} label={settingsCategories[id]}
            icon={{ appearance: <Palette />, providers: <Plug />, defaults: <Box />, persona: <Sparkles />, mobile: <Smartphone />, skills: <Puzzle />, tools: <Wrench />, storage: <HardDrive />, archive: <Archive /> }[id]} active={section === id} onClick={() => onSelect(id)} />)}
      </>} />;
}

/** 设置正文嵌入共享主内容区，主题保存由应用管理。 */
export function SettingsPage({ color, onColorChange, mode, onModeChange, section, onModelsChange, onSkillsChange, archived, archiveStatus, ...archiveActions }: SettingsPageProps) {
  if (section === 'providers') return <ProviderConfiguration onChange={onModelsChange} />;
  if (section === 'mobile') return <div className="plotloom-settings-content">
    <h2 className="plotloom-settings-content__title">手机接入</h2>
    <MobileAccessSettings />
  </div>;
  if (section === 'storage') {
    const storage = window.plotloomDesktop?.storage;
    return <div className="plotloom-settings-content">
      <h2 className="plotloom-settings-content__title">存储</h2>
      <StorageSettings storage={storage} />
    </div>;
  }
  return <div className="plotloom-settings-content">
      <h2 className="plotloom-settings-content__title">{section === 'archive' ? '已归档的对话' : settingsCategories[section]}</h2>
      {section === 'archive' && !archived.length ? (
        <div className="plotloom-archive-empty" role="status">
          <span className="plotloom-archive-empty__icon"><Archive size={24} aria-hidden="true" /></span>
          <h3>{archiveStatus === 'ready' ? '暂无归档对话' : archiveStatus === 'loading' ? '正在加载…' : '聊天列表加载失败'}</h3>
          {archiveStatus === 'ready' && <p>从侧边栏归档对话后，可以在这里恢复或永久删除。</p>}
        </div>
      ) : section === 'archive' ? <ArchiveList archived={archived} {...archiveActions} /> : section === 'defaults' ? <DefaultModelConfiguration onChange={onModelsChange} /> : section === 'skills' ? <GlobalSkills onChange={onSkillsChange} /> : section === 'tools' ? <ToolsSettings /> : section === 'persona' ? <AgentProfileSettings /> : <SettingsSection title="主题">
        <SettingsRow title="颜色模式" description="使用浅色或深色，也可以随操作系统自动切换。">
          <RadioGroup aria-label="颜色模式" className="plotloom-appearance-modes" orientation="horizontal" size="sm" options={appearanceOptions}
            value={mode} onValueChange={value => onModeChange(normalizeThemeMode(value))} />
        </SettingsRow>
        <SettingsRow title="主题色" description="选择偏好的颜色，应用于整个界面。">
          <ColorSwatches color={color} onChange={onColorChange} presets={THEME_PRESETS} label="主题色" />
        </SettingsRow>
      </SettingsSection>}
    </div>;
}
