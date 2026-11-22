import { useId, useState, type CSSProperties } from 'react';
import { CircleStop, MessageCircleQuestionMark, Pencil } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Input } from '../form/input.tsx';
import './question-card.css';

export type QuestionReply = { kind: 'option'; index: number } | { kind: 'custom'; text: string } | { kind: 'skip' };

export interface QuestionCardProps {
  question: string;
  options: readonly string[];
  onAnswer: (reply: QuestionReply) => void;
  onStop?: () => void;
  submitting?: boolean;
  stopping?: boolean;
  style?: CSSProperties;
}

/** 单选和自填共享一次提交。切换回答方式时清除另一种输入，避免提交与当前界面不符的答案。 */
export function QuestionCard({ question, options, onAnswer, onStop, submitting, stopping, style }: QuestionCardProps) {
  const id = useId();
  const [selected, setSelected] = useState<number>();
  const [text, setText] = useState('');
  const value = text.trim();
  const disabled = submitting || stopping;
  return <form className="pl-question-card" aria-labelledby={id} style={style} onSubmit={event => {
    event.preventDefault();
    if (disabled) return;
    if (selected !== undefined) onAnswer({ kind: 'option', index: selected + 1 });
    else if (value) onAnswer({ kind: 'custom', text: value });
  }}>
    <h3 className="pl-question-card__body" id={id} tabIndex={0}><MessageCircleQuestionMark size={16} aria-hidden="true" />{question}</h3>
    <fieldset disabled={disabled} aria-labelledby={id}>
      {options.map((option, index) => <label className="pl-question-card__option" key={index}>
        <input type="radio" name={id} checked={selected === index} onChange={() => { setSelected(index); setText(''); }} />
        <span className="pl-question-card__number" aria-hidden="true">{index + 1}</span>
        <span>{option}</span>
      </label>)}
    </fieldset>
    <footer className="pl-question-card__footer">
      <Input className="pl-question-card__input" size="sm" aria-label="自填回答" placeholder="或自行撰写回复"
        startIcon={<Pencil size={14} />} value={text} maxLength={2000} disabled={disabled} onValueChange={next => {
          setText(next);
          setSelected(undefined);
        }} />
      {onStop ? <Button size="sm" variant="ghost" iconOnly aria-label="停止任务" tooltip loading={stopping}
        disabled={submitting} onClick={onStop}><CircleStop size={16} /></Button> : null}
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAnswer({ kind: 'skip' })}>跳过</Button>
      <Button size="sm" type="submit" loading={submitting} disabled={stopping || (selected === undefined && !value)}>发送</Button>
    </footer>
  </form>;
}
