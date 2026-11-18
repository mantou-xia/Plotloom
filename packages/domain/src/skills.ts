import { parseDocument } from 'yaml';
import { hash, invalid, WorkspaceError } from './index.ts';

/** 普通相对资源路径，拒绝 Windows 别名和路径跳出；存储另行拒绝链接。 */
export function skillPath(path: string): void {
  if (!path || path.length > 500 || path.split('/').some(p => !p || p === '.' || p === '..' || /[\\:*?"<>|\x00-\x1f]/.test(p)
    || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) invalid('技能资源必须使用技能内的相对路径，不允许越界或别名。');
}
export function skillName(name: string): void {
  if (typeof name !== 'string' || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) invalid('技能名称应为不超过 64 字符的小写英文、数字和单个连字符。');
}
/** YAML 按数据解析，保留多行说明；声明只用于诊断，不授予工具或脚本权限。 */
export function inspectSkill(content: string) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) invalid('SKILL.md 缺少 YAML frontmatter。');
  const yaml = parseDocument(match[1]);
  if (yaml.errors.length) invalid('SKILL.md 的 YAML 格式无效。');
  let data: any;
  try { data = yaml.toJS({ maxAliasCount: 20 }); } catch { invalid('技能元信息包含过多 YAML 别名。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid('技能元信息必须是对象。');
  skillName(data.name);
  if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 1024) invalid('技能 description 不能为空且最多 1024 字符。');
  if (data.compatibility !== undefined && (typeof data.compatibility !== 'string' || data.compatibility.length > 500)) invalid('compatibility 必须是最多 500 字符的文本。');
  if (data['allowed-tools'] !== undefined && typeof data['allowed-tools'] !== 'string') invalid('allowed-tools 必须是空格分隔的工具声明。');
  return { name: data.name as string, description: data.description.trim() as string, compatibility: (data.compatibility ?? '') as string,
    declaredTools: [...new Set<string>((data['allowed-tools'] ?? '').trim().split(/\s+/).filter(Boolean))] };
}
export type SkillBundle = Record<string, string>; // 各文件的 base64 内容，二进制 assets 原样保留。
export function decodeText(base64: string): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.from(base64, 'base64')); }
  catch { throw new WorkspaceError('SKILL_BINARY_RESOURCE', '该资源不是 UTF-8 文本，请通过技能文件接口取回二进制内容。', 422); }
}
export function bundleVersion(files: SkillBundle): string {
  const paths = Object.keys(files).sort();
  if (!paths.includes('SKILL.md')) invalid('技能目录必须包含 SKILL.md。');
  if (paths.length > 500 || paths.reduce((n, p) => n + Buffer.byteLength(files[p], 'base64'), 0) > 20 * 1024 * 1024) invalid('单个技能最多 500 个文件、20 MiB。');
  const names = new Set<string>();
  const directories = new Map<string, string>();
  for (const path of paths) {
    skillPath(path);
    const key = path.toLowerCase();
    if (names.has(key)) invalid('技能资源路径存在大小写冲突。');
    names.add(key);
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const directory = parts.slice(0, i).join('/'); const canonical = directories.get(directory.toLowerCase());
      if (canonical && canonical !== directory) invalid('同一资源目录不能使用不同大小写拼写。');
      directories.set(directory.toLowerCase(), directory);
    }
  }
  if ([...directories.keys()].some(key => names.has(key))) invalid('资源路径不能同时是文件和目录。');
  return hash(JSON.stringify(paths.map(path => [path, files[path]])));
}
