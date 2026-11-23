import { useState, type CSSProperties } from 'react';
import { SettingsSection } from '../settings/settings-section.tsx';
import { SettingsRow } from '../settings/settings-row.tsx';
import { Button } from '../button/button.tsx';
import { Switch } from '../form/switch.tsx';
import { Select } from '../form/select.tsx';
import { ColorSwatches } from '../color-swatches/color-swatches.tsx';
import { THEME_PRESETS } from '../theme/theme.ts';
import type { PreviewControls } from './controls.ts';

/** 只演示结构与控件组合；本地状态可交互，但不连接业务接口或保存偏好。 */
export function SettingsExample({ component, state, controls, style, onAction }: {
  component: string; state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [choice, setChoice] = useState<string | null>('first');
  const [color, setColor] = useState<string>(THEME_PRESETS[0].color);
  const toggle = <Switch aria-label="示例开关" checked={enabled} onCheckedChange={value => { setEnabled(value); onAction(`onCheckedChange(${value})`); }} />;
  const swatches = <ColorSwatches color={color} onChange={value => { setColor(value); onAction(`onChange(${value})`); }} presets={THEME_PRESETS} label="示例颜色" />;
  const props = { title: controls.settingsTitle, description: controls.settingsDescription,
    style: { ...style, width: style.width ?? (state.startsWith('narrow') ? 280 : 720), maxWidth: style.maxWidth ?? '100%' } };
  if (component === 'settings-row' && (state === 'columns' || state === 'narrow-columns')) {
    return <SettingsRow {...props} layout="columns">
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '6px 12px', margin: 0, fontSize: 13 }}>
        <dt>可用范围</dt><dd style={{ margin: 0 }}>当前工作区</dd>
        <dt>启用条件</dt><dd style={{ margin: 0 }}>工作区已打开，且当前文档可读。</dd>
      </dl>
    </SettingsRow>;
  }
  if (component === 'settings-row') return <SettingsRow {...props}>{state === 'colors' ? swatches : toggle}</SettingsRow>;
  return <SettingsSection {...props} actions={<Button size="sm" variant="secondary" onClick={() => onAction('保存示例设置')}>保存设置</Button>}>
    <SettingsRow title="示例开关" description="检查切换前后行高与位置。">{toggle}</SettingsRow>
    <SettingsRow title="示例选项">
      <Select aria-label="示例选项" value={choice} searchable={false} clearable={false}
        options={[{ value: 'first', label: '选项一' }, { value: 'second', label: '选项二' }]}
        onValueChange={value => { setChoice(value); onAction(`onValueChange(${value})`); }} />
    </SettingsRow>
    <SettingsRow title="示例颜色" description="多控件区域在空间不足时自动换行。">{swatches}</SettingsRow>
  </SettingsSection>;
}
