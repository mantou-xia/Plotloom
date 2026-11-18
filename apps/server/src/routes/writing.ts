import type { FastifyInstance } from 'fastify';
import type { AgentService } from '@plotloom/agent-pi';
import type { WorkspaceService } from '@plotloom/application';
import type { WritingService } from '@plotloom/application/writing';
import type { WritingRequest } from '@plotloom/contracts/writing';
import type { SaveDocumentRequest } from '@plotloom/contracts/workspaces';
import { objectSchema, pathSchema, writingResources, writingSchema } from '../writing.ts';
import { streamMessage } from '../streaming/sse.ts';

const id = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const sessionParams = objectSchema({ id });
/** 保存用户大纲与生成 AI 候选分开，所有创作仍经统一会话互斥及 SSE。 */
export function registerWritingRoutes(app: FastifyInstance, agent: AgentService, service: WritingService, workspaces: WorkspaceService) {
  app.post<{ Params: { workspaceId: string }; Body: SaveDocumentRequest }>('/api/workspaces/:workspaceId/outlines', {
    schema: { params: objectSchema({ workspaceId: id }), body: objectSchema({ path: pathSchema, content: { type: 'string', minLength: 1, maxLength: 500000, pattern: '\\S' }, baseVersion: { anyOf: [{ type: 'string', pattern: '^[a-f0-9]{64}$' }, { type: 'null' }] } }) },
  }, req => workspaces.save(req.params.workspaceId, req.body));
  app.post<{ Params: { id: string }; Body: WritingRequest }>('/api/sessions/:id/writing/context', { schema: { params: sessionParams, body: writingSchema } }, req => service.context(req.params.id, req.body));
  app.post<{ Params: { id: string }; Body: WritingRequest }>('/api/sessions/:id/writing/messages', { schema: { params: sessionParams, body: writingSchema } }, async (req, reply) => {
    const execute = await agent.prepareMessage(req.params.id, req.body.instructions, req.body.skillIds, () => writingResources(service, req.params.id, req.body));
    await streamMessage(req, reply, execute);
  });
  app.get<{ Params: { id: string } }>('/api/sessions/:id/writing', { schema: { params: sessionParams } }, req => service.records(req.params.id));
}
