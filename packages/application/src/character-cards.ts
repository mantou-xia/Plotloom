import { randomUUID } from 'node:crypto';
import { invalid, WorkspaceError } from '@plotloom/domain';
import type { CharacterCardCreateRequest, CharacterCardListResponse, CharacterCardStage } from '@plotloom/contracts/character-cards';
import type { DocumentView } from '@plotloom/contracts/workspaces';
import type { WorkspaceService } from './workspaces.ts';

const ROOT = '角色卡/';
const marker = /^<!-- plotloom-character-card chapter=(\d+) note="((?:[^"\\]|\\.)*)" -->$/m;
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
  return { ...document, createdAt: document.createdAt, character, chapter, note: info ? unquote(info[2]) : '' };
}

function compare(a: CharacterCardStage, b: CharacterCardStage) {
  return a.character.localeCompare(b.character, 'zh-CN') || a.chapter - b.chapter || a.path.localeCompare(b.path, 'zh-CN');
}

/** 角色卡沿用工作区 Markdown 与版本快照，阶段元数据只记录章节号和作者备注，避免引入第二套持久化。 */
export class CharacterCardService {
  private readonly workspaces: WorkspaceService;
  constructor(workspaces: WorkspaceService) { this.workspaces = workspaces; }

  async list(id: string, chapter?: number, character?: string): Promise<CharacterCardListResponse> {
    if (chapter !== undefined && (!Number.isInteger(chapter) || chapter < 1)) invalid('章节号必须是正整数。');
    const { paths } = await this.workspaces.listDocuments(id);
    const documents = await Promise.all(paths.filter(path => path.startsWith(ROOT)).map(path => this.workspaces.readWithCreation(id, path)));
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

  async create(id: string, input: CharacterCardCreateRequest): Promise<CharacterCardStage> {
    const character = safeSegment(input.character);
    if (!Number.isInteger(input.chapter) || input.chapter < 1 || input.chapter > 999999) invalid('章节号必须是 1 到 999999 的整数。');
    if (!input.content.trim() || !input.content.isWellFormed()) invalid('角色卡内容不能为空或含无效 Unicode。');
    const note = (input.note ?? '').trim().slice(0, 200);
    const path = `${ROOT}${character}/${String(input.chapter).padStart(6, '0')}-${randomUUID()}.md`;
    const content = `# ${character}\n\n<!-- plotloom-character-card chapter=${input.chapter} note="${quote(note)}" -->\n\n${input.content.trim()}\n`;
    await this.workspaces.save(id, { path, baseVersion: null, content });
    return this.read(id, path);
  }

  async read(id: string, path: string) {
    const card = stageFromDocument(await this.workspaces.readWithCreation(id, path));
    if (!card) throw new WorkspaceError('CHARACTER_CARD_NOT_FOUND', '角色卡阶段不存在。', 404);
    return card;
  }
}
