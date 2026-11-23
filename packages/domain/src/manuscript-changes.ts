import { randomUUID } from 'node:crypto';
import { diffArrays } from 'diff';
import type { Change } from '@plotloom/contracts/workspaces';

/** 保留原始换行与空行；将空行附在前段，避免增删空行把同一段切成两处。 */
function paragraphs(text: string) {
  const blocks: string[] = [];
  let block = '';
  let separated = false;
  for (const line of text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu) ?? []) {
    const blank = !line.trim();
    if (separated && !blank) { blocks.push(block); block = ''; }
    block += line;
    separated = blank;
  }
  if (block) blocks.push(block);
  return blocks;
}

function unit(before: string, after: string, start: number): Change {
  return { id: randomUUID(), start, end: start + before.length, before, after, status: 'pending' };
}

const sentences = new Intl.Segmenter('zh', { granularity: 'sentence' });
function passages(text: string) {
  return new Set(paragraphs(text).flatMap(paragraph => Array.from(sentences.segment(paragraph), ({ segment }) => segment.trim())
    .concat(paragraph.trim())).filter(value => /\p{L}/u.test(value)));
}

/** 用未变段落锚定改写；全文重写或无法可靠细分时，保留成一处完整变更。 */
export function manuscriptChanges(before: string, after: string, offset?: number): Change[] {
  if (before === after) return [];
  if (offset !== undefined) return [unit(before, after, offset)];
  const parts = diffArrays(paragraphs(before), paragraphs(after), { timeout: 1500 });
  if (!parts) return [unit(before, after, 0)];

  const changes: Change[] = [];
  let position = 0;
  let current: Change | undefined;
  for (const part of parts) {
    const text = part.value.join('');
    if (!part.added && !part.removed) { current = undefined; position += text.length; continue; }
    if (!current) { current = unit('', '', position); changes.push(current); }
    if (part.removed) { current.before += text; position += text.length; current.end = position; }
    else current.after += text;
  }

  // 发现同一原句从一处消失并在另一处出现时，将两处及中间内容一起审批，防止重复或漏句。
  const removed = new Map<string, number[]>();
  const added = new Map<string, number[]>();
  changes.forEach((change, index) => {
    const left = passages(change.before);
    const right = passages(change.after);
    for (const [source, other, positions] of [[left, right, removed], [right, left, added]] as const) {
      for (const value of source) {
        if (other.has(value)) continue;
        const indices = positions.get(value) ?? [];
        indices.push(index);
        positions.set(value, indices);
      }
    }
  });
  const links = new Map<number, number>();
  for (const [value, from] of removed) {
    const to = added.get(value);
    if (!to) continue;
    const first = Math.min(from[0], to[0]);
    links.set(first, Math.max(links.get(first) ?? first, from.at(-1)!, to.at(-1)!));
  }
  const grouped: Change[] = [];
  for (let index = 0; index < changes.length;) {
    const first = changes[index];
    let end = links.get(index) ?? index;
    let replacement = first.after;
    for (let cursor = index + 1; cursor <= end; cursor++) {
      replacement += before.slice(changes[cursor - 1].end, changes[cursor].start) + changes[cursor].after;
      end = Math.max(end, links.get(cursor) ?? cursor);
    }
    grouped.push(end === index ? first : unit(before.slice(first.start, changes[end].end), replacement, first.start));
    index = end + 1;
  }
  return grouped;
}
