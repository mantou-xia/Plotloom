import { useEffect, useState, type CSSProperties } from 'react';
import type { CodeHighlighterPlugin, HighlightResult } from 'streamdown';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';

/** 按需高亮；异步加载失败显示原文，快速追加或切换语言时忽略过期结果。 */
export function HighlightedCode({ code, language, incomplete }: { code: string; language: string; incomplete: boolean }) {
  const [result, setResult] = useState<{ source: string; language: string; value: HighlightResult } | null>(null);
  useEffect(() => {
    let active = true;
    void import('@streamdown/code').then(({ code: plugin }) => {
      const highlighter: CodeHighlighterPlugin = plugin;
      const commit = (value: HighlightResult) => { if (active) setResult({ source: code, language, value }); };
      const value = highlighter.highlight({ code, language: highlighter.supportsLanguage(language) ? language : 'text',
        themes: ['github-light', 'github-light'], isIncomplete: incomplete }, commit);
      if (value) commit(value);
    }).catch(() => { /* 依赖加载失败也不丢失原文，不影响复制。 */ });
    return () => { active = false; };
  }, [code, language, incomplete]);
  // 统一滚动盒承接双向滚动与键盘焦点，pre 只负责保留原始空白，避免双重滚动条。
  return <ScrollBox orientation="both" className="pl-code-block__scroll" role="region" aria-label={`${language === 'text' ? '纯文本' : language}代码`}>
    <pre className="pl-code-block__pre"><code>{result?.source === code && result.language === language
      ? result.value.tokens.map((line, index) => <span className="pl-code-block__line" key={index}>{line.map((token, tokenIndex) =>
        <span key={tokenIndex} style={{ color: token.color ?? token.htmlStyle?.color,
          fontStyle: token.htmlStyle?.['font-style'] as CSSProperties['fontStyle'],
          fontWeight: token.htmlStyle?.['font-weight'] as CSSProperties['fontWeight'] }}>{token.content}</span>)}{index < result.value.tokens.length - 1 ? '\n' : ''}</span>)
      : code}</code></pre>
  </ScrollBox>;
}
