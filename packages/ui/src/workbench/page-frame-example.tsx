import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MarkdownReaderFrame } from '../workspace-frames/markdown-reader-frame.tsx';
import { BrowserFrame } from '../workspace-frames/browser-frame.tsx';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import type { PreviewControls } from './controls.ts';

interface ExampleProps { state: string; style?: CSSProperties; controls: PreviewControls; onAction: (action: string) => void }

/** 本地样本文档演示公开参数和打开/重试回调，不调用产品文件接口。 */
export function ReaderFrameExample({ state, style, controls, onAction }: ExampleProps) {
  const [phase, setPhase] = useState(state);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const unavailable = phase === 'unopened' || phase === 'loading' || phase === 'error';
  const content = unavailable ? undefined : phase === 'empty' ? '' : phase === 'long'
    ? Array.from({ length: 8 }, () => controls.readerFrameContent).join('\n\n---\n\n') : controls.readerFrameContent;
  return <MarkdownReaderFrame style={style} fileName={controls.readerFrameName} filePath={controls.readerFramePath}
    content={content} loading={phase === 'loading'} error={phase === 'error' ? '示例文件暂时无法读取，请重试。' : undefined}
    onOpen={() => { setPhase('document'); onAction('onOpen：打开样本文档'); }}
    onRetry={() => {
      setPhase('loading'); onAction('onRetry'); clearTimeout(timer.current);
      timer.current = setTimeout(() => setPhase('document'), 500);
    }}
    toolbar={controls.frameCustomToolbar ? <><strong style={{ flex: 1 }}>自定义阅读工具栏</strong><Button size="sm" variant="text" onClick={() => onAction('自定义阅读操作')}>示例操作</Button></> : undefined} />;
}

/** 用本地受控历史演示宿主行为；正文明确标记示例，不访问任何外部网址。 */
export function BrowserFrameExample({ state, style, controls, onAction }: ExampleProps) {
  const [history, setHistory] = useState(state === 'empty' || state === 'disconnected' ? [''] : ['https://example.test/', controls.browserFrameUrl]);
  const [index, setIndex] = useState(history.length - 1);
  const [loading, setLoading] = useState(state === 'loading');
  const [failed, setFailed] = useState(state === 'error');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const url = history[index];
  const connected = state !== 'disconnected';
  function navigate(address: string) {
    const next = address.includes('://') ? address : `https://${address}`;
    clearTimeout(timer.current); setLoading(true); setFailed(false); onAction(`onNavigate(${address})`);
    timer.current = setTimeout(() => {
      setHistory(current => [...current.slice(0, index + 1), next]); setIndex(index + 1); setLoading(false);
    }, 500);
  }
  return <BrowserFrame style={style} url={url} connected={connected} loading={loading}
    canGoBack={index > 0} canGoForward={index < history.length - 1}
    error={failed ? '示例页面响应超时。可以刷新重试。' : undefined} onNavigate={navigate}
    onBack={() => { clearTimeout(timer.current); setLoading(false); setFailed(false); setIndex(value => value - 1); onAction('onBack'); }}
    onForward={() => { clearTimeout(timer.current); setLoading(false); setFailed(false); setIndex(value => value + 1); onAction('onForward'); }}
    onReload={() => {
      clearTimeout(timer.current); setLoading(true); onAction('onReload');
      timer.current = setTimeout(() => { setLoading(false); setFailed(false); }, 500);
    }}
    onStop={() => { clearTimeout(timer.current); setLoading(false); onAction('onStop'); }}
    toolbar={controls.frameCustomToolbar ? <><strong style={{ flex: 1 }}>自定义浏览器工具栏</strong><Button size="sm" variant="text" onClick={() => onAction('自定义浏览器操作')}>示例操作</Button></> : undefined}>
    {connected && url && !failed ? <ScrollBox aria-label="示例网页内容" style={{ height: '100%' }}>
      <div style={{ padding: '40px 32px', maxWidth: 700, margin: '0 auto' }}>
        <span style={{ fontSize: 12, color: 'var(--pl-text-muted)' }}>组件交互示例 · 不访问网络</span>
        <h2 style={{ fontSize: 26, fontWeight: 550, marginTop: 18 }}>网页内容承载区域</h2>
        <p style={{ overflowWrap: 'anywhere', color: 'var(--pl-text-muted)' }}>{url}</p>
        <p>框架提供导航栏与状态，网页内容由调用方提供。此处使用本地内容演示前进、后退、刷新和停止。</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('https://example.test/details')}>打开第二个示例页面</Button>
      </div>
    </ScrollBox> : undefined}
  </BrowserFrame>;
}
