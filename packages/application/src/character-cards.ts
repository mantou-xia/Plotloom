import { randomUUID } from 'node:crypto';
import { invalid, WorkspaceError } from '@plotloom/domain';
import type { CharacterCardCreateRequest, CharacterCardListResponse, CharacterCardStage } from '@plotloom/contracts/character-cards';
import type { DocumentView } from '@plotloom/contracts/workspaces';
import { chapterFromTitle } from '@plotloom/contracts/writing';
import type { WorkspaceDocuments, WorkspaceService } from './workspaces.ts';

const ROOT = '角色卡/';
const marker = /^<!-- plotloom-character-card chapter=(\d+) note="((?:[^"\\]|\\.)*)"(?: evidencePath="((?:[^"\\]|\\.)*)" evidenceQuote="((?:[^"\\]|\\.)*)")? -->$/m;
const title = /^#\s+(.+)$/m;

function safeSegment(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') invalid('角色名不能为空或包含无效路径。');
  return cleaned.slice(0, 100);
}

function quote(value: string) { return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', ' ').replaceAll('\n', ' '); }
function unquote(value: string) { return value.replaceAll('\\"', '"').replaceAll('\\\\', '\\'); }

function stageFromDocument(document: DocumentView & { createdAt?: string }): CharacterCardStage | null {
  if (!document.path.startsWith(ROOT) || !document.version || !document.createdAt) return null;
  const info = marker.exec(document.content);
  const character = title.exec(document.content)?.[1]?.trim() || document.path.slice(ROOT.length).split('/')[0];
  const chapter = Number(info?.[1] ?? document.path.match(/\/(\d{1,6})-/)?.[1]);
  if (!character || !Number.isInteger(chapter) || chapter < 1) return null;
  return { ...document, createdAt: document.createdAt, character, chapter, note: info ? unquote(info[2]) : '',
    ...(info?.[3] && info[4] ? { evidence: { path: unquote(info[3]), quote: JSON.parse('"' + info[4] + '"') } } : {}) };
}

function compare(a: CharacterCardStage, b: CharacterCardStage) {
  return a.character.localeCompare(b.character, 'zh-CN') || a.chapter - b.chapter || a.createdAt.localeCompare(b.createdAt) || a.path.localeCompare(b.path, 'zh-CN');
}

/** 空行划分 Markdown 自然段，段内软换行仍属于同一条证据。重复引文需要更长的原句定位。 */
function paragraphs(content: string) {
  return content.replaceAll('\r\n', '\n').replace(/^\n+|\n+$/g, '').split(/\n[ \t]*\n/);
}
export function evidenceParagraph(content: string, quote: string) {
  const text = quote.replaceAll('\r\n', '\n');
  const matches = paragraphs(content).filter(paragraph => paragraph.includes(text));
  return matches.length === 1 ? matches[0] : undefined;
}

/** 再确认时按完整段匹配，作者移动段落或在别处重用同一句话都不妨碍采纳。 */
export function retainsEvidence(content: string, paragraph: string) {
  return paragraphs(content).filter(item => item === paragraph).length === 1;
}

export class EvidenceChanged extends Error {
  readonly document: DocumentView;
  constructor(document: DocumentView) {
    super('证据段已变更，请根据最新正文重新判断。');
    this.document = document;
  }
}

/** 角色卡沿用工作区 Markdown 与版本快照，阶段元数据只记录章节号和作者备注，避免引入第二套持久化。 */
export class CharacterCardService {
  private readonly workspaces: WorkspaceService;
  constructor(workspaces: WorkspaceService) { this.workspaces = workspaces; }

  async list(id: string, chapter?: number, character?: string): Promise<CharacterCardListResponse> {
    if (chapter !== undefined && (!Number.isInteger(chapter) || chapter < 1)) invalid('章节号必须是正整数。');
    return this.stages({ listDocuments: () => this.workspaces.listDocuments(id),
      readWithCreation: path => this.workspaces.readWithCreation(id, path) }, chapter, character);
  }

  private async stages(reader: WorkspaceDocuments, chapter?: number, character?: string): Promise<CharacterCardListResponse> {
    const { paths } = await reader.listDocuments();
    const documents = [];
    for (const path of paths) if (path.startsWith(ROOT)) documents.push(await reader.readWithCreation(path));
    const cards = documents.map(stageFromDocument).filter((card): card is CharacterCardStage => !!card)
      .filter(card => !character || card.character === character).sort(compare);
    const latest = new Map<string, CharacterCardStage>();
    for (const card of cards) {
      if (chapter !== undefined && card.chapter > chapter) continue;
      const previous = latest.get(card.character);
      if (!previous || compare(previous, card) <= 0) latest.set(card.character, card);
    }
    return { cards, applicable: [...latest.values()].sort(compare) };
  }

  async create(id: string, input: CharacterCardCreateRequest, review?: {
    paragraph: string; previous: CharacterCardStage; signal?: AbortSignal;
  }): Promise<CharacterCardStage> {
    const character = safeSegment(input.character);
    if (!Number.isInteger(input.chapter) || input.chapter < 1 || input.chapter > 999999) invalid('章节号必须是 1 到 999999 的整数。');
    if (!input.content.trim() || !input.content.isWellFormed()) invalid('角色卡内容不能为空或含无效 Unicode。');
    if (input.evidence && (!input.evidence.path.trim() || !input.evidence.quote.trim())) invalid('角色卡变化证据不能为空。');
    const note = (input.note ?? '').trim().slice(0, 200);
    const path = `${ROOT}${character}/${String(input.chapter).padStart(6, '0')}-${randomUUID()}.md`;
    const source = input.evidence;
    const evidence = input.evidence ? ` evidencePath="${quote(input.evidence.path)}" evidenceQuote="${JSON.stringify(input.evidence.quote).slice(1, -1)}"` : '';
    const content = `# ${character}\n\n<!-- plotloom-character-card chapter=${input.chapter} note="${quote(note)}"${evidence} -->\n\n${input.content.trim()}\n`;
    // 确认期间章节或角色卡可能被作者编辑。在同一写入队列内重新定位证据并检查适用阶段。
    await this.workspaces.save(id, { path, baseVersion: null, content }, source ? async reader => {
      if (!source.path.startsWith('正文章节/') || chapterFromTitle(source.path.split('/').at(-1)!) !== input.chapter)
        invalid('证据须来自对应章号的正文章节。');
      if (review) {
        const [current] = (await this.stages(reader, input.chapter, character)).applicable;
        if (current?.path !== review.previous.path || current.version !== review.previous.version)
          throw new WorkspaceError('REFERENCE_CONFLICT', '角色卡已更新，请根据当前阶段重新提出建议。');
      }
      const chapter = await reader.readWithCreation(source.path);
      if (review) {
        if (!retainsEvidence(chapter.content, review.paragraph)) throw new EvidenceChanged(chapter);
      } else if (!evidenceParagraph(chapter.content, source.quote)) invalid('请引用能唯一定位本章一个自然段的原文。');
      review?.signal?.throwIfAborted();
    } : undefined);
    return this.read(id, path);
  }

  async read(id: string, path: string) {
    const card = stageFromDocument(await this.workspaces.readWithCreation(id, path));
    if (!card) throw new WorkspaceError('CHARACTER_CARD_NOT_FOUND', '角色卡阶段不存在。', 404);
    return card;
  }
}
