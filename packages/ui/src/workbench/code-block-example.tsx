import { useEffect, useState, type CSSProperties } from 'react';
import { CodeBlock } from '../code-block/code-block.tsx';
import { Button } from '../button/button.tsx';
import type { PreviewControls } from './controls.ts';

/** 调试台模拟增量，组件仅接收当前源码与生成状态；停止后保留已接收的片段。 */
export function CodeBlockExample({ controls, style, onAction }: { controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void }) {
  const { codeBlockContent: code, codeBlockLanguage: language, codeBlockStreaming: streaming } = controls;
  const [length, setLength] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { setLength(0); setStopped(false); }, [code, streaming, revision]);
  useEffect(() => {
    if (!streaming || stopped || length >= code.length) return;
    const timer = setTimeout(() => setLength(value => Math.min(value + 12, code.length)), 45);
    return () => clearTimeout(timer);
  }, [code, length, stopped, streaming]);
  const active = streaming && !stopped && length < code.length;
  return <>
    {streaming ? <div className="pl-example-scroll-actions">
      <Button size="sm" variant="secondary" onClick={() => { setRevision(value => value + 1); onAction('重新播放代码'); }}>重新播放</Button>
      <Button size="sm" variant="text" disabled={!active} onClick={() => { setStopped(true); onAction('停止，保留已有代码'); }}>停止</Button>
      <span role="status">{active ? '生成中' : stopped ? '已停止' : '已完成'}</span>
    </div> : null}
    <CodeBlock code={streaming ? code.slice(0, length) : code} language={language} streaming={active} style={style} />
  </>;
}
