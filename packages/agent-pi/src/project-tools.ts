import { randomUUID } from 'node:crypto';
import { linkSync, lstatSync, readdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, matchesGlob, relative, resolve } from 'node:path';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ToolApproval } from '@plotloom/contracts';
import type { ApprovalOutcome } from './tool-approvals.ts';

/** 专项任务可提供本轮资料视图，通用读写仍使用同一目录约束和一次性审批。 */
export interface FileToolScope {
  visible(path: string): boolean;
  read(path: string, content: string): string;
  writable(path: string): boolean;
}
export const PROJECT_TOOLS = ['read', 'grep', 'find', 'ls', 'edit', 'write'];
const maxFileBytes = 256 * 1024;
const ignoredDirectory = new Set(['node_modules', 'dist', 'build']);
const filePath = Type.String({ minLength: 1, maxLength: 1024 });
const content = Type.String({ maxLength: maxFileBytes });
const limit = Type.Optional(Type.Integer({ minimum: 1, maximum: 200 }));
export type WrittenProjectFile = Pick<ToolApproval, 'path' | 'operation'> & { before: string; after: string };
export type Approval = (callId: string, request: Pick<ToolApproval, 'operation' | 'path' | 'preview' | 'label'>, signal?: AbortSignal, requireDecision?: boolean) => Promise<ApprovalOutcome>;
const rejected = { deny: '用户拒绝', cancelled: '请求取消', expired: '审批过期' };

function contains(root: string, path: string) {
  const tail = relative(root, path);
  return !isAbsolute(tail) && !/^\.\.(?:[\\/]|$)/.test(tail);
}

function blockedName(name: string) {
  return name.startsWith('.') || /[<>:"|?*\u0000-\u001f]/u.test(name) || /[ .]$/.test(name)
    || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)
    || /(?:^|[._-])(?:secrets?|credentials?|passwords?|api[_-]?keys?)(?:[._-]|$)|\.(?:pem|key|p12|pfx)$/i.test(name);
}

/** 仅处理项目内普通文件；拒绝联接、链接、宿主私有目录及敏感名称。 */
export function projectTarget(root: string, privateRoot: string, input: string, allowMissing = false) {
  if (realpathSync(root) !== root) throw new Error('项目目录已变化，请重新选择项目。');
  const path = resolve(root, input);
  const tail = relative(root, path);
  const parts = tail.split(/[\\/]/).filter(Boolean);
  if (!contains(root, path) || contains(privateRoot, path) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(input) || parts.some(blockedName))
    throw new Error('目标不在允许的项目文件范围。');
  let next = root;
  for (const [index, part] of parts.entries()) {
    next = join(next, part);
    const entry = lstatSync(next, { throwIfNoEntry: false });
    if (!entry && allowMissing && index === parts.length - 1) return { path: next, tail };
    if (!entry || entry.isSymbolicLink() || realpathSync(next).toLowerCase() !== next.toLowerCase()
      || (!entry.isDirectory() && (!entry.isFile() || entry.nlink !== 1)))
      throw new Error('目标不存在、不是普通文件或含有链接。');
  }
  return { path: next, tail };
}

function readText(path: string): string {
  const entry = lstatSync(path);
  if (!entry.isFile() || entry.size > maxFileBytes) throw new Error('只支持读取不超过 256 KiB 的普通文本文件。');
  const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(path));
  if (value.includes('\0')) throw new Error('只支持读取 UTF-8 文本文件。');
  return value;
}

/** 搜索和列举只遍历已校验的目录，固定扫描上限避免长期阻塞本机服务。 */
function* walk(root: string, privateRoot: string, path: string, recursive: boolean) {
  const pending = [path];
  let scanned = 0;
  while (pending.length) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (++scanned > 1000) return;
      if (entry.isSymbolicLink() || blockedName(entry.name) || ignoredDirectory.has(entry.name.toLowerCase())) continue;
      const target = join(directory, entry.name);
      if (contains(privateRoot, target)) continue;
      let safe;
      try { safe = projectTarget(root, privateRoot, target); } catch { continue; }
      yield { ...safe, directory: entry.isDirectory() };
      if (recursive && entry.isDirectory()) pending.push(target);
    }
  }
}

