import { chapterFromTitle, newChapterPath } from '@plotloom/contracts/writing';
import { invalid, WorkspaceError } from '@plotloom/domain';

export interface ChapterImportFile { name: string; content: string }
export interface ImportedChapter { number: number; title: string; path: string; content: string }

/** 只把独立章标题转成 Markdown。正文从原始文本切片，保留段落、标点和行尾。 */
export function planChapterImport(files: readonly ChapterImportFile[]): ImportedChapter[] {
  if (!files.length) invalid('请在本轮添加需要导入的 TXT 或 Markdown 旧稿。');
  const chapters: ImportedChapter[] = [];
  const numbers = new Set<number>();
  for (const { name, content } of files) {
    const headings = [...content.matchAll(/^(?:\uFEFF)?[ \t]*(?:#{1,6}[ \t]+)?(第[ \t]*[0-9零〇一二两三四五六七八九十百千]+[ \t]*章[^\r\n]*)\r?$/gm)];
    if (!headings.length || content.slice(0, headings[0].index).replace(/^\uFEFF/, '').trim()) {
      throw new WorkspaceError('CHAPTER_IMPORT_AMBIGUOUS', `${name} 的开头没有明确的章标题。请核对分章并在正文开头加入“第几章”。`, 422);
    }
    for (const [index, heading] of headings.entries()) {
      const title = heading[1].trim();
      const number = chapterFromTitle(title);
      if (!number || number > 999999 || title.length > 100 || numbers.has(number)) {
        throw new WorkspaceError('CHAPTER_IMPORT_AMBIGUOUS', `${name} 的章号重复、无效或标题过长，请先核对。`, 422);
      }
      const end = headings[index + 1]?.index ?? content.length;
      const body = content.slice(heading.index + heading[0].length + 1, end);
      if (!body.trim()) throw new WorkspaceError('CHAPTER_IMPORT_AMBIGUOUS', `${title} 没有正文，请先核对原稿。`, 422);
      if (chapters.length === 30) invalid('每次最多导入 30 章，请分批提交。');
      numbers.add(number);
      const newline = heading[0].endsWith('\r') ? '\r\n' : '\n';
      chapters.push({ number, title, path: newChapterPath(number),
        content: '# ' + title + newline + newline + body });
    }
  }
  return chapters.sort((left, right) => left.number - right.number);
}
