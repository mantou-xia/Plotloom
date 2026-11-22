import type { FastifyInstance } from 'fastify';
import type { CreateProjectRequest, Project, ProjectFolderSelection, ProjectUpdate } from '@plotloom/contracts';

/** 登记与原生选择均通过公开协议提供；选择取消不改变项目列表。 */
export function registerProjectRoutes(app: FastifyInstance, projects: {
  get(id: string): Promise<Project>; update(id: string, changes: ProjectUpdate): Promise<Project>;
  list(): Promise<Project[]>; create(input: CreateProjectRequest): Promise<Project>;
}, picker: { select(signal: AbortSignal): Promise<ProjectFolderSelection>; close(): void }, openFolder: (path: string) => Promise<{ opened: boolean }>) {
  app.get('/api/projects', async () => ({ projects: await projects.list() }));
  app.post<{ Body: CreateProjectRequest }>('/api/projects', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['name', 'path'], properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 }, path: { type: 'string', minLength: 1, maxLength: 2000 },
    } } },
  }, async (request, reply) => reply.code(201).send(await projects.create(request.body)));
  const params = { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' } } };
  app.put<{ Params: { projectId: string }; Body: ProjectUpdate }>('/api/projects/:projectId', {
    schema: { params, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 }, pinned: { type: 'boolean' }, sidebarHidden: { type: 'boolean' },
    } } },
  }, req => projects.update(req.params.projectId, req.body));
  app.post<{ Params: { projectId: string } }>('/api/projects/:projectId/open-folder', { schema: { params, body: { type: 'object', additionalProperties: false, properties: {} } } },
    async req => openFolder((await projects.get(req.params.projectId)).path));
  app.post('/api/projects/select-folder', {
    schema: { body: { type: 'object', additionalProperties: false, properties: {} } },
  }, async (_request, reply) => {
    const controller = new AbortController();
    // 页面关闭/取消请求时关闭对应系统窗口；正常响应 close 不算取消。
    const disconnect = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.once('close', disconnect);
    try { return await picker.select(controller.signal); }
    finally { reply.raw.off('close', disconnect); }
  });
  app.addHook('preClose', async () => picker.close());
}