const result = (text: string) => ({ content: [{ type: 'text' as const, text }], details: {} });
const excerpt = (text: string) => text.length > 1600 ? text.slice(0, 1600) + '\n（其余内容已省略）' : text;

/** 写入预览取自授权时点。获批后重新校验路径和内容，拒绝在变更后的文件上复用决定。 */
export function createProjectTools(root: string, privateRoot: string, approve: Approval, recordWrite: (change: WrittenProjectFile) => void, scope?: FileToolScope) {
  async function mutate(callId: string, input: string, proposed: (old: string | undefined) => string, editPreview: string | undefined, signal?: AbortSignal) {
    const edit = editPreview !== undefined;
    const target = projectTarget(root, privateRoot, input, !edit);
    const relativePath = target.tail.replaceAll('\\', '/');
    if (scope && (!scope.visible(relativePath) || !scope.writable(relativePath))) throw new Error('请通过本轮写作流程提交这份文稿。');
    const parent = lstatSync(dirname(target.path));
    const file = lstatSync(target.path, { throwIfNoEntry: false });
    const before = file ? readText(target.path) : undefined;
    const after = proposed(before);
    if (Buffer.byteLength(after) > maxFileBytes || after.includes('\0')) throw new Error('写入仅支持不超过 256 KiB 的 UTF-8 文本。');
    if (before === after) return result('文件已包含相同内容，无需写入。');
    // 展示实际变更文本，并明确预览省略；模型无法修改批准对应的内存快照。
    const operation = edit ? 'edit' : before === undefined ? 'create' : 'overwrite';
    const path = target.tail.replaceAll('\\', '/');
    const decision = await approve(callId, { operation, path,
      preview: editPreview ?? `${before === undefined ? '' : '原内容\n' + excerpt(before) + '\n\n'}写入后\n${excerpt(after)}` }, signal);
    if (decision !== 'approve') return { ...result('写入未执行：' + rejected[decision]), isError: true };
    signal?.throwIfAborted();
    const checked = projectTarget(root, privateRoot, input, !edit);
    const latestParent = lstatSync(dirname(checked.path));
    const latestFile = lstatSync(checked.path, { throwIfNoEntry: false });
    const latest = latestFile ? readText(checked.path) : undefined;
    if (checked.path !== target.path || latest !== before || latestParent.dev !== parent.dev || latestParent.ino !== parent.ino
      || latestFile?.dev !== file?.dev || latestFile?.ino !== file?.ino || latestFile?.mtimeMs !== file?.mtimeMs)
      throw new Error('审批期间目标已变更，请重新读取并请求审批。');
    const temp = join(dirname(checked.path), '.plotloom-' + randomUUID());
    try {
      writeFileSync(temp, after, { flag: 'wx', mode: file ? file.mode & 0o777 : 0o644 });
      // 创建不覆盖新出现的文件；覆盖以完整临时文件替换，避免把半写内容留作正式稿。
      if (before === undefined) linkSync(temp, checked.path);
      else renameSync(temp, checked.path);
    } finally {
      try { unlinkSync(temp); } catch { /* rename 已移走临时文件，或临时文件未创建 */ }
    }
    // 仅提交成功后记录实际前后内容。写入已生效时单独说明记录失败，避免让用户误以为文件未改。
    try { recordWrite({ path, operation, before: before ?? '', after }); }
    catch { return result('已写入 ' + target.tail + '，文件对比记录保存失败。'); }
    return result('已写入 ' + target.tail);
  }

  function readVisible(entry: { path: string; tail: string }) {
    const path = entry.tail.replaceAll('\\', '/');
    if (scope && !scope.visible(path)) throw new Error('资料不在本轮可读范围。');
    const content = readText(entry.path);
    return scope ? scope.read(path, content) : content;
  }
  const directory = (input?: string) => projectTarget(root, privateRoot, input ?? '.').path;
  return [
    defineTool({ name: 'read', label: '读取项目文件', description: '读取项目内 UTF-8 文本。', parameters: Type.Object({
      path: filePath, offset: Type.Optional(Type.Integer({ minimum: 1 })), limit,
    }), async execute(_id, input) {
      const lines = readVisible(projectTarget(root, privateRoot, input.path)).split('\n');
      const offset = (input.offset ?? 1) - 1;
      return result(lines.slice(offset, offset + (input.limit ?? 200)).join('\n').slice(0, 30000));
    } }),
    defineTool({ name: 'ls', label: '列出项目目录', description: '列出项目内目录的直接成员。', parameters: Type.Object({ path: Type.Optional(filePath), limit }),
      async execute(_id, input) {
        const entries = [];
        for (const entry of walk(root, privateRoot, directory(input.path), false)) {
          if (scope && !scope.visible(entry.tail.replaceAll('\\', '/'))) continue;
          entries.push(entry.tail + (entry.directory ? '/' : ''));
          if (entries.length >= (input.limit ?? 100)) break;
        }
        return result(entries.join('\n') || '没有可列出的成员。');
      } }),
    defineTool({ name: 'find', label: '查找项目文件', description: '按 glob 文件名模式查找项目文件。', parameters: Type.Object({ path: Type.Optional(filePath), pattern: filePath, limit }),
      async execute(_id, input) {
        const entries = [];
        for (const entry of walk(root, privateRoot, directory(input.path), true)) {
          const path = entry.tail.replaceAll('\\', '/');
          if (scope && !scope.visible(path)) continue;
          if (!entry.directory && (matchesGlob(path, input.pattern) || matchesGlob(path.split('/').at(-1)!, input.pattern))) entries.push(path);
          if (entries.length >= (input.limit ?? 100)) break;
        }
        return result(entries.join('\n') || '没有匹配文件。');
      } }),
    defineTool({ name: 'grep', label: '搜索项目文本', description: '在项目内查找普通文字，可指定 glob；pattern 按原文匹配。', parameters: Type.Object({
      path: Type.Optional(filePath), pattern: filePath, glob: Type.Optional(filePath), ignoreCase: Type.Optional(Type.Boolean()), limit,
    }), async execute(_id, input) {
      const matches: string[] = [];
      const pattern = input.ignoreCase ? input.pattern.toLowerCase() : input.pattern;
      const target = projectTarget(root, privateRoot, input.path ?? '.');
      const files = lstatSync(target.path).isDirectory() ? walk(root, privateRoot, target.path, true) : [{ ...target, directory: false }];
      for (const entry of files) {
        if (entry.directory || (input.glob && !matchesGlob(entry.tail.replaceAll('\\', '/'), input.glob))) continue;
        let text;
        try { text = readVisible(entry); } catch { continue; }
        for (const [index, line] of text.split('\n').entries()) {
          if ((input.ignoreCase ? line.toLowerCase() : line).includes(pattern)) matches.push(`${entry.tail}:${index + 1}: ${line.slice(0, 300)}`);
          if (matches.length >= (input.limit ?? 60)) return result(matches.join('\n'));
        }
      }
      return result(matches.join('\n') || '没有匹配内容。');
    } }),
    defineTool({ name: 'write', label: '写入项目文件', description: '申请创建或覆盖项目文本文件，父目录须存在。', parameters: Type.Object({ path: filePath, content }),
      execute: (id, input, signal) => mutate(id, input.path, () => input.content, undefined, signal) }),
    defineTool({ name: 'edit', label: '修改项目文件', description: '申请精确替换项目文本中的唯一匹配。', parameters: Type.Object({
      path: filePath, oldText: Type.String({ minLength: 1, maxLength: maxFileBytes }), newText: content,
    }), execute: (id, input, signal) => mutate(id, input.path, before => {
      if (!before || before.indexOf(input.oldText) < 0 || before.indexOf(input.oldText) !== before.lastIndexOf(input.oldText))
        throw new Error('原文必须恰好匹配一次。');
      return before.replace(input.oldText, () => input.newText);
    }, `替换前\n${excerpt(input.oldText)}\n\n替换后\n${excerpt(input.newText)}`, signal) }),
  ];
}
