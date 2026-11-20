import type { FastifyInstance } from 'fastify';
import type { AgentService } from '@plotloom/agent-pi';
import { THINKING_LEVELS, type CreateSessionRequest, type ModelSettings, type SubmitMessageRequest, type SessionConfigRequest, type SessionOrganization, type RetryMessageRequest } from '@plotloom/contracts';
import { streamMessage } from '../streaming/sse.ts';
import { sourceProperties } from './sources.ts';
import type { ProviderWrite } from '@plotloom/contracts';

// 编辑和新增共用请求边界，密钥可省略，响应只确认保存结果。
const providerSchema = { body: { type: 'object', additionalProperties: false, required: ['id', 'api', 'baseUrl', 'models'],
  properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$' }, api: { type: 'string', maxLength: 100 },
    baseUrl: { type: 'string', maxLength: 2048 }, apiKey: { type: 'string', minLength: 1, maxLength: 8192 },
    name: { type: 'string', maxLength: 120 }, avatar: { type: 'string', maxLength: 360000, pattern: '^(?:|[a-zA-Z0-9_-]{1,12}|data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*)$' },
    enabled: { type: 'boolean' }, modelApis: { type: 'object', maxProperties: 500, additionalProperties: { type: 'string', maxLength: 100 } },
    endpoints: { type: 'array', maxItems: 3, items: { type: 'object', required: ['api','baseUrl'], additionalProperties: false,
      properties: { api: { type: 'string', maxLength: 100 }, baseUrl: { type: 'string', maxLength: 2048 } } } },
    models: { type: 'array', maxItems: 500, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 256 } } } } };
const discoverySchema = { body: { type: 'object', required: ['id'], additionalProperties: false,
  properties: { id: { type: 'string', minLength: 1 }, api: { type: 'string', minLength: 1 } } } };

const modelProperties = { provider: { type: 'string', minLength: 1 }, model: { type: 'string', minLength: 1 }, thinkingLevel: { type: 'string', enum: THINKING_LEVELS } };
const nameProperty = { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' };
const selectionSchema = { type: 'object', additionalProperties: false, properties: modelProperties, required: ['provider', 'model'] };
const idSchema = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' } } };

/** 所有输入在公开边界校验；HTTP 层不导入 Pi 类型或操作会话文件。 */
export function registerRoutes(app: FastifyInstance, agent: AgentService): void {
  app.get('/api/providers', async () => ({ providers: await agent.providers.list() }));
  app.post<{ Params: { providerId: string } }>('/api/providers/:providerId/credential', async (req, reply) => {
    // 仅接受明确的 JSON 操作，拒绝可由跨站表单直接提交的请求。
    reply.header('Cache-Control', 'no-store');
    if (req.headers['content-type']?.split(';')[0] !== 'application/json' || !req.body || Object.keys(req.body).length) {
      return reply.code(400).send({ error: { code: 'INVALID_REQUEST', message: '复制凭据需要空 JSON 对象。' } });
    }
    return { apiKey: await agent.providers.copyCredential(req.params.providerId) };
  });
  app.delete<{ Params: { providerId: string } }>('/api/providers/:providerId', req => agent.providers.remove(req.params.providerId));
  app.post<{ Body: { id: string; api?: string } }>('/api/providers/check', { schema: discoverySchema }, req => agent.providers.discover(req.body.id, req.body.api, true));
  app.post<{ Body: { id: string; api?: string } }>('/api/providers/discover', { schema: discoverySchema }, req => agent.providers.discover(req.body.id, req.body.api, false));
  app.post<{ Body: ProviderWrite }>('/api/providers', { schema: providerSchema }, request => agent.providers.save(request.body, true));
  app.put<{ Body: ProviderWrite }>('/api/providers', { schema: providerSchema }, request => agent.providers.save(request.body, false));
  app.get('/api/models', async () => ({ models: await agent.models() }));
  app.get('/api/model-config', () => agent.modelConfig());
  app.put<{ Body: ModelSettings }>('/api/model-config', { schema: { body: selectionSchema } }, (request) => agent.setModelConfig(request.body));
  app.post<{ Body: CreateSessionRequest }>('/api/sessions', {
    schema: { body: { type: 'object', additionalProperties: false, properties: { ...modelProperties, name: nameProperty, projectPath: { type: 'string', minLength: 1, maxLength: 2000 } },
      dependencies: { provider: ['model'], model: ['provider'] } } },
  }, async (request, reply) => {
    return reply.code(201).send(await agent.createSession(request.body));
  });
  app.put<{ Params: { id: string }; Body: Partial<SessionOrganization> }>('/api/sessions/:id/organization', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, minProperties: 1,
      properties: { pinned: { type: 'boolean' }, archived: { type: 'boolean' } } } },
  }, request => agent.organizeSession(request.params.id, request.body));
  app.delete<{ Params: { id: string } }>('/api/sessions/:id', { schema: { params: idSchema } },
    request => agent.deleteArchivedSession(request.params.id));
  app.get('/api/sessions', async () => ({ sessions: await agent.listSessions() }));
  app.get<{ Params: { id: string } }>('/api/sessions/:id', { schema: { params: idSchema } }, (request) => agent.getSession(request.params.id));
  app.post<{ Params: { id: string }; Body: { query: string } }>('/api/sessions/:id/project-files', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', maxLength: 200 } } } },
  }, (request) => agent.projectFiles(request.params.id, request.body.query));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/config', { schema: { params: idSchema } }, (request) => agent.getSessionConfig(request.params.id));
  app.put<{ Params: { id: string }; Body: SessionConfigRequest }>('/api/sessions/:id/config', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, minProperties: 1,
      properties: { ...modelProperties, autoCompaction: { type: 'boolean' } }, dependencies: { provider: ['model'], model: ['provider'] } } },
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
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false,
      anyOf: [{ required: ['text'], properties: { text: { type: 'string', minLength: 1, pattern: '\\S' } } },
        { required: ['attachmentIds'], properties: { attachmentIds: { type: 'array', minItems: 1 } } },
        { required: ['references'], properties: { references: { type: 'array', minItems: 1 } } }],
      properties: { text: { type: 'string', maxLength: 100000 }, ...sourceProperties, skillIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' } } } } },
  }, async (request, reply) => {
    const execute = await agent.prepareMessage(request.params.id, request.body.text ?? '', request.body.skillIds, undefined,
      { attachmentIds: request.body.attachmentIds, references: request.body.references });
    await streamMessage(request, reply, execute);
  });
  app.post<{ Params: { id: string }; Body: RetryMessageRequest }>('/api/sessions/:id/retry', {
    schema: { params: idSchema, body: { type: 'object', additionalProperties: false, required: ['messageId'],
      properties: { messageId: { type: 'string', minLength: 1, maxLength: 120 } } } },
  }, async (request, reply) => {
    const execute = await agent.prepareRetry(request.params.id, request.body.messageId);
    await streamMessage(request, reply, execute);
  });
  app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', { schema: { params: idSchema } }, async (request) => {
    const { id, status } = await agent.stop(request.params.id);
    return { id, status };
  });
}
