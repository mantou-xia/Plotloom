import { useEffect, useRef } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Box, Palette, Plug, Puzzle, Trash2 } from 'lucide-react';
import { ProviderConfiguration, DefaultModelConfiguration, GlobalSkills } from './configuration';
import { ColorSwatches } from '@plotloom/ui/color-swatches';
import { Sidebar } from '@plotloom/ui/sidebar';
import { SidebarNavItem } from '@plotloom/ui/sidebar/nav-item';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { THEME_PRESETS } from '@plotloom/ui/theme';
import './settings-page.css';

import type { ChatSummary } from '@plotloom/contracts/skills';
import { Button } from '@plotloom/ui/button';

const archiveTime = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

interface SettingsPageProps {
  archived: ChatSummary[];
  archiveStatus: 'loading' | 'ready' | 'error';
  onRestore: (chat: ChatSummary) => void;
  onDelete: (chat: ChatSummary) => void;
  section: SettingsCategory;
  onModelsChange: () => void;
  onSkillsChange: () => void;
  color: string;
  onColorChange: (color: string) => void;
}

/** 进入设置时将焦点交给返回按钮，侧栏宽度和拖拽把手由应用外层布局管理。 */
export const settingsCategories = { appearance: '外观', providers: '模型服务', defaults: '默认模型', skills: '技能', archive: '归档' } as const;
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
        {(['providers', 'defaults', 'skills', 'appearance', 'archive'] as const).map(id => <SidebarNavItem key={id} label={settingsCategories[id]}
          icon={{ appearance: <Palette />, providers: <Plug />, defaults: <Box />, skills: <Puzzle />, archive: <Archive /> }[id]} active={section === id} onClick={() => onSelect(id)} />)}
      </>} />;
}

/** 设置正文嵌入共享主内容区，主题保存由应用管理。 */
export function SettingsPage({ color, onColorChange, section, onModelsChange, onSkillsChange, archived, archiveStatus, onRestore, onDelete }: SettingsPageProps) {
  if (section === 'providers') return <ProviderConfiguration onChange={onModelsChange} />;
  return <div className="plotloom-settings-content">
      <h2 className="plotloom-settings-content__title">{settingsCategories[section]}</h2>
      {section === 'archive' && !archived.length ? (
        <div className="plotloom-archive-empty" role="status">
          <span className="plotloom-archive-empty__icon"><Archive size={24} aria-hidden="true" /></span>
          <h3>{archiveStatus === 'ready' ? '暂无归档对话' : archiveStatus === 'loading' ? '正在加载…' : '聊天列表加载失败'}</h3>
          {archiveStatus === 'ready' && <p>从侧边栏归档对话后，可以在这里恢复或永久删除。</p>}
        </div>
      ) : section === 'archive' ? <SettingsSection title="已归档的对话">
        {archived.map(chat => <SettingsRow key={chat.id} className="plotloom-archive-row" title={<span title={chat.name}>{chat.name}</span>}
          description={chat.archivedAt && <time dateTime={chat.archivedAt}>归档于 {archiveTime.format(new Date(chat.archivedAt))}</time>}>
          <Button variant="ghost" size="sm" iconOnly tooltip aria-label="恢复" onClick={() => onRestore(chat)}><ArchiveRestore size={16} /></Button>
          <Button variant="ghost" size="sm" iconOnly tooltip aria-label="永久删除" onClick={() => onDelete(chat)}><Trash2 size={16} /></Button>
        </SettingsRow>)}
      </SettingsSection> : section === 'defaults' ? <DefaultModelConfiguration onChange={onModelsChange} /> : section === 'skills' ? <GlobalSkills onChange={onSkillsChange} /> : <SettingsSection title="主题">
        <SettingsRow title="主题色" description="选择偏好的颜色，应用于整个界面。">
          <ColorSwatches color={color} onChange={onColorChange} presets={THEME_PRESETS} label="主题色" />
        </SettingsRow>
      </SettingsSection>}
    </div>;
}
