import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Globe, RotateCw, X } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Input } from '../form/input.tsx';
import { FrameState } from './frame-state.tsx';
import './workspace-frames.css';

export interface BrowserFrameProps {
  /** 宿主确认后的地址；输入草稿保留在本实例，确认地址改变时同步。 */
  url?: string;
  connected?: boolean;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  error?: string;
  onNavigate?: (address: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onReload?: () => void;
  onStop?: () => void;
  actions?: ReactNode;
  /** 替换默认导航栏；null 可省略工具栏。 */
  toolbar?: ReactNode;
  /** 网页或原生视图承载区域；框架不创建 iframe、不发起网络请求。 */
  children?: ReactNode;
  status?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 地址只提交用户意图；URL 解释与访问策略交给宿主，未连接时仅保留输入草稿。 */
function BrowserAddress({ url, connected, onNavigate }: Pick<BrowserFrameProps, 'connected' | 'onNavigate'> & { url: string }) {
  const [draft, setDraft] = useState(url);
  return <form className="pl-browser-frame__address" onSubmit={event => {
    event.preventDefault();
    if (connected && draft.trim()) onNavigate?.(draft.trim());
  }}>
    <Input size="sm" startIcon={<Globe size={15} />} value={draft} onValueChange={setDraft}
      aria-label="网页地址" placeholder="输入网址" autoComplete="off" spellCheck={false} inputMode="url" />
  </form>;
}

/** 浏览器页面框架：所有操作由回调驱动；状态变化不会重建传入的网页承载节点。 */
export function BrowserFrame({ url = '', connected = false, loading = false, canGoBack = false, canGoForward = false,
  error, onNavigate, onBack, onForward, onReload, onStop, actions, toolbar, children, status, className = '', style }: BrowserFrameProps) {
  const stateText = !connected ? '浏览器未连接' : loading ? '正在载入…' : error || (url ? '就绪' : '等待访问网页');
  return <section className={`pl-content-frame pl-browser-frame ${className}`} aria-label="浏览器框架" style={style}>
    {toolbar !== null ? <header className="pl-content-frame__toolbar pl-browser-frame__toolbar">
      {toolbar === undefined ? <>
        <div className="pl-browser-frame__navigation">
          <Button size="sm" variant="ghost" iconOnly aria-label="后退" title="后退" disabled={!connected || !canGoBack || !onBack} onClick={onBack}><ArrowLeft /></Button>
          <Button size="sm" variant="ghost" iconOnly aria-label="前进" title="前进" disabled={!connected || !canGoForward || !onForward} onClick={onForward}><ArrowRight /></Button>
          <Button size="sm" variant="ghost" iconOnly aria-label={loading ? '停止载入' : '刷新网页'} title={loading ? '停止载入' : '刷新网页'}
            disabled={!connected || !(loading ? onStop : onReload)} onClick={loading ? onStop : onReload}>{loading ? <X /> : <RotateCw />}</Button>
        </div>
        <BrowserAddress key={url} url={url} connected={connected} onNavigate={onNavigate} />
        {actions ? <div className="pl-content-frame__actions">{actions}</div> : null}
      </> : toolbar}
    </header> : null}
    <div className="pl-content-frame__body pl-browser-frame__viewport" aria-label="网页承载区域" aria-busy={loading}>
      {children !== undefined ? children : <FrameState icon={<Globe />} title={!connected ? '浏览器尚未连接' : error ? '无法访问此页面' : '准备浏览网页'}>
        {!connected ? '连接浏览器后，可在这里浏览网页，与 Agent 操作同一页面。' : error || '在上方输入网址，按回车访问。'}
      </FrameState>}
    </div>
    <footer className="pl-content-frame__statusbar"><span role="status" title={stateText}>{status ?? stateText}</span></footer>
  </section>;
}
