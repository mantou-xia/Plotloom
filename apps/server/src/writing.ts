import { AgentError, type BusinessTool, type RequestResources } from '@plotloom/agent-pi';
import { CHAPTER_PART_LIMIT, WritingService, WRITING_ENTRY, chapterLengthLimit, writingPrompt, type ChapterChatRequest } from '@plotloom/application/writing';
import type { WorkspaceService } from '@plotloom/application';
import type { MessageSources } from '@plotloom/contracts/sources';
import type { SubmitMessageRequest } from '@plotloom/contracts';
import type { WritingRecord, WritingRequest } from '@plotloom/contracts/writing';
import { checkVersion, invalid, WorkspaceError } from '@plotloom/domain';
import { chapterFromTitle, newChapterPath, WORLDVIEW_PATH } from '@plotloom/contracts/writing';
import type { MessageSourceService } from '@plotloom/application/sources';
import type { CharacterCardService } from '@plotloom/application/character-cards';

export const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
export const pathSchema = { type: 'string', minLength: 1, maxLength: 500 };
const text = { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' };
const version = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const selection = objectSchema({ start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 }, text: { type: 'string' } });

const chapterCommand = /^(?:请\s*)?(?:帮我\s*)?(?:重写|写出|写完|写|生成|完成|创作|撰写)[ \t]*(第[0-9一二两三四五六七八九十百千零〇]+章)(?=[\s：:，,。]|$)/;
const outlineHeading = /^(?:讨论|看看|核对)?[ \t]*(第[0-9一二两三四五六七八九十百千零〇]+章)[ \t]*(?:的)?大纲[ \t]*[：:]/;
const outlineFollowup = /^(?:可以|好[的呀]?|那就|嗯)[，,。 \t]*|^请[ \t]*/;

/** 只在作者明确开写时使用紧邻的一份作者大纲。讨论、否定或含糊指代不进入写章路径。 */
function isOutlineFollowup(text: string) {
  const request = text.replace(outlineFollowup, '');
  return /^(?:就)?按(?:照)?(?:刚才|上面|上一条)(?:那个|那份|的)?大纲/.test(request)
    && /(?:先存(?:下来|档)?|保存(?:大纲)?|留档)/.test(request)
    && /(?:写|起草|生成|编写)正文|再开写/.test(request)
    && !/(?:暂不|先别|不(?:用|要|想|必|需要))\s*(?:先\s*)?(?:存|留档|写正文|起草|开写)|只(?:想|是)?讨论|能不能|是否|要不要|[？?]/.test(request);
}

