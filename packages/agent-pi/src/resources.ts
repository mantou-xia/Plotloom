import { readFile } from 'node:fs/promises';
import { Type } from 'typebox';
import { createExtensionRuntime, defineTool, SettingsManager, type ResourceLoader } from '@earendil-works/pi-coding-agent';

/** 固定只读资料；参数由 SDK 校验，避免把文件系统路径暴露成公共能力。 */
export function createFixtureTool() {
  return defineTool({
    name: 'read_fixture', label: '读取测试资料',
    description: '读取测试场景原文，目前唯一资料为 scene。',
    parameters: Type.Object({ document: Type.Literal('scene') }),
    async execute(_id, _params, signal) {
      const text = await readFile(new URL('../fixtures/scene.md', import.meta.url), { encoding: 'utf8', signal });
      return { content: [{ type: 'text', text }], details: { document: 'scene' } };
    },
  });
}

/** 显式提示与资源集合，避免小说会话加载开发规则、个人技能或默认编码工具。 */
export function createResources(prompt: string): ResourceLoader {
  const runtime = createExtensionRuntime();
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => prompt, getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [],
    extendResources: () => {}, reload: async () => {},
  };
}

/** 直接使用 SDK 的压缩、有限重试和 abort，不另建执行循环。 */
export function createSettings(autoCompaction = true) {
  return SettingsManager.inMemory({
    compaction: { enabled: autoCompaction, reserveTokens: 16384, keepRecentTokens: 20000 },
    retry: { enabled: true, maxRetries: 2, baseDelayMs: 1000 },
    cacheWarming: 'off',
  });
}
