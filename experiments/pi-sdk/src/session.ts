import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from 'typebox';
import {
  createAgentSession,
  createExtensionRuntime,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
} from '@earendil-works/pi-coding-agent';

export const SYSTEM_PROMPT = `你是 Plotloom 的小说创作验证助手。使用简体中文。
先读取用户指定的测试资料，再根据资料给出候选；不要编造资料中不存在的事实。
候选使用 A、B 标识，输出后结束本轮，等待用户下一条消息选择。
你只拥有 read_fixture 工具，不执行命令，也不修改正文。`;

const fixturePath = fileURLToPath(new URL('../fixtures/scene.md', import.meta.url));

/** 只读固定测试材料，不接受任意路径；用于验证 SDK 工具循环，无小说业务写入。 */
export function createFixtureTool() {
  return defineTool({
    name: 'read_fixture',
    label: '读取测试资料',
    description: '读取指定测试场景，返回原文。当前唯一可用资料是 scene。',
    parameters: Type.Object({ document: Type.Literal('scene') }),
    async execute(_callId, _params, signal) {
      signal?.throwIfAborted();
      const text = await readFile(fixturePath, { encoding: 'utf8', signal });
      return { content: [{ type: 'text', text }], details: { document: 'scene' } };
    },
  });
}

/** 全显式资源加载器：不扫描工作区/用户目录，阻止编码资源意外进入创作上下文。 */
export function createResources(): ResourceLoader {
  const runtime = createExtensionRuntime();
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => SYSTEM_PROMPT,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

/** 压缩和有限重试直接使用 SDK；关闭预热，避免实验结束后产生额外模型请求。 */
export function createSettings() {
  return SettingsManager.inMemory({
    compaction: { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 },
    retry: { enabled: true, maxRetries: 2, baseDelayMs: 1000 },
    cacheWarming: 'off',
  });
}

/** 模型配置留给调用方；实验仅负责建立与个人 Pi 目录隔离的运行环境。 */
export async function createRuntime(dataDir: string) {
  const agentDir = resolve(dataDir, 'agent');
  await mkdir(agentDir, { recursive: true });
  return ModelRuntime.create({
    authPath: resolve(agentDir, 'auth.json'),
    modelsPath: null,
    modelsStorePath: resolve(agentDir, 'models-cache.json'),
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
}

export interface ExperimentSessionOptions {
  dataDir: string;
  runtime: ModelRuntime;
  provider: string;
  model: string;
  sessionFile?: string;
}

/** 新建或重开同一 JSONL 会话；不维护第二份聊天历史或步骤状态机。 */
export async function openExperimentSession(options: ExperimentSessionOptions) {
  const cwd = resolve(options.dataDir, 'workspace');
  const sessionDir = resolve(options.dataDir, 'sessions');
  await mkdir(cwd, { recursive: true });
  await mkdir(sessionDir, { recursive: true });
  const model = options.runtime.getModel(options.provider, options.model);
  if (!model) throw new Error(`未注册模型：${options.provider}/${options.model}`);
  const manager = options.sessionFile
    ? SessionManager.open(options.sessionFile, sessionDir)
    : SessionManager.create(cwd, sessionDir);
  const settings = createSettings();
  const resources = createResources();
  const result = await createAgentSession({
    cwd,
    agentDir: resolve(options.dataDir, 'agent'),
    modelRuntime: options.runtime,
    model,
    thinkingLevel: 'off',
    resourceLoader: resources,
    settingsManager: settings,
    sessionManager: manager,
    customTools: [createFixtureTool()],
    tools: ['read_fixture'],
  });
  return { ...result, manager, settings, resources, cwd, sessionDir };
}
