import { useState, type CSSProperties } from 'react';
import { Dialog } from '../dialog/dialog.tsx';
import { Button } from '../button/button.tsx';
import { Input } from '../form/input.tsx';

/** 仅展示标题、内容与底部插槽，不引入业务目录或项目协议。 */
export function DialogExample({ state, title, description, style, onAction }: {
  state: string; title: string; description: string; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [open, setOpen] = useState(state !== 'closed');
  const [value, setValue] = useState('');
  const change = (next: boolean) => { setOpen(next); onAction(`onOpenChange(${next})`); };
  return <>
    <Button onClick={() => change(true)}>打开弹窗</Button>
    <Dialog open={open} onOpenChange={change} title={title} description={description} style={style}
      footer={<><Button variant="ghost" onClick={() => change(false)}>取消</Button><Button onClick={() => { onAction(`onConfirm(${value})`); setOpen(false); }}>确认</Button></>}>
      <Input aria-label="示例内容" placeholder="输入内容检查焦点与取消操作" value={value} onValueChange={setValue} />
      {state === 'overflow' ? Array.from({ length: 20 }, (_, index) => <p key={index}>内容示例 {index + 1}</p>) : null}
    </Dialog>
  </>;
}
