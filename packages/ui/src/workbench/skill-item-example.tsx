import { useState, type CSSProperties } from 'react';
import { BookOpen, Puzzle } from 'lucide-react';
import { SkillItem } from '../skill-item/skill-item.tsx';
import { Input } from '../form/input.tsx';
import { Switch } from '../form/switch.tsx';

/** 使用普通展示数据调试公开参数，不把技能页面或业务契约带入组件库。 */
export function SkillItemExample({ state, style }: { state: string; style: CSSProperties }) {
  const [name, setName] = useState('novel-writing');
  const [description, setDescription] = useState(state === 'long'
    ? '根据详细章节大纲、人物卡和写作要求创作小说，讨论设定冲突，修改指定选区并提交可逐处审阅的候选。'.repeat(4)
    : '根据章节大纲、人物卡和写作要求创作小说。');
  const [warning, setWarning] = useState(state === 'warning' ? '当前不可用：所需工具尚未就绪' : '');
  const [personal, setPersonal] = useState(false);
  const [clicks, setClicks] = useState(0);
  return <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', minWidth: 0 }}>
      <SkillItem name={name} description={description} warning={warning} style={style} status={`已点击 ${clicks} 次`} onClick={() => setClicks(value => value + 1)}
        icon={personal ? <Puzzle size={22} /> : <BookOpen size={22} />} />
    </ul>
    <Input aria-label="技能名称" value={name} onValueChange={setName} />
    <Input aria-label="技能描述" value={description} onValueChange={setDescription} />
    <Input aria-label="诊断文案" value={warning} onValueChange={setWarning} />
    <Switch label="使用个人技能图标" checked={personal} onCheckedChange={setPersonal} />
  </div>;
}
