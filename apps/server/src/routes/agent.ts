import type { FastifyInstance } from 'fastify';
import type { AgentService } from '@plotloom/agent-pi';
import type { CreateSessionRequest, ModelSelection, SubmitMessageRequest } from '@plotloom/contracts';
import { streamMessage } from '../streaming/sse.ts';

const modelProperties = { provider: { type: 'string', minLength: 1 }, model: { type: 'string', minLength: 1 } };
const selectionSchema = { type: 'object', additionalProperties: false, properties: modelProperties, required: ['provider', 'model'] };
const idSchema = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' } } };

/** 所有输入在公开边界校验；HTTP 层不导入 Pi 类型或操作会话文件。 */
export function registerRoutes(app: FastifyInstance, agent: AgentService): void {
  app.get('/api/models', async () => ({ models: await agent.models() }));
  app.get('/api/model-config', () => agent.modelConfig());
  app.put<{ Body: ModelSelection }>('/api/model-config', { schema: { body: selectionSchema } }, (request) => agent.setModelConfig(request.body));
  app.post<{ Body: CreateSessionRequest }>('/api/sessions', {
    schema: { body: { type: 'object', additionalProperties: false, properties: modelProperties,
      dependencies: { provider: ['model'], model: ['provider'] } } },
  }, async (request, reply) => {
    const { provider, model } = request.body;
    return reply.code(201).send(await agent.createSession(provider && model ? { provider, model } : undefined));
  });
  app.get('/api/sessions', async () => ({ sessions: await agent.listSessions() }));
  app.get<{ Params: { id: string } }>('/api/sessions/:id', { schema: { params: idSchema } }, (request) => agent.getSession(request.params.id));
  app.post<{ Params: { id: string }; Body: SubmitMessageRequest }>('/api/sessions/:id/messages', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, required: ['text'],
      properties: { text: { type: 'string', minLength: 1, maxLength: 100000, pattern: '\\S' } } } },
  }, async (request, reply) => {
    const execute = await agent.prepareMessage(request.params.id, request.body.text);
    await streamMessage(request, reply, execute);
  });
  app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', { schema: { params: idSchema } }, async (request) => {
    const { id, status } = await agent.stop(request.params.id);
    return { id, status };
  });
}
