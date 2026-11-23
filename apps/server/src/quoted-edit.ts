import { randomUUID } from 'node:crypto';
import type { RequestResources } from '@plotloom/agent-pi';
import type { WorkspaceService } from '@plotloom/application';
import type { WritingService } from '@plotloom/application/writing';
import { SOURCE_LIMITS, type DocumentReference } from '@plotloom/contracts/sources';
import { checkSelection, checkVersion, invalid } from '@plotloom/domain';
import { objectSchema } from './writing.ts';

/** 只校验能从备注字面确定的两种要求，其余润色由模型结合前后文判断。 */
function validateEdit(comment: string, original: string, replacement: string) {
  if (original === replacement) return;
  const request = comment.trim().replace(/[。！!]$/, '');
  const deletion = /^(?:请)?(?:删掉|删除|去掉)\s*[“「『]([^”」』\n]+)[”」』]$/u.exec(request)
    ?? /^(?:(?:请)?把\s*)?(.+?)(?:这几个字|这句话|这段话)?(?:可以)?(?:删掉|删除|去掉)$/u.exec(request);
  const phrase = deletion?.[1].trim().replace(/^[“「『]|[”」』]$/gu, '');
  if (phrase && original.includes(phrase) && original.indexOf(phrase) === original.lastIndexOf(phrase)) {
    const start = original.indexOf(phrase);
    const before = original.slice(0, start);
    const after = original.slice(start + phrase.length);
    // 删除短语时允许顺手移除紧邻的一处分隔符，其他文字必须逐字保留。
    const allowed = [before + after, before + after.replace(/^[，、,][ \t]*/u, ''), before.replace(/[，、,][ \t]*$/u, '') + after];
    if (!allowed.includes(replacement)) invalid(`只删除作者点名的「${phrase}」，保留选区里的其余文字。`);
  }
  if (/^(?:请|帮我)?(?:把(?:这[段句]|选区|这段话))?(?:改得?|写得?|再)?(?:更)?(?:简练|简洁|精简|简短|凝练|缩短)(?:一?点|一些|一下)?$/u.test(request) &&
    (!/[\p{L}\p{N}]/u.test(replacement) || replacement.replace(/\s/gu, '').length >= original.replace(/\s/gu, '').length)) {
    invalid('作者要求精简，请保留正文信息，并让替换后的非空白字符数少于原文。');
  }
}

/** 本轮只授予替换已引用选区的能力，通用工具可读取对应文稿以判断上下文。 */
export function quotedEditResources(workspaces: WorkspaceService, writing: WritingService, sessionId: string,
  workspaceId: string, references: readonly DocumentReference[]): RequestResources {
  const paths = new Set(references.map(reference => reference.path.toLowerCase()));
  return { key: randomUUID(), fileScope: { visible: path => paths.has(path.toLowerCase()), read: (_path, value) => value, writable: () => false },
    systemPrompt: '文稿选区以 referenceIndex 标识，editComment 是该选区的作者要求。选区限定可编辑范围，备注决定其中哪部分应改。先核对完整选区和前后文，包括选区外紧邻的标点。只改作者要求的部分，保留无关文字、信息、视角和叙述语气。' +
      '点名删短语时，只删该短语和必要的相邻分隔符，保留其余句子。例如选中「第二声没喊全，他就哭得弯下了腰」，备注「第二声没喊全可以删掉」，replacement 应是「他就哭得弯下了腰」。只有作者明确要求删除整段选区时才传空字符串，检查删后会不会留下孤立标点。要求简练时，删重复和赘词，保留关键信息，不添加新细节，替换后应比原文更短。' +
      '仅在作者明确要求改动且能在选区内完成时调用 edit_quoted_selections。同一文件的修改一次提交，各 replacement 是对应完整选区替换后的内容，不能包含选区外的文字。明确的输入校验错误应按工具提示修正后重新提交。作者未要求改稿、表达含糊或需要改动选区外时，说明情况或询问作者。拒绝、停止、版本不符或工具失败后不得换方式写入。只有工具返回 updated 才能告知作者改稿完成。',
    tools: [{ name: 'edit_quoted_selections', description: '申请替换同一文件的引用选区，获批后只替换指定原文。',
      parameters: objectSchema({ edits: { type: 'array', minItems: 1, maxItems: SOURCE_LIMITS.referenceCount, items: objectSchema({
        referenceIndex: { type: 'integer', minimum: 1, maximum: references.length }, replacement: { type: 'string', maxLength: 20000,
          description: '对应整个选区修改后的完整内容，必须带回选区内未被要求改动的文字。' },
      }) } }), confirmable: true,
      async execute(input: { edits: Array<{ referenceIndex: number; replacement: string }> }, signal, confirm) {
        const edits = input.edits.map(({ referenceIndex, replacement }) => {
          const reference = references[referenceIndex - 1];
          if (reference?.editComment === undefined || !reference.selection || reference.workspaceId !== workspaceId)
            invalid('只能替换本轮标记为选区修改的引用。');
          return { reference, selection: reference.selection, replacement };
        }).sort((left, right) => left.selection.start - right.selection.start);
        const target = edits[0].reference;
        if (edits.some(({ reference, selection }, index) => reference.path !== target.path || reference.version !== target.version ||
          (index > 0 && selection.start < edits[index - 1].selection.end))) invalid('每次只能修改同一文件版本中互不重叠的选区。');

        const current = await workspaces.read(workspaceId, target.path);
        checkVersion(current.version, target.version);
        const newline = current.content.match(/\r\n|\r|\n/)?.[0] ?? '\n';
        let end = 0;
        const parts: string[] = [];
        const preview: string[] = [];
        for (const { reference, selection, replacement } of edits) {
          checkSelection(current.content, selection);
          const after = replacement.replace(/\r\n|\r|\n/g, newline);
          validateEdit(reference.editComment!, selection.text, after);
          // 拼回首尾两侧的原始行，发现选区外标点被单独留下时，在显示审批前拒绝。
          const prefix = current.content.slice(0, selection.start).split(/\r\n|\r|\n/).at(-1)!;
          const suffix = current.content.slice(selection.end).split(/\r\n|\r|\n/, 1)[0];
          if (/[\p{L}\p{N}]/u.test(selection.text) && /^[\p{P}\s]+$/u.test(prefix + after + suffix) && /\p{P}/u.test(prefix + after + suffix))
            invalid('替换后会留下孤立标点。请保留该句未要求删除的内容，或让作者重新选择包含标点的范围。');
          parts.push(current.content.slice(end, selection.start), after);
          end = selection.end;
          if (selection.text !== after) preview.push(`原文：\n${selection.text}\n\n替换为：\n${after || '（删除所选文字）'}`);
        }
        const content = parts.join('') + current.content.slice(end);
        if (content.length > 500000 || !content.isWellFormed()) invalid('替换后的文稿内容无效或超过长度上限。');
        if (!preview.length) return { status: 'unchanged' };
        if (!await confirm?.(preview.join('\n\n───\n\n'), { path: target.path, operation: 'edit', label: '修改文稿选区' })) return { status: 'declined' };
        // 审批期间作者可能保存新稿。工作区锁内再次校验版本，禁止把旧选区覆盖到新稿上。
        signal?.throwIfAborted();
        await writing.trackWrites(sessionId, () => workspaces.save(workspaceId, { path: target.path, baseVersion: target.version, content },
          async () => signal?.throwIfAborted()));
        return { status: 'updated', path: target.path, view: { workspaceId, path: target.path, mode: 'refresh' } };
      },
    }] };
}
