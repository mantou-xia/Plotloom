import { useEffect, useRef, useState } from 'react';
import { ComponentPreview, ComponentWorkbench, defaultControls, type PreviewControls } from '@plotloom/ui/workbench';
import { componentCatalog } from '@plotloom/ui/workbench/catalog';
import { ThemeRoot } from '@plotloom/ui/theme-root';
import { DEFAULT_THEME_COLOR, normalizeThemeColor } from '@plotloom/ui/theme';

interface PreviewConfig { component: string; state: string; color: string; revision: number; controls: PreviewControls }
const initial = componentCatalog[0];
const initialConfig: PreviewConfig = { component: initial.id, state: initial.states[0].id, color: DEFAULT_THEME_COLOR, revision: 0, controls: defaultControls(initial.id, initial.states[0].id) };

/** 宿主只管理调试状态；消息限定同源及当前 iframe，配色更新不重新加载预览。 */
export function WorkbenchApp() {
  const [config, setConfig] = useState(initialConfig);
  const [size, setSize] = useState({ width: initial.width, height: initial.height });
  const [lastAction, setLastAction] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const example = componentCatalog.find((item) => item.id === config.component)!;

  useEffect(() => {
    const send = () => frameRef.current?.contentWindow?.postMessage({ type: 'plotloom:config', config }, location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === 'plotloom:ready') send();
      if (event.data?.type === 'plotloom:color') {
        const color = typeof event.data.color === 'string' ? normalizeThemeColor(event.data.color) : null;
        if (color) { setConfig((current) => ({ ...current, color })); setLastAction(`onColorChange(${color})`); }
      }
      if (event.data?.type === 'plotloom:action' && typeof event.data.action === 'string') setLastAction(event.data.action);
    };
    window.addEventListener('message', receive);
    send();
    return () => window.removeEventListener('message', receive);
  }, [config]);

  return <ThemeRoot color={config.color}><ComponentWorkbench
    example={example} state={config.state} color={config.color} controls={config.controls} {...size} lastAction={lastAction} frameRef={frameRef}
    onControlsChange={(patch) => setConfig((current) => ({ ...current, controls: { ...current.controls, ...patch } }))}
    onSelect={(id) => {
      const selected = componentCatalog.find((item) => item.id === id)!;
      setConfig((current) => ({ ...current, component: id, state: selected.states[0].id, controls: defaultControls(id, selected.states[0].id), revision: current.revision + 1 }));
      setSize({ width: selected.width, height: selected.height }); setLastAction('');
    }}
    onStateChange={(state) => { setConfig((current) => ({ ...current, state, controls: defaultControls(current.component, state) })); setLastAction(''); }}
    onSizeChange={(width, height) => setSize({ width: Math.max(240, Math.min(2400, Math.round(width))), height: Math.max(160, Math.min(1600, Math.round(height))) })}
    onColorChange={(color) => setConfig((current) => ({ ...current, color }))}
    onReset={() => { setConfig((current) => ({ ...current, state: example.states[0].id, controls: defaultControls(current.component, example.states[0].id), color: DEFAULT_THEME_COLOR, revision: current.revision + 1 })); setSize({ width: example.width, height: example.height }); setLastAction(''); }}
  /></ThemeRoot>;
}

/** 子窗口接收受控配置；组件状态变化才重挂载，尺寸和主题变化保留真实交互状态。 */
export function PreviewApp() {
  const [config, setConfig] = useState(initialConfig);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'plotloom:config') return;
      const next = event.data.config as PreviewConfig;
      const entry = componentCatalog.find((item) => item.id === next?.component);
      if (entry?.states.some((item) => item.id === next.state) && typeof next.color === 'string' && normalizeThemeColor(next.color)) setConfig(next);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'plotloom:ready' }, location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <ThemeRoot color={config.color}><ComponentPreview
    key={`${config.component}:${config.state}:${config.revision}`} component={config.component} state={config.state} color={config.color} controls={config.controls}
    onColorChange={(color) => { setConfig((current) => ({ ...current, color })); window.parent.postMessage({ type: 'plotloom:color', color }, location.origin); }}
    onAction={(action) => window.parent.postMessage({ type: 'plotloom:action', action }, location.origin)}
  /></ThemeRoot>;
}
