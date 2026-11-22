import Fastify, { type FastifyError } from 'fastify';
import { AgentService, AgentError, publicError, type AgentOptions } from '@plotloom/agent-pi';
import { toolDirectory } from './tool-directory.ts';
import { registerRoutes } from './routes/agent.ts';
import { registerDeliverableRoutes } from './routes/deliverables.ts';
import { openDeliverableExternally } from './platform/open-deliverable.ts';
import { registerWorkspaceRoutes } from './routes/workspaces.ts';
import { WorkspaceService } from '@plotloom/application';
import { FileWorkspaceStore } from '@plotloom/storage';
import { WorkspaceError } from '@plotloom/domain';
import { SkillService } from '@plotloom/application/skills';
import { FileSkillRepository } from '@plotloom/storage/skills';
import { registerSkillRoutes } from './routes/skills.ts';
import { WritingService } from '@plotloom/application/writing';
import { chapterChat, recoverWritingInput, writingResources } from './writing.ts';
import type { WritingRequest } from '@plotloom/contracts/writing';
import { registerWritingRoutes } from './routes/writing.ts';
import { MessageSourceService } from '@plotloom/application/sources';
import { FileAttachmentStore } from '@plotloom/storage/sources';
import { registerSourceRoutes } from './routes/sources.ts';
import { FileProjectStore } from '@plotloom/storage/projects';
import { registerProjectRoutes } from './routes/projects.ts';
import { openRegisteredFolder } from './platform/open-folder.ts';
import { createFolderPicker, type FolderPicker } from './platform/folder-picker.ts';
import { FileAgentProfile } from '@plotloom/storage/agent-profile';
import { registerAgentProfileRoutes } from './routes/agent-profile.ts';
import { CharacterCardService } from '@plotloom/application/character-cards';
import { registerCharacterCardRoutes } from './routes/character-cards.ts';

/** 独立装配本机后端，测试和启动入口使用同一套路由与 SDK 服务。 */
export async function buildServer(options: AgentOptions & { logger?: boolean }, dependencies: {
  folderPicker?: FolderPicker; openFolder?: typeof openRegisteredFolder; openDeliverable?: typeof openDeliverableExternally;
} = {}) {
  const workspaces: WorkspaceService = new WorkspaceService(new FileWorkspaceStore(options.dataDir),
    (origin, change) => agent.recordFileWrite(origin.sessionId, change, origin.requestId));
  const characterCards = new CharacterCardService(workspaces);
  const profiles = new FileAgentProfile(options.dataDir);
  const directory = toolDirectory(options);
  let skills: SkillService;
  let writing: WritingService;
  let sources: MessageSourceService;
  const attachments = new FileAttachmentStore(options.dataDir);
  const agent = await AgentService.create({ ...options, removeAttachments: id => attachments.removeSession(id), resolveSkills: (id, explicit) => skills.snapshot(id, explicit),
    resolveNovelRoot: async id => (await workspaces.get(id)).root,
    resolveAgentProfile: () => profiles.read(),
    completeAgentBootstrap: async (input, signal) => (await profiles.update(input, { signal })) !== null,
    resolveSources: (id, text, input) => sources.resolve(id, text, input),
    recoverBusinessInput: recoverWritingInput,
    resolveResources: async (id, text, input, businessInput) => {
      if (businessInput !== undefined) return writingResources(writing, id, businessInput as WritingRequest, characterCards);
      const { workspaceId } = await agent.getSkillProfile(id);
      if (!workspaceId) return;
      const request = await chapterChat(workspaces, characterCards, workspaceId, text, input);
      return writingResources(writing, id, request, characterCards, { sources, ids: input?.attachmentIds ?? [] });
    } });
  sources = new MessageSourceService(attachments, workspaces, {
    profile: id => agent.getSkillProfile(id), messages: async id => (await agent.getSession(id)).messages,
    idle: (id, operation) => agent.withIdleSession(id, operation),
  });
  writing = new WritingService(workspaces, { profile: id => agent.getSkillProfile(id),
    recordWrite: (id, change) => agent.recordFileWrite(id, change),
    append: (id, kind, data) => agent.appendMetadata(id, kind, data), entries: (id, kind) => agent.metadata(id, kind),
    active: async id => (await agent.getSession(id)).activity === 'generating' }, characterCards);
  skills = new SkillService(new FileSkillRepository(options.dataDir), {
    create: (request, profile) => agent.createSession(request, profile), list: () => agent.listSessions(),
    profile: id => agent.getSkillProfile(id), setSkills: (id, ids) => agent.setSkills(id, ids),
    projectTools: async id => (await agent.getSession(id)).projectPath ? directory.names('project') : undefined,
  }, id => workspaces.get(id), workspaceId => workspaceId === undefined ? directory.all : directory.names(workspaceId === null ? 'project' : 'novel'));
  const app = Fastify({
    logger: options.logger ?? false, disableRequestLogging: true, bodyLimit: 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  app.setErrorHandler((error, request, reply) => {
    const httpError = error as FastifyError;
    const badRequest = !!httpError.validation || (httpError.statusCode !== undefined && [400, 413, 415].includes(httpError.statusCode));
    const statusCode = badRequest ? 400 : error instanceof AgentError || error instanceof WorkspaceError ? error.statusCode : 500;
    const detail = badRequest ? { code: 'INVALID_REQUEST', message: '请求格式或参数无效。' }
      : error instanceof WorkspaceError ? { code: error.code, message: error.message } : publicError(error);
    // 不记录原始错误、请求正文或头；供应商异常可能包含认证信息。
    request.log.warn({ requestId: request.id, code: detail.code, statusCode }, '接口请求失败');
    reply.code(statusCode).send({ error: detail });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在。' } }));
  // 本机无登录服务拒绝异站浏览器请求；P7 接入时在同源部署下使用本契约。
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && origin !== `http://${request.headers.host}`) {
      return reply.code(403).send({ error: { code: 'ORIGIN_FORBIDDEN', message: '不允许跨站访问本机服务。' } });
    }
  });
  registerRoutes(app, agent);
  registerDeliverableRoutes(app, (id, path) => agent.resolveDeliverable(id, path),
    dependencies.openDeliverable ?? openDeliverableExternally);
  registerAgentProfileRoutes(app, profiles);
  // 项目与技能共享原生选择器，防止并发打开多个系统窗口。
  const folderPicker = dependencies.folderPicker ?? createFolderPicker();
  const openFolder = dependencies.openFolder ?? openRegisteredFolder;
  registerProjectRoutes(app, new FileProjectStore(options.dataDir), folderPicker, openFolder);
  registerSourceRoutes(app, sources);
  registerWorkspaceRoutes(app, workspaces, openFolder);
  registerCharacterCardRoutes(app, characterCards);
  registerSkillRoutes(app, skills, folderPicker, directory.tools);
  registerWritingRoutes(app, agent, writing, workspaces);
  // preClose 先停止 SSE 对应生成，避免 close 等待长连接而无法进入清理阶段。
  app.addHook('preClose', () => agent.close());
  return app;
}
