import { createContext, memo, useContext, useMemo, useState, type CSSProperties, type ComponentProps, type ReactNode } from 'react';
import { Streamdown, defaultRehypePlugins, type AnimateOptions, type Components, type ExtraProps } from 'streamdown';
import { cjk } from '@streamdown/cjk';
import { createMathPlugin } from '@streamdown/math';
import { MarkdownCode } from './markdown-code.tsx';
import 'katex/dist/katex.min.css';
import './markdown.css';

export type TextEmergenceEffect = 'ink' | 'mist' | 'light';
type LinkRenderer = (href: string, children: ReactNode) => ReactNode;
const RenderLink = createContext<LinkRenderer | undefined>(undefined);

export interface MarkdownRendererProps {
  content: string;
  /** 接收增量期间设为 true；完成或停止后设为 false；图表解析失败时展示源码。 */
  streaming?: boolean;
  /** 流式正文的逐字渐现效果，默认水墨晕开；静态内容直接显示。 */
  textEffect?: TextEmergenceEffect;
  /** 可接管清洗后的链接；返回 undefined 使用默认链接，返回 null 隐藏该标记。 */
  renderLink?: LinkRenderer;
  /** 宿主可在 URL 防护前将业务链接转换为站内标记；最终地址仍经过防护。 */
  transformLink?: (href: string) => string;
  className?: string;
  style?: CSSProperties;
}

const plugins = { cjk, math: createMathPlugin({ singleDollarTextMath: true }) };
// 沿用参考的单字时长与错开节奏；积压上限让高速流式输入能及时追上正文。
const textAnimations: Record<TextEmergenceEffect, AnimateOptions> = {
  ink: { animation: 'pl-ink', duration: 360, stagger: 45, sep: 'char', easing: 'linear', maxBacklogMs: 320 },
  mist: { animation: 'pl-mist', duration: 640, stagger: 320, sep: 'char', easing: 'ease-out', maxBacklogMs: 320 },
  light: { animation: 'pl-light', duration: 640, stagger: 320, sep: 'char', easing: 'ease-in-out', maxBacklogMs: 320 },
};

/** 保存字首次挂载的动画时序，避免下个网络分块把未完成动画的 duration 改成 0。 */
function EmergenceSpan({ node: _node, style, children, ...props }: ComponentProps<'span'> & ExtraProps) {
  const animated = 'data-sd-animate' in props;
  const [arrivalStyle] = useState(style);
  const [settled, setSettled] = useState(false);
  return <span {...props} style={animated ? arrivalStyle : style}
    data-pl-settled={animated && settled ? '' : undefined}
    onAnimationEnd={animated ? () => setSettled(true) : undefined}>{children}</span>;
}
// 不解析模型生成的原始 HTML；保留框架的清洗与 URL 防护，再由固定组件处理围栏。
const rehypePlugins = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden];
type HtmlNode = { tagName?: string; properties?: { href?: unknown }; children?: HtmlNode[] };

/** 只改写已通过 HTML 清洗的链接属性，图片和其他节点保留原有防护。 */
function rewriteLinks(transform: NonNullable<MarkdownRendererProps['transformLink']>) {
  return () => (root: HtmlNode) => {
    function visit(node: HtmlNode) {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        node.properties.href = transform(node.properties.href);
      }
      node.children?.forEach(visit);
    }
    visit(root);
  };
}
/** 交给宿主处理经清洗的链接，普通链接继续使用统一的打开方式。 */
function MarkdownLink({ href, children }: ComponentProps<'a'> & ExtraProps) {
  const renderLink = useContext(RenderLink);
  const rendered = href !== undefined ? renderLink?.(href, children) : undefined;
  return rendered === undefined ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{rendered}</>;
}
const components: Components = {
  span: EmergenceSpan,
  code: MarkdownCode,
  inlineCode: ({ children }) => <code className="pl-md-inline">{children}</code>,
  a: MarkdownLink,
  img: ({ src, alt }) => <img src={src} alt={alt || '图片'} loading="lazy" referrerPolicy="no-referrer" />,
};

/** 纯展示入口：保持流式分块模式稳定，避免完成时重挂载图表及丢失用户交互状态。 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming = false, textEffect = 'ink', renderLink, transformLink, className = '', style }: MarkdownRendererProps) {
  const linkPlugins = useMemo(() => transformLink ?
    [defaultRehypePlugins.sanitize, rewriteLinks(transformLink), defaultRehypePlugins.harden] : rehypePlugins, [transformLink]);
  return <div className={`pl-markdown ${className}`} style={style} aria-busy={streaming} data-text-effect={textEffect}>
    <RenderLink.Provider value={renderLink}><Streamdown mode="streaming" isAnimating={streaming} parseIncompleteMarkdown={streaming}
      animated={textAnimations[textEffect]}
      plugins={plugins} components={components} rehypePlugins={linkPlugins} skipHtml controls={false}>
      {content}
    </Streamdown></RenderLink.Provider>
  </div>;
});
