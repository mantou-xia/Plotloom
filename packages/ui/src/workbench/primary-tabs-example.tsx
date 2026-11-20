import { useState, type CSSProperties } from 'react';
import { PrimaryTabs, PrimaryTabPanel } from '../primary-tabs/primary-tabs.tsx';
import { Input } from '../form/input.tsx';
import { Switch } from '../form/switch.tsx';

/** 独立调试选中值、选项文字和禁用行为，不依赖产品页面。 */
export function PrimaryTabsExample({ state, style, onAction }: { state: string; style: CSSProperties; onAction: (value: string) => void }) {
  const [value, setValue] = useState('all');
  const [label, setLabel] = useState('全部');
  const [disabled, setDisabled] = useState(state === 'disabled');
  return <div style={{ display: 'grid', gap: 20 }}>
    <PrimaryTabs label="内容导航" style={style} value={value} disabled={disabled}
      options={[{ value: 'all', label }, { value: 'recent', label: '最近' }, { value: 'archived', label: '归档', disabled: state === 'option-disabled' }]}
      onValueChange={next => { setValue(next); onAction(`onValueChange(${next})`); }}>
      <PrimaryTabPanel value="all">全部内容</PrimaryTabPanel>
      <PrimaryTabPanel value="recent">最近内容</PrimaryTabPanel>
      <PrimaryTabPanel value="archived">归档内容</PrimaryTabPanel>
    </PrimaryTabs>
    <Input aria-label="首项文字" value={label} onValueChange={setLabel} />
    <Switch label="禁用一级 Tab" checked={disabled} onCheckedChange={setDisabled} />
    <output aria-live="polite">当前值：{value}</output>
  </div>;
}
