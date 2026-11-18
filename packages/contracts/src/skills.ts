import type { SessionListItem } from './index.ts';

/** 技能由应用安装管理；公开协议不包含 SDK 或可执行插件。 */
export interface SkillInfo {
  id: string; name: string; description: string; version: string;
  source: 'builtin' | 'custom' | 'imported'; origin: string; updatedAt: string;
  compatibility: string; declaredTools: string[]; files: string[];
  missingTools: string[]; warnings: string[]; runnable: boolean;
}
export interface SkillFile { path: string; content: string; encoding: 'utf8' | 'base64'; version: string }
export interface SkillSettings { skillIds: string[] }
export interface SessionSkillProfile { workspaceId: string | null; skillIds: string[] | null }
export interface SkillActivation extends SessionSkillProfile {
  mode: 'inherit' | 'override'; effectiveSkillIds: string[];
  skills: SkillInfo[]; unavailable: Array<{ id: string; reason: string }>;
}
export interface ChatSummary extends SessionListItem { workspaceId: string | null }
