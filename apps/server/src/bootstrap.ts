import Fastify, { type FastifyError } from 'fastify';
import { AgentService, AgentError, publicError, type AgentOptions } from '@plotloom/agent-pi';
import { registerRoutes } from './routes/agent.ts';
import { registerWorkspaceRoutes } from './routes/workspaces.ts';
import { WorkspaceService } from '@plotloom/application';
import { FileWorkspaceStore } from '@plotloom/storage';
import { WorkspaceError } from '@plotloom/domain';
import { SkillService } from '@plotloom/application/skills';
import { FileSkillRepository } from '@plotloom/storage/skills';
import { registerSkillRoutes } from './routes/skills.ts';

/** 独立装配本机后端，测试和启动入口使用同一套路由与 SDK 服务。 */
export async function buildServer(options: AgentOptions & { logger?: boolean }) {
  const workspaces = new WorkspaceService(new FileWorkspaceStore(options.dataDir));
  let skills: SkillService;
  const agent = await AgentService.create({ ...options, resolveSkills: (id, explicit) => skills.snapshot(id, explicit) });
  skills = new SkillService(new FileSkillRepository(options.dataDir), {
    create: (request, profile) => agent.createSession(request, profile), list: () => agent.listSessions(),
    profile: id => agent.getSkillProfile(id), setSkills: (id, ids) => agent.setSkills(id, ids),
  }, id => workspaces.get(id), [...(options.tools?.map(t => t.name) ?? ['read_fixture']), 'read_skill']);
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
  registerWorkspaceRoutes(app, workspaces);
  registerSkillRoutes(app, skills);
  // preClose 先停止 SSE 对应生成，避免 close 等待长连接而无法进入清理阶段。
  app.addHook('preClose', () => agent.close());
  return app;
}
