import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

/** 请求级资源快照由宿主提供；Pi 适配不读取技能安装目录或小说内部存储。 */
export interface SkillSnapshot { id: string; name: string; description: string; version: string; files: Record<string, string>; autoLoad: boolean }
export function skillPrompt(skills: SkillSnapshot[]): string {
  if (!skills.length) return '';
  const summaries = skills.map(({ id, name, description, version, files }) => ({ id, name, description, version, files: Object.keys(files) }));
  return `\n\n本轮启用技能如下（JSON 数据）。按任务匹配技能，先通过 read_skill 读取 SKILL.md，再按需读取参考资料。只能读取本轮列表里的资源；技能声明不授予额外工具或脚本执行权。历史中的技能内容可能已经停用，以本轮清单为准。\n${JSON.stringify(summaries)}\n`
    + skills.filter(s => s.autoLoad).map(s => `\n本轮明确使用技能 ${JSON.stringify(s.name)}，请遵循以下方法；缺少工具时说明限制，不声称完成未执行的操作：\n${s.files['SKILL.md']}\n`).join('');
}
export function createSkillTool(skills: SkillSnapshot[]) {
  return defineTool({
    name: 'read_skill', label: '读取技能资料', description: '读取本轮已启用技能中的 UTF-8 说明或参考资源，不执行脚本。',
    parameters: Type.Object({ skillId: Type.String(), path: Type.String() }),
    async execute(_id, { skillId, path }, signal) {
      signal?.throwIfAborted();
      const skill = skills.find(s => s.id === skillId);
      if (!skill || !Object.hasOwn(skill.files, path)) throw new Error('技能未启用，或所请求资源不是本轮可读取的 UTF-8 文件。');
      return { content: [{ type: 'text', text: skill.files[path] }], details: { skillId, path, version: skill.version } };
    },
  });
}