/** 复用明确写章的版本锁与审批。仅在自然承接时查上一轮，保留新消息作为本轮要求。 */
export async function chapterChat(workspaces: WorkspaceService, cards: CharacterCardService, id: string, text: string,
  sources?: MessageSources, previousAuthorMessage?: () => Promise<string | undefined>): Promise<ChapterChatRequest> {
  const references = sources?.references?.map(({ workspaceId: _workspaceId, ...reference }) => ({ ...reference, role: 'other' as const })) ?? [];
  const command = chapterCommand.exec(text);
  let chapterTitle = command?.[1];
  let outlineContent = command ? text.slice(command[0].length).replace(/^[ \t]*(?:[：:，,。][ \t]*)?(?:\r?\n)?/, '') : '';
  if (!command) {
    if (!isOutlineFollowup(text)) return { task: 'discuss', instructions: text, references };
    const previous = (await previousAuthorMessage?.())?.trim() ?? '';
    const heading = outlineHeading.exec(previous);
    if (heading) {
      chapterTitle = heading[1];
      // 剥离明确的聊天审阅指令，保留作者实际写出的情节和段落。
      outlineContent = previous.slice(heading[0].length).trim()
        .replace(/(^|\n|(?<=[。！？]))[ \t]*(?:请(?:只)?(?:用[^。！？\r\n]{1,20})?(?:评价|讨论|核对|点评|帮我看看)|帮我看看)[\s\S]*$/u, '$1').trimEnd();
    }
    const requestedChapter = chapterFromTitle(text);
    if (!chapterTitle || !outlineContent || (requestedChapter && requestedChapter !== chapterFromTitle(chapterTitle)))
      invalid('没有找到可直接使用的上一轮章节大纲。请发送「写第几章：」并附上确认的大纲。');
  }
  const chapterNumber = chapterFromTitle(chapterTitle ?? '');
  if (!chapterNumber || chapterNumber > 999999 || !outlineContent.replace(/^[\s：:，,。]+/, '').trim())
    invalid('请提供有效章号和本章大纲，例如“写第四章：主角赴约”。');
  const { paths } = await workspaces.listDocuments(id);
  const chapters = paths.filter(path => path.startsWith('正文章节/'))
    .map(path => ({ path, number: chapterFromTitle(path.split('/').at(-1)!) }));
  const matches = chapters.filter(item => item.number === chapterNumber);
  if (matches.length > 1) invalid('本书有多份同章号正文，请先整理目标章节。');
  const path = matches[0]?.path ?? newChapterPath(chapterNumber);
  const outlinePath = `大纲/第${chapterNumber}章.md`;
  const existingOutlines = paths.filter(path => path.startsWith('大纲/') && chapterFromTitle(path.split('/').at(-1)!) === chapterNumber);
  if (!existingOutlines.includes(outlinePath) && existingOutlines.length > 1) invalid('本书有多份同章号大纲，请先整理大纲目录。');
  const chatOutline = { path: existingOutlines.includes(outlinePath) ? outlinePath : existingOutlines[0] ?? outlinePath, content: outlineContent };
  const previous = chapters.filter(item => item.number !== undefined && item.number < chapterNumber)
    .sort((a, b) => b.number! - a.number!).slice(0, 3);
  const applicable = (await cards.list(id, chapterNumber)).applicable;
  const named = applicable.filter(card => outlineContent.includes(card.character) || text.includes(card.character));
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
  return { task: 'chapter', chatChapter: true, chatOutline, ...(command ? {} : { previousOutline: true }),
    chapterNumber, instructions: text, references: contextReferences, maxOutputChars: 20000,
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
  const tool = (name: string, description: string, parameters: Record<string, unknown>, execute: BusinessTool['execute']): BusinessTool => ({ name, description, parameters,
    execute: (value, signal, confirm) => service.trackWrites(sessionId, () => execute(value, signal, confirm)) });
  const importPrompt = files.length
    ? '\n作者明确要导入本轮 TXT 或 Markdown 旧章节时，调用 import_chapters。工具直接处理原附件，不要重新生成或改写正文；标题不明确时向作者说明如何修正，拒绝或停止后不得换工具绕过。若作者想重新发起审批，可在同一聊天发送「继续导入」复用这一批附件。'
      + '作者若只要求导入，先简短说明导入结果。工具有 nextSteps 时，在最终回复中给出这三个可选方向并问他想从哪一个开始。用普通聊天文字提示，不发起选择卡或开始后续工作。写下一章可直接发「写第四章：」加大纲（章号按实际替换）。重复导入没有新增时只报告跳过。作者已明确安排后续工作时按原要求处理。'
    : '';
  const lengthLimit = chapterLengthLimit(input.instructions);
  const chapterPrompt = input.chatChapter
    ? (input.previousOutline ? '\n本轮沿用作者上一条消息中的大纲（JSON）：' + JSON.stringify(input.chatOutline?.content) + '。当前消息是追加的写作要求。'
      : '\n作者的本轮消息就是大纲。')
    + '\n依据前文和当章资料按自然段暂存正文，短章可一次写完。章标题只写一次。先按作者字数安排篇幅，压缩相似的环境细节，保留推动情节的动作与对白；对白或动作已经交代的判断不再解释。停止在作者指定的落点。不要自设会改变因果的往事。'
    + (lengthLimit !== undefined ? '\n正文上限为 ' + lengthLimit + ' 字，按稿纸口径含标点和 Markdown 标记，不计空白。查看 write_chapter_part 返回的 manuscriptCharacters；若超长，替换已有段落缩短后再审校。' : '')
    + '\n全部暂存后调用 review_writing 审校，再用 deliver_chapter 交稿。交稿后先告诉作者正文状态，再处理需要另行确认的角色资料。若有人物阶段变化，每次只用 propose_character_change 提交一个角色，并引用交稿原句。'
    + (run.restoredParts.length ? '\n重试已恢复的草稿如下（按段号从 1 排列）。从最后一段接着写；已写完则直接审校交稿。\n' + JSON.stringify(run.restoredParts) : '') : '';
  const archiveOutline = run.archiveOutline;
  return { key: run.record.id, fileScope: run.fileScope, replayInput: { ...input, worldviewVersion, chapterDraftId: run.draftId }, persistReplayInput: input.chatChapter,
    beforeGenerate: archiveOutline ? async (signal, confirm) => {
      try { await archiveOutline(signal, confirm); }
      catch (error) {
        if (error instanceof WorkspaceError) throw new AgentError(error.statusCode, error.code, error.message);
        throw error;
      }
    } : undefined,
    systemPrompt: writingPrompt(run.record.context, input.chatChapter) + importPrompt + chapterPrompt, start: run.start, finish: run.finish, tools: [
    ...(input.chatChapter ? [{ ...tool('write_chapter_part', '暂存本章一段正文。段号从 1 连续递增，同号替换，段间自动插入空行。返回稿纸总字数 manuscriptCharacters 及明确上限（如有），超长先缩短。', objectSchema({
      part: { type: 'integer', minimum: 1 }, content: { ...text, maxLength: CHAPTER_PART_LIMIT },
    }), (value, signal) => run.writePart(value.part, value.content, signal)), sequential: true },
    { ...tool('deliver_chapter', '由服务拼接本轮已暂存的所有段落，审校后向作者展示全文并确认一次。', objectSchema({
      partCount: { type: 'integer', minimum: 1 }, reason: text,
    }), (value, signal, confirm) => run.deliver(value.partCount, value.reason, signal, confirm)), confirmable: true }] : []),
    ...(files.length ? [{ ...tool('import_chapters', '将本轮 TXT/Markdown 附件按独立章标题分章。作者确认后才写入，保护已有正文。', objectSchema({}),
      (_input, signal, confirm) => run.importChapters(signal, confirm)), confirmable: true }] : []),
    { ...tool('manuscript_workspace', '按作者要求操作右侧正文或大纲。edit 提交候选并打开审阅，读取原稿用 read_document，无需先 open。局部修改必须给 original 与 content。仅查看时用 open/preview 等待确认。list/refresh 列出或刷新目录；finalize 留档；history 查定稿；read_final 读定稿；restore 回退；discard 丢弃本地草稿；export_txt 下载单章最新保存稿为纯文本。', objectSchema({
      action: { enum: ['list', 'refresh', 'open', 'preview', 'edit', 'finalize', 'history', 'read_final', 'restore', 'discard', 'export_txt'] },
      path: pathSchema,
      original: { ...text, maxLength: 8000, description: '局部编辑时逐字提供目标原文，必须在已读文稿中唯一匹配。' },
      content: { type: 'string', maxLength: 8000, description: '提供 original 时为局部替换文本，否则为整篇文稿。' },
      revisionId: { type: 'string', maxLength: 80 },
    }, ['action']), (input, signal, confirm) => run.manuscript(input, signal, confirm)), confirmable: true, confirmationOptions: ['确认操作', '取消操作'] },
    { ...tool('propose_world_rule', '提交一条从开篇到结尾都必须遵守的世界底层规则，请作者确认。作者口述规则用本轮原话作为 fact。章稿取证只用独立、写明普遍适用范围的完整规则句，fact 与 evidence.quote 相同，另填全书适用场景 impact。单次重生、角色对监护等制度的判断、阶段性情节不入库。', objectSchema({
      subject: { ...text, maxLength: 80 }, fact: { ...text, maxLength: 500 },
      effective: { type: 'integer', minimum: 1, maximum: 999999, description: '全书规则从开篇成立，填 1。' },
      revealed: { anyOf: [{ type: 'null' }, { type: 'integer', minimum: 1, maximum: 999999 }], description: '主角实际得知的章号，未揭示填 null。来自章稿时仅可填证据所在章或 null。' },
      impact: { ...text, maxLength: 300, description: '章节建议须说明全书任一章节出现哪些情形时都必须遵守这条规则。' },
      evidence: objectSchema({ path: { ...pathSchema, description: '实际章节的 .md 相对路径；作者本轮口述请省略。' }, quote: { ...text, maxLength: 300 } }, ['quote']),
    }, ['subject', 'fact', 'effective', 'revealed']), (input, signal, confirm) => run.proposeRule(input, signal, confirm)), confirmable: true },
    ...((input.chatChapter || input.task === 'discuss') && characterCards ? [{ ...tool('propose_character_change', '提交交稿后的单个角色卡变化建议。必须引用本章交稿原句；确认卡会展示原阶段、证据和建议新阶段，作者确认后才保存。', objectSchema({
      character: { type: 'string', minLength: 1, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 }, note: { type: 'string', maxLength: 200 },
      content: { type: 'string', minLength: 1, maxLength: 500000 }, evidence: objectSchema({ path: pathSchema, quote: { ...text, maxLength: 300 } }, ['path', 'quote']),
    }, ['character', 'chapter', 'content', 'evidence']), (value, signal, confirm) => run.proposeCharacterChange(value, signal, confirm)), confirmable: true }] : []),
    ...((input.chatChapter || input.task === 'discuss') && characterCards ? [{ ...tool('suggest_character_card',
      '交稿后检查值得跟进且缺卡的人物。新章保存后调用；重写候选交付后也可调用，工具等正文采纳才询问。首次省略 content，工具会根据称呼、章号、理由和原句询问作者；若可能为已有角色的别称，传 possibleIdentity。收到 draft_requested 后再传五栏草稿请求保存。', objectSchema({
        character: { ...text, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 },
        reason: { ...text, maxLength: 300 }, possibleIdentity: { ...text, maxLength: 100 },
        content: { ...text, maxLength: 500000, description: '作者同意建卡后提交的五栏 Markdown 草稿。首次调用会忽略此字段。' },
        evidence: objectSchema({ path: pathSchema, quote: { ...text, maxLength: 300 } }),
      }, ['character', 'chapter', 'reason', 'evidence']), (value, signal, confirm) => run.proposeCharacterChange(value, signal, confirm)),
      confirmable: true, confirmationOptions: ['建卡', '暂时跳过'] as [string, string] }] : []),
    tool('list_documents', '列出当前小说正式 Markdown 相对路径。', objectSchema({}), () => run.list()),
    tool('read_document', '读取当前小说正式资料，固定本轮版本；返回原文与来源。', objectSchema({ path: pathSchema }), (v, signal) => run.read(v.path, signal)),
    tool('search_documents', '按字面查找用户指定历史情节，返回实际原文位置和版本。', objectSchema({ query: { ...text, maxLength: 200 }, paths: { type: 'array', minItems: 1, maxItems: 30, items: pathSchema } }, ['query']), (v, signal) => run.search(v.query, v.paths, signal)),
    tool('review_writing', '交稿或提交候选前审校设定与视角；阻碍交付的冲突须引用原文。只读诊断与聊天示例直接回答即可。', objectSchema({ status: { enum: ['clear', 'needs_input'] }, issues: { type: 'array', maxItems: 20, items: objectSchema({ kind: { enum: ['setting', 'viewpoint', 'missing_material'] }, message: text,
      evidence: { type: 'array', maxItems: 10, items: objectSchema({ path: pathSchema, quote: text }) } }) } }), (v, signal) => run.review(v, signal)),
    ...(!input.chatChapter ? [tool('propose_change', '审校 clear 后提交一个候选；改写只给选区替换，续写只给尾部新增。返回 view 时可在右侧审阅，正式稿需作者采纳后才更新。', objectSchema({ path: pathSchema, content: { type: 'string', maxLength: 20000 }, reason: text }), async (v, signal) => {
      const proposal = await run.propose(v.path, v.content, v.reason, signal);
      // 正文和大纲候选与工作区编辑工具共用同一个审阅入口。
      if (!/^(正文章节|大纲)\//u.test(proposal.path)) return proposal;
      return { ...proposal, view: { workspaceId: run.record.context.workspaceId, path: proposal.path, mode: 'edit', proposalId: proposal.id } };
    })] : []),
    ...(!input.chatChapter && characterCards ? [{ ...tool('save_character_card', '根据作者已确认的信息整理并保存一份细化五栏角色卡阶段。性格特点必须含表征、内在和描写，愿景必须含明示、潜意识和描写，特殊性按心理特质、口癖、禁忌及其他记录。chapter 是开始适用的章节，note 填写 Agent 从剧情中提取的变化关键词。保存前必须向作者展示并等待确认。', objectSchema({
      character: { type: 'string', minLength: 1, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 }, note: { type: 'string', maxLength: 200 }, content: { type: 'string', minLength: 1, maxLength: 500000 },
    }, ['character', 'chapter', 'content']), async (value, signal, confirm) => {
      if (!await confirm?.(`保存 ${value.character} 的第 ${value.chapter} 章角色卡阶段${value.note ? `（${value.note}）` : ''}\n\n${value.content}`, { path: '角色卡/' + value.character, operation: 'create', label: '保存角色卡' })) return { status: 'declined' };
      signal?.throwIfAborted();
      return characterCards.create(run.record.context.workspaceId, value);
    }), confirmable: true }] : []),
  ] };
}
