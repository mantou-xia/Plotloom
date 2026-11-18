import { ArrowRight, ArrowUpRight, Braces, Check, CircleAlert, Hash, Info, createElement } from 'lucide';

// 只收录原生页面实际使用的图标，避免把整个图标库打入试验台。
const icons = { ArrowRight, ArrowUpRight, Braces, Check, CircleAlert, Hash, Info };

/** 为原生 HTML 模板生成 Lucide SVG；仅接受已登记图标，文字说明由调用方提供。 */
export function iconMarkup(name: keyof typeof icons, size = 16): string {
  return createElement(icons[name], {
    width: size,
    height: size,
    'stroke-width': 2,
    'aria-hidden': 'true',
    focusable: 'false',
    style: 'display:inline-block;vertical-align:middle;flex-shrink:0',
  }).outerHTML;
}
