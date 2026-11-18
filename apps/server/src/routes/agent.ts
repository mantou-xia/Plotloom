import type { FastifyInstance } from 'fastify';
import type { AgentService } from '@plotloom/agent-pi';
import { THINKING_LEVELS, type CreateSessionRequest, type ModelSettings, type SubmitMessageRequest, type SessionConfigRequest } from '@plotloom/contracts';
import { streamMessage } from '../streaming/sse.ts';

const modelProperties = { provider: { type: 'string', minLength: 1 }, model: { type: 'string', minLength: 1 }, thinkingLevel: { type: 'string', enum: THINKING_LEVELS } };
const nameProperty = { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' };
const selectionSchema = { type: 'object', additionalProperties: false, properties: modelProperties, required: ['provider', 'model'] };
const idSchema = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' } } };

/** 所有输入在公开边界校验；HTTP 层不导入 Pi 类型或操作会话文件。 */
export function registerRoutes(app: FastifyInstance, agent: AgentService): void {
  app.get('/api/models', async () => ({ models: await agent.models() }));
  app.get('/api/model-config', () => agent.modelConfig());
  app.put<{ Body: ModelSettings }>('/api/model-config', { schema: { body: selectionSchema } }, (request) => agent.setModelConfig(request.body));
  app.post<{ Body: CreateSessionRequest }>('/api/sessions', {
    schema: { body: { type: 'object', additionalProperties: false, properties: { ...modelProperties, name: nameProperty },
      dependencies: { provider: ['model'], model: ['provider'] } } },
  }, async (request, reply) => {
    return reply.code(201).send(await agent.createSession(request.body));
  });
  app.get('/api/sessions', async () => ({ sessions: await agent.listSessions() }));
  app.get<{ Params: { id: string } }>('/api/sessions/:id', { schema: { params: idSchema } }, (request) => agent.getSession(request.params.id));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/config', { schema: { params: idSchema } }, (request) => agent.getSessionConfig(request.params.id));
  app.put<{ Params: { id: string }; Body: SessionConfigRequest }>('/api/sessions/:id/config', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, minProperties: 1,
      properties: modelProperties, dependencies: { provider: ['model'], model: ['provider'] } } },
  }, (request) => agent.setSessionConfig(request.params.id, request.body));
  app.put<{ Params: { id: string }; Body: { name: string } }>('/api/sessions/:id/name', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: nameProperty } } },
  }, (request) => agent.renameSession(request.params.id, request.body.name));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/context', { schema: { params: idSchema } }, (request) => agent.getContext(request.params.id));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/stats', { schema: { params: idSchema } }, (request) => agent.getStats(request.params.id));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/tools', { schema: { params: idSchema } }, (request) => agent.getTools(request.params.id));
  app.post<{ Params: { id: string }; Body: { instructions?: string } }>('/api/sessions/:id/compact', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false,
      properties: { instructions: { type: 'string', maxLength: 2000 } } } },
  }, (request) => agent.compact(request.params.id, request.body.instructions));
  app.post<{ Params: { id: string } }>('/api/sessions/:id/compact/stop', { schema: { params: idSchema } }, (request) => agent.stopCompaction(request.params.id));
  app.post<{ Params: { id: string }; Body: SubmitMessageRequest }>('/api/sessions/:id/messages', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, required: ['text'],
      properties: { text: { type: 'string', minLength: 1, maxLength: 100000, pattern: '\\S' }, skillIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' } } } } },
  }, async (request, reply) => {
    const execute = await agent.prepareMessage(request.params.id, request.body.text, request.body.skillIds);
    await streamMessage(request, reply, execute);
  });
  app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', { schema: { params: idSchema } }, async (request) => {
    const { id, status } = await agent.stop(request.params.id);
    return { id, status };
  });
}
