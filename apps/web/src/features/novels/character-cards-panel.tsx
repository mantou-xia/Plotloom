import { useEffect, useMemo, useState } from 'react';
import type { CharacterCardListResponse, CharacterCardStage } from '@plotloom/contracts/character-cards';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { Textarea } from '@plotloom/ui/textarea';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';

const template = `## 性格特点\n\n### 表征\n\n### 内在\n\n### 描写\n\n## 愿景\n\n### 明示\n\n### 潜意识\n\n### 描写\n\n## 社会背景\n\n## 外表特点\n\n## 特殊性\n\n### 心理特质\n\n### 口癖\n\n### 禁忌\n\n### 其他\n`;

export function CharacterCardsPanel({ base, onClose }: { base: string; onClose: () => void }) {
  const [data, setData] = useState<CharacterCardListResponse>({ cards: [], applicable: [] });
  const [selected, setSelected] = useState<CharacterCardStage>();
  const [creating, setCreating] = useState(false);
  const [character, setCharacter] = useState('');
  const [chapter, setChapter] = useState('1');
  const [note, setNote] = useState('');
  const [content, setContent] = useState(template);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<CharacterCardListResponse>(base + '/character-cards', 'GET', undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(cause => { if (!controller.signal.aborted) notifyRequestError(cause, 'character-cards'); });
    return () => controller.abort();
  }, [base, reload]);
  const groups = useMemo(() => [...new Set(data.cards.map(card => card.character))], [data.cards]);
  async function save() {
    const result = await runWithToast(() => requestJson<CharacterCardStage>(base + '/character-cards', 'POST', { character: character.trim(), chapter: Number(chapter), note: note.trim(), content }), { loading: '正在保存角色卡阶段…', success: '角色卡阶段已保存' });
    if (!result.ok) return;
    setCreating(false); setCharacter(''); setNote(''); setContent(template); setSelected(result.value); setReload(value => value + 1);
  }
  return <Dialog open title={creating ? '新建角色卡阶段' : '五栏角色卡'} onOpenChange={open => { if (!open) onClose(); }}
    footer={creating ? <><Button variant="ghost" onClick={() => setCreating(false)}>取消</Button><Button disabled={!character.trim() || !/^\d+$/.test(chapter) || !content.trim()} onClick={() => void save()}>保存阶段</Button></> : undefined}>
    {creating ? <div className="plotloom-novel-fields"><label>角色名称<Input value={character} onValueChange={setCharacter} /></label><label>适用章节<Input value={chapter} onValueChange={setChapter} /></label><label>阶段备注<Input value={note} onValueChange={setNote} placeholder="例如 黑化、失去双亲、获得神力" /></label><label>五栏内容<Textarea rows={14} value={content} onValueChange={setContent} /></label></div> : <div className="plotloom-character-cards">
      <div className="plotloom-novel-actions"><strong>角色</strong><Button size="sm" onClick={() => setCreating(true)}>新建阶段</Button></div>
      {groups.length ? <ul className="plotloom-character-card-list">{groups.map(name => <li key={name}><h3>{name}</h3>{data.cards.filter(card => card.character === name).map(card => <Button key={card.path} size="sm" variant="ghost" aria-current={selected?.path === card.path ? 'true' : undefined} onClick={() => setSelected(card)}>第 {card.chapter} 章起 · {card.note || '阶段卡'}</Button>)}</li>)}</ul> : <p className="plotloom-novel-muted">暂无角色卡，先从作者的一句人物简介开始建卡。</p>}
      {selected ? <article className="plotloom-character-card-detail"><h3>{selected.character} · 第 {selected.chapter} 章起</h3><p>{selected.note || '无阶段备注'} · {selected.version?.slice(0, 8)}</p><pre className="plotloom-novel-preview">{selected.content}</pre></article> : null}
    </div>}
  </Dialog>;
}
