import { useEffect, useState, type CSSProperties } from 'react';
import { MarkdownRenderer } from '../markdown/markdown-renderer.tsx';
import { Button } from '../button/button.tsx';
import type { PreviewControls } from './controls.ts';

/** 模拟内容追加；切换效果重新演示以便比较，停止保留当前片段。 */
export function MarkdownExample({ controls, style, onAction }: { controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void }) {
  const { markdownContent: content, markdownStreaming: streaming, markdownTextEffect: textEffect } = controls;
  const [length, setLength] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { setLength(0); setStopped(false); }, [content, streaming, revision, textEffect]);
  useEffect(() => {
    if (!streaming || stopped || length >= content.length) return;
    const timer = setTimeout(() => setLength(value => Math.min(value + 12, content.length)), 45);
    return () => clearTimeout(timer);
  }, [content, length, stopped, streaming]);
  const active = streaming && !stopped && length < content.length;
  return <>
    {streaming ? <div className="pl-example-scroll-actions">
      <Button size="sm" variant="secondary" onClick={() => { setRevision(value => value + 1); onAction('重新播放流式内容'); }}>重新播放</Button>
      <Button size="sm" variant="text" disabled={!active} onClick={() => { setStopped(true); onAction('停止，保留已有内容'); }}>停止</Button>
      <span role="status">{active ? '生成中' : stopped ? '已停止' : '已完成'}</span>
    </div> : null}
    <MarkdownRenderer content={streaming ? content.slice(0, length) : content} streaming={active} textEffect={textEffect} style={style} />
  </>;
}
