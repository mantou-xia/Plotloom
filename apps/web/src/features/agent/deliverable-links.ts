import { fromMarkdown } from 'mdast-util-from-markdown';

const linkPrefix = '#plotloom-deliverable-';
type MarkdownNode = { type: string; url?: string; identifier?: string; children?: MarkdownNode[] };
export interface DeliverableLink { path: string; name: string }

/** 将显式 Markdown 文件链接映射到会话相对路径，普通网页、锚点和代码示例保持各自的行为。 */
function filePath(href: string): string | undefined {
  if (!href || /^(?:[\\/]|[a-z][\w+.-]*:)|[?#]/i.test(href)) return;
  let decoded: string;
  try { decoded = decodeURIComponent(href).replaceAll('\\', '/'); } catch { return; }
  const path = decoded.replace(/^(?:\.\/)+/, '');
  if (!path || path.length > 1024 || /[:<>"|?*\u0000-\u001f]/u.test(path)) return;
  if (path.split('/').some(part => !part || part.startsWith('.'))) return;
  if (path === decoded && !path.includes('/') && !path.includes('.')) return;
  return path;
}

/** 只收集实际渲染的链接（含已使用的引用定义），同一路径在交付区只出现一次。 */
export function deliverableLinks(markdown: string) {
  const files = new Map<string, DeliverableLink>();
  const definitions = new Map<string, string>();
  const links: MarkdownNode[] = [];
  function visit(node: MarkdownNode) {
    if (node.type === 'definition' && node.identifier && node.url && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
    if (node.type === 'link' || node.type === 'linkReference') links.push(node);
    node.children?.forEach(visit);
  }
  visit(fromMarkdown(markdown));
  for (const link of links) {
    const path = filePath(link.url ?? definitions.get(link.identifier ?? '') ?? '');
    if (path && !files.has(path)) files.set(path, { path, name: path.split('/').at(-1)! });
  }

  // 渲染器仍运行原有 URL 防护。站内标记只由此轮的文件表解析，浏览器不会直接导航到本机路径。
  const markers = new Map([...files.values()].map(file => [linkPrefix + encodeURIComponent(file.path), file]));
  return {
    files: [...files.values()],
    resolve: (href: string) => markers.get(href),
    transform: (href: string) => {
      const path = filePath(href);
      return path && files.has(path) ? linkPrefix + encodeURIComponent(path) : href;
    },
  };
}
