import type { BusinessTool, RequestResources } from '@plotloom/agent-pi';
import { CHAPTER_PART_LIMIT, WritingService, WRITING_ENTRY, writingPrompt, type ChapterChatRequest } from '@plotloom/application/writing';
import type { WorkspaceService } from '@plotloom/application';
import type { MessageSources } from '@plotloom/contracts/sources';
import type { SubmitMessageRequest } from '@plotloom/contracts';
import type { WritingRecord, WritingRequest } from '@plotloom/contracts/writing';
import { checkVersion, invalid } from '@plotloom/domain';
import { chapterFromTitle, WORLDVIEW_PATH } from '@plotloom/contracts/writing';
import type { MessageSourceService } from '@plotloom/application/sources';
import type { CharacterCardService } from '@plotloom/application/character-cards';

export const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
export const pathSchema = { type: 'string', minLength: 1, maxLength: 500 };
const text = { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' };
const version = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const selection = objectSchema({ start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 }, text: { type: 'string' } });

/** 显式写章请求才固定整章目标，普通讨论仍走原会话路径。 */
export async function chapterChat(workspaces: WorkspaceService, cards: CharacterCardService, id: string, text: string,
  sources?: MessageSources): Promise<ChapterChatRequest> {
  const references = sources?.references?.map(({ workspaceId: _workspaceId, ...reference }) => ({ ...reference, role: 'other' as const })) ?? [];
  const command = /^(?:请\s*)?(?:帮我\s*)?(?:重写|写出|写完|写|生成|完成|创作|撰写)[ \t]*(第[0-9一二两三四五六七八九十百千零〇]+章)(?=[\s：:，,。]|$)/.exec(text);
  if (!command) return { task: 'discuss', instructions: text, references };
  const chapterNumber = chapterFromTitle(command[1]);
  if (!chapterNumber || chapterNumber > 999999 || !text.slice(command[0].length).replace(/^[\s：:，,。]+/, '').trim())
    invalid('请提供有效章号和本章大纲，例如“写第四章：主角赴约”。');
  const { paths } = await workspaces.listDocuments(id);
  const chapters = paths.filter(path => path.startsWith('正文章节/'))
    .map(path => ({ path, number: chapterFromTitle(path.split('/').at(-1)!) }));
  const matches = chapters.filter(item => item.number === chapterNumber);
  if (matches.length > 1) invalid('本书有多份同章号正文，请先整理目标章节。');
  const path = matches[0]?.path ?? `正文章节/${command[1]}.md`;
  const previous = chapters.filter(item => item.number !== undefined && item.number < chapterNumber)
    .sort((a, b) => b.number! - a.number!).slice(0, 3);
  const applicable = (await cards.list(id, chapterNumber)).applicable;
  const named = applicable.filter(card => text.includes(card.character));
  const referenced = references.filter(ref => ref.path !== path);
  const contextReferences: NonNullable<WritingRequest['references']> = [...referenced];
  for (const card of named.length ? named : applicable) {
    const existing = contextReferences.find(ref => ref.path === card.path);
    if (existing) existing.role = 'character';
    else if (card.version) contextReferences.push({ path: card.path, version: card.version, role: 'character' });
  }
  for (const item of previous) {
    if (contextReferences.some(ref => ref.path === item.path)) continue;
    const doc = await workspaces.peek(id, item.path);
    if (doc.version) contextReferences.push({ path: item.path, version: doc.version, role: 'history' });
  }
  return { task: 'chapter', chatChapter: true, chapterNumber, instructions: text, references: contextReferences, maxOutputChars: 20000,
    target: { path, baseVersion: (await workspaces.peek(id, path)).version } };
}
export const writingSchema = objectSchema({
  chapterNumber: { type: 'integer', minimum: 1, maximum: 999999 },
  task: { enum: ['chapter', 'continue', 'rewrite', 'enrich_outline', 'discuss'] }, instructions: { ...text, maxLength: 10000 },
  target: objectSchema({ path: pathSchema, baseVersion: { anyOf: [version, { type: 'null' }] }, selection }, ['path', 'baseVersion']),
  outline: objectSchema({ path: pathSchema, version }),
  references: { type: 'array', maxItems: 30, items: objectSchema({ path: pathSchema, version, role: { enum: ['outline', 'character', 'requirements', 'sample', 'history', 'other'] }, selection }, ['path', 'version', 'role']) },
  maxOutputChars: { type: 'integer', minimum: 200, maximum: 20000 },
  skillIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' } },
}, ['task', 'instructions']);

