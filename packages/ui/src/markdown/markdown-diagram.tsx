import { useEffect, useId, useRef, useState } from 'react';
import { parseChartOptions } from './chart-options.ts';
import { useColorScheme } from '../theme/theme-root.tsx';

/** 图表在完整围栏后渲染；销毁观察器与实例，避免流式切换、改稿或卸载后残留资源。 */
export function MarkdownDiagram({ code, language }: { code: string; language: 'mermaid' | 'echarts' }) {
  const host = useRef<HTMLDivElement>(null);
  const scheme = useColorScheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    async function render() {
      if (language === 'mermaid') {
        const { createMermaidPlugin } = await import('@streamdown/mermaid');
        if (!active) return;
        const mermaid = createMermaidPlugin({ config: { securityLevel: 'strict', theme: scheme === 'dark' ? 'dark' : 'neutral', fontFamily: 'system-ui',
          flowchart: { htmlLabels: false }, suppressErrorRendering: true } }).getMermaid();
        const { svg } = await mermaid.render(`pl-md-${id}`, code);
        // SVG 仅来自 strict 模式 Mermaid，不接受模型直接提供的 HTML/SVG。
        if (active && host.current) host.current.innerHTML = svg;
      } else {
        const option = parseChartOptions(code);
        const { init } = await import('./echarts-runtime.ts');
        if (!active || !host.current) return;
        const chart = init(host.current, scheme === 'dark' ? 'dark' : undefined, { renderer: 'svg' });
        const observer = new ResizeObserver(() => chart.resize());
        dispose = () => { observer.disconnect(); chart.dispose(); };
        chart.setOption({ ...option, backgroundColor: 'transparent' });
        observer.observe(host.current);
      }
      if (active) setReady(true);
    }
    void render().catch(cause => {
      dispose?.(); dispose = undefined;
      if (active) setError(cause instanceof Error ? cause.message : '无法渲染图表。');
    });
    return () => { active = false; dispose?.(); };
  }, [code, language, id, scheme]);
  return <div className="pl-md-diagram">
    {error ? <><p role="alert">图表暂时无法展示：{error}</p><pre tabIndex={0}><code>{code}</code></pre></>
      : <>{!ready ? <p role="status">正在绘制图表…</p> : null}<div ref={host} className={`pl-md-diagram__canvas pl-md-diagram__canvas--${language}`} role="img" aria-label={language === 'mermaid' ? 'Mermaid 图示' : '数据图表'} /></>}
  </div>;
}
