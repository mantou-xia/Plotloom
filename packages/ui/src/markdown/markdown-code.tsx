import { lazy, Suspense, useState, type ComponentProps } from 'react';
import { useIsCodeFenceIncomplete, type ExtraProps } from 'streamdown';
import { Button } from '../button/button.tsx';
import { CodeBlock } from '../code-block/code-block.tsx';
import { CodeBlockFrame } from '../code-block/frame.tsx';
import { HighlightedCode } from '../code-block/highlighted-code.tsx';

const Diagram = lazy(() => import('./markdown-diagram.tsx').then(module => ({ default: module.MarkdownDiagram })));

/** 代码和图表共用源码工具栏；只注册 mermaid/echarts，未知语法保持可复制代码。 */
export function MarkdownCode({ children, className }: ComponentProps<'code'> & ExtraProps) {
  const incomplete = useIsCodeFenceIncomplete();
  const language = /language-([^\s]+)/.exec(className || '')?.[1]?.toLowerCase() || 'text';
  const code = String(children ?? '').replace(/\n$/, '');
  const diagram = language === 'mermaid' || language === 'echarts';
  const [source, setSource] = useState(false);
  if (!diagram) return <CodeBlock code={code} language={language} streaming={incomplete} className="pl-md-block" />;
  return <CodeBlockFrame code={code} language={language} streaming={incomplete} className="pl-md-block"
    actions={<Button variant="text" size="sm" onClick={() => setSource(value => !value)} aria-pressed={source}>{source ? '查看图表' : '查看源码'}</Button>}>
    {!source ? incomplete ? <p className="pl-md-notice" role="status">正在接收图表…</p>
      : <Suspense fallback={<p className="pl-md-notice" role="status">正在加载图表…</p>}><Diagram key={`${language}:${code}`} code={code} language={language} /></Suspense>
      : <HighlightedCode code={code} language={language} incomplete={incomplete} />}
  </CodeBlockFrame>;
}