/** 旧版本在轮次开始前保存初始上下文。只恢复明确来自创作接口的参数，普通讨论仍由消息入口装配。 */
export function recoverWritingInput(request: SubmitMessageRequest, entries: ReadonlyMap<string, unknown>): WritingRequest | undefined {
  const saved = entries.get(WRITING_ENTRY) as WritingRecord | undefined;
  if (!saved || saved.outcome !== 'running' || saved.context.instructions !== request.text) return;
  const { task, target, sources, instructions, maxOutputChars } = saved.context;
  const materials = sources.flatMap(({ path, version, selection, role }) =>
    role === 'target' || path === '世界观.md' || version === null ? [] : [{ path, version, role, ...(selection ? { selection } : {}) }]);
  // 普通讨论可从通用消息记录完整恢复。带独立素材、目标或预算的讨论来自创作接口。
  if (task === 'discuss' && !target && maxOutputChars === 8000 &&
    (request.references?.length || materials.length === 0)) return;
  const outline = task === 'chapter' ? materials.shift() : undefined;
  return { task, instructions, maxOutputChars, chapterNumber: saved.context.chapterNumber, skillIds: request.skillIds,
    ...(target ? { target: task === 'continue' ? { path: target.path, baseVersion: target.baseVersion } : target } : {}),
    ...(outline ? { outline: { path: outline.path, version: outline.version } } : {}),
    references: materials };
}

