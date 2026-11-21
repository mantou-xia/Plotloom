import type { BusinessTool, RequestResources } from '@plotloom/agent-pi';
import { WritingService, WRITING_ENTRY, writingPrompt } from '@plotloom/application/writing';
import type { SubmitMessageRequest } from '@plotloom/contracts';
import type { WritingRecord, WritingRequest } from '@plotloom/contracts/writing';

export const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
export const pathSchema = { type: 'string', minLength: 1, maxLength: 500 };
const text = { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' };
const version = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const selection = objectSchema({ start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 }, text: { type: 'string' } });
export const writingSchema = objectSchema({
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
    role === 'target' || version === null ? [] : [{ path, version, role, ...(selection ? { selection } : {}) }]);
  // 普通讨论可从通用消息记录完整恢复。带独立素材、目标或预算的讨论来自创作接口。
  if (task === 'discuss' && !target && maxOutputChars === 8000 &&
    (request.references?.length || materials.length === 0)) return;
  const outline = task === 'chapter' ? materials.shift() : undefined;
  return { task, instructions, maxOutputChars, skillIds: request.skillIds,
    ...(target ? { target: task === 'continue' ? { path: target.path, baseVersion: target.baseVersion } : target } : {}),
    ...(outline ? { outline: { path: outline.path, version: outline.version } } : {}),
    references: materials };
}

/** 工具薄适配：工作区由聊天归属绑定，不接受模型提供根目录、版本或采纳权限。 */
export async function writingResources(service: WritingService, sessionId: string, input: WritingRequest): Promise<RequestResources> {
  const run = await service.prepare(sessionId, input);
  const tool = (name: string, description: string, parameters: Record<string, unknown>, execute: BusinessTool['execute']): BusinessTool => ({ name, description, parameters, execute });
  return { key: run.record.id, systemPrompt: writingPrompt(run.record.context), start: run.start, finish: run.finish, tools: [
    tool('list_documents', '列出当前小说正式 Markdown 相对路径。', objectSchema({}), () => run.list()),
    tool('read_document', '读取当前小说正式资料，固定本轮版本；返回原文与来源。', objectSchema({ path: pathSchema }), (v, signal) => run.read(v.path, signal)),
    tool('search_documents', '按字面查找用户指定历史情节，返回实际原文位置和版本。', objectSchema({ query: { ...text, maxLength: 200 }, paths: { type: 'array', minItems: 1, maxItems: 30, items: pathSchema } }, ['query']), (v, signal) => run.search(v.query, v.paths, signal)),
    tool('review_writing', '审校已读取资料的设定/视角冲突；问题须引用原文，有问题结束本轮等待用户。', objectSchema({ status: { enum: ['clear', 'needs_input'] }, issues: { type: 'array', maxItems: 20, items: objectSchema({ kind: { enum: ['setting', 'viewpoint', 'missing_material'] }, message: text,
      evidence: { type: 'array', maxItems: 10, items: objectSchema({ path: pathSchema, quote: text }) } }) } }), (v, signal) => run.review(v, signal)),
    tool('propose_change', '审校 clear 后提交一个候选；改写只给选区替换，续写只给尾部新增。不会保存正式稿。', objectSchema({ path: pathSchema, content: { type: 'string', maxLength: 20000 }, reason: text }), (v, signal) => run.propose(v.path, v.content, v.reason, signal)),
  ] };
}
