import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

type Node = ReturnType<typeof fromMarkdown>['children'][number];

/** 只移除 Markdown 语法；按源文件的段间空行拼接，保留对白软换行、标点与未加标题的开头。 */
export function chapterText(markdown: string): string {
  const source = markdown.replace(/^\uFEFF/, '');
  const root = fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const lineEnds = (text: string) => text.match(/\r\n|\n|\r/g)?.join('') ?? '';

  function blocks(nodes: Node[], topLevel = false): string {
    let result = '';
    let previous: Node | undefined;
    for (const node of nodes) {
      if (previous) {
        const gap = source.slice(previous.position!.end.offset, node.position!.start.offset);
        result += topLevel ? gap : lineEnds(gap);
      }
      result += render(node, topLevel);
      previous = node;
    }
    return result;
  }

  function render(node: Node, preserveIndent: boolean): string {
    switch (node.type) {
      case 'text': {
        if (!preserveIndent || !/[\r\n]/.test(node.value)) return node.value;
        // Markdown 会折掉软换行后的缩进，普通对白沿用作者原来的缩进。
        const raw = source.slice(node.position!.start.offset, node.position!.end.offset);
        const indents = raw.matchAll(/(?:\r\n|\r|\n)([ \t]*)/g);
        return node.value.replace(/(\r\n|\r|\n)[ \t]*/g, (_match, eol: string) => eol + (indents.next().value?.[1] ?? ''));
      }
      case 'code': {
        const raw = source.slice(node.position!.start.offset, node.position!.end.offset);
        return preserveIndent && !/^[ \t]{0,3}(?:~~~|```)/.test(raw) ? raw : node.value;
      }
      case 'inlineCode': return node.value;
      case 'break': return lineEnds(source.slice(node.position!.start.offset, node.position!.end.offset));
      case 'image': case 'imageReference': return node.alt ?? '';
      case 'html': return /^<br\s*\/?>$/i.test(node.value) ? '\n' : node.value.replace(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>/gi, '');
      case 'list': case 'listItem': case 'blockquote': case 'table': return blocks(node.children);
      case 'tableRow': return node.children.map(child => render(child, false)).join('\t');
      default: return 'children' in node ? node.children.map(child => render(child, preserveIndent)).join('') : '';
    }
  }

  const first = root.children[0], last = root.children.at(-1);
  if (!first || !last) return source;
  return source.slice(0, first.position!.start.offset) + blocks(root.children, true) + source.slice(last.position!.end.offset);
}