/** 工具薄适配：工作区由聊天归属绑定，不接受模型提供根目录、版本或采纳权限。 */
export async function writingResources(service: WritingService, sessionId: string, input: ChapterChatRequest & { worldviewVersion?: string | null },
  characterCards?: CharacterCardService, attachments?: { sources: MessageSourceService; ids: string[] }): Promise<RequestResources> {
  const files = attachments?.ids.length ? await attachments.sources.chapterImportFiles(sessionId, attachments.ids) : [];
  const run = await service.prepare(sessionId, input, files);
  const worldviewVersion = run.record.context.sources.find(source => source.path === WORLDVIEW_PATH)?.version ?? null;
  if (input.worldviewVersion !== undefined) checkVersion(worldviewVersion, input.worldviewVersion);
  const tool = (name: string, description: string, parameters: Record<string, unknown>, execute: BusinessTool['execute']): BusinessTool => ({ name, description, parameters, execute });
  const importPrompt = files.length ? '\n作者明确要导入本轮 TXT 或 Markdown 旧章节时，调用 import_chapters。工具直接处理原附件，不要重新生成或改写正文；标题不明确时向作者说明如何修正，拒绝或停止后不得换工具绕过。' : '';
  const chapterPrompt = input.chatChapter ? '\n作者的本轮消息就是大纲。依据前文和当章资料按自然段分批调用 write_chapter_part，每批建议 500–1000 字，章标题只写一次。收到暂存成功后再写下一批。全部暂存后调用 review_writing 审校，再用 deliver_chapter 提交总段数和理由，等待作者确认。交稿确认后先说明本章人物有无阶段变化；如确有变化，每次只用 propose_character_change 提交一个角色，必须引用本章交稿原句。'
    + (run.restoredParts.length ? '\n重试已恢复的草稿如下（按段号从 1 排列）。从最后一段接着写；已写完则直接审校交稿。\n' + JSON.stringify(run.restoredParts) : '') : '';
  return { key: run.record.id, replayInput: { ...input, worldviewVersion, chapterDraftId: run.draftId }, persistReplayInput: input.chatChapter,
    systemPrompt: writingPrompt(run.record.context, input.chatChapter) + importPrompt + chapterPrompt, start: run.start, finish: run.finish, tools: [
    ...(input.chatChapter ? [{ ...tool('write_chapter_part', '暂存本章一段正文。段号从 1 连续递增，同号替换，段间自动插入空行。', objectSchema({
      part: { type: 'integer', minimum: 1 }, content: { ...text, maxLength: CHAPTER_PART_LIMIT },
    }), (value, signal) => run.writePart(value.part, value.content, signal)), sequential: true },
    { ...tool('deliver_chapter', '由服务拼接本轮已暂存的所有段落，审校后向作者展示全文并确认一次。', objectSchema({
      partCount: { type: 'integer', minimum: 1 }, reason: text,
    }), (value, signal, confirm) => run.deliver(value.partCount, value.reason, signal, confirm)), confirmable: true }] : []),
    ...(files.length ? [{ ...tool('import_chapters', '将本轮 TXT/Markdown 附件按独立章标题分章。作者确认后才写入，保护已有正文。', objectSchema({}),
      (_input, signal, confirm) => run.importChapters(signal, confirm)), confirmable: true, confirmationOptions: ['确认导入', '取消导入'] as [string, string] }] : []),
    { ...tool('manuscript_workspace', '按作者要求操作右侧正文或大纲，每次等待确认。list/refresh 列出或刷新目录；open/preview 打开文稿；edit 提交整篇候选；finalize 留档；history 查定稿；read_final 读定稿；restore 回退；discard 丢弃本地草稿。', objectSchema({
      action: { enum: ['list', 'refresh', 'open', 'preview', 'edit', 'finalize', 'history', 'read_final', 'restore', 'discard'] },
      path: pathSchema, content: { type: 'string', maxLength: 8000 }, revisionId: { type: 'string', maxLength: 80 },
    }, ['action']), (input, signal, confirm) => run.manuscript(input, signal, confirm)), confirmable: true, confirmationOptions: ['确认操作', '取消操作'] },
    { ...tool('propose_world_rule', '提交一条世界设定。effective 是规则生效章，revealed 是主角得知章或 null。作者直接讲的设定可省略 evidence，或只给 quote 引用本轮原话。只在引用实际章节文件时给出 path。同主题沿用原名称。', objectSchema({
      subject: { ...text, maxLength: 80 }, fact: { ...text, maxLength: 500 },
      effective: { type: 'integer', minimum: 1, maximum: 999999 }, revealed: { anyOf: [{ type: 'null' }, { type: 'integer', minimum: 1, maximum: 999999 }] },
      evidence: objectSchema({ path: { ...pathSchema, description: '实际章节的 .md 相对路径；作者本轮口述请省略。' }, quote: { ...text, maxLength: 300 } }, ['quote']),
    }, ['subject', 'fact', 'effective', 'revealed']), (input, signal, confirm) => run.proposeRule(input, signal, confirm)), confirmable: true },
    ...((input.chatChapter || input.task === 'discuss') && characterCards ? [{ ...tool('propose_character_change', '提交交稿后的单个角色卡变化建议。必须引用本章交稿原句；确认卡会展示原阶段、证据和建议新阶段，作者确认后才保存。', objectSchema({
      character: { type: 'string', minLength: 1, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 }, note: { type: 'string', maxLength: 200 },
      content: { type: 'string', minLength: 1, maxLength: 500000 }, evidence: objectSchema({ path: pathSchema, quote: { ...text, maxLength: 300 } }, ['path', 'quote']),
    }, ['character', 'chapter', 'content', 'evidence']), (value, signal, confirm) => run.proposeCharacterChange(value, signal, confirm)), confirmable: true, confirmationOptions: ['接受变化', '保留原卡'] as [string, string] }] : []),
    tool('list_documents', '列出当前小说正式 Markdown 相对路径。', objectSchema({}), () => run.list()),
    tool('read_document', '读取当前小说正式资料，固定本轮版本；返回原文与来源。', objectSchema({ path: pathSchema }), (v, signal) => run.read(v.path, signal)),
    tool('search_documents', '按字面查找用户指定历史情节，返回实际原文位置和版本。', objectSchema({ query: { ...text, maxLength: 200 }, paths: { type: 'array', minItems: 1, maxItems: 30, items: pathSchema } }, ['query']), (v, signal) => run.search(v.query, v.paths, signal)),
    tool('review_writing', '审校已读取资料的设定/视角冲突；问题须引用原文，有问题结束本轮等待用户。', objectSchema({ status: { enum: ['clear', 'needs_input'] }, issues: { type: 'array', maxItems: 20, items: objectSchema({ kind: { enum: ['setting', 'viewpoint', 'missing_material'] }, message: text,
      evidence: { type: 'array', maxItems: 10, items: objectSchema({ path: pathSchema, quote: text }) } }) } }), (v, signal) => run.review(v, signal)),
    ...(!input.chatChapter ? [tool('propose_change', '审校 clear 后提交一个候选；改写只给选区替换，续写只给尾部新增。不会保存正式稿。', objectSchema({ path: pathSchema, content: { type: 'string', maxLength: 20000 }, reason: text }), (v, signal) => run.propose(v.path, v.content, v.reason, signal))] : []),
    ...(!input.chatChapter && characterCards ? [{ ...tool('save_character_card', '根据作者已确认的信息整理并保存一份细化五栏角色卡阶段。性格特点必须含表征、内在和描写，愿景必须含明示、潜意识和描写，特殊性按心理特质、口癖、禁忌及其他记录。chapter 是开始适用的章节，note 填写 Agent 从剧情中提取的变化关键词。保存前必须向作者展示并等待确认。', objectSchema({
      character: { type: 'string', minLength: 1, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 }, note: { type: 'string', maxLength: 200 }, content: { type: 'string', minLength: 1, maxLength: 500000 },
    }, ['character', 'chapter', 'content']), async (value, signal, confirm) => {
      if (!await confirm?.(`保存 ${value.character} 的第 ${value.chapter} 章角色卡阶段${value.note ? `（${value.note}）` : ''}\n\n${value.content}`)) return { status: 'declined' };
      signal?.throwIfAborted();
      return characterCards.create(run.record.context.workspaceId, value);
    }), confirmable: true, confirmationOptions: ['确认保存', '取消保存'] as [string, string] }] : []),
  ] };
}
