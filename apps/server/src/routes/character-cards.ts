import type { FastifyInstance } from 'fastify';
import type { CharacterCardCreateRequest } from '@plotloom/contracts/character-cards';
import type { CharacterCardService } from '@plotloom/application/character-cards';

const id = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const path = { type: 'string', minLength: 1, maxLength: 500 };
const params = { type: 'object', properties: { workspaceId: id }, required: ['workspaceId'], additionalProperties: false };

/** 角色卡接口只返回公开 Markdown 和阶段元数据，聊天与页面可独立调用。 */
export function registerCharacterCardRoutes(app: FastifyInstance, service: CharacterCardService): void {
  app.get<{ Params: { workspaceId: string }; Querystring: { chapter?: string; character?: string } }>('/api/workspaces/:workspaceId/character-cards', {
    schema: { params, querystring: { type: 'object', properties: { chapter: { type: 'string', pattern: '^[1-9]\\d{0,5}$' }, character: { type: 'string', minLength: 1, maxLength: 100 } }, additionalProperties: false } },
  }, req => service.list(req.params.workspaceId, req.query.chapter ? Number(req.query.chapter) : undefined, req.query.character));
  app.post<{ Params: { workspaceId: string }; Body: CharacterCardCreateRequest }>('/api/workspaces/:workspaceId/character-cards', {
    schema: { params, body: { type: 'object', properties: { character: { type: 'string', minLength: 1, maxLength: 100 }, chapter: { type: 'integer', minimum: 1, maximum: 999999 }, note: { type: 'string', maxLength: 200 }, content: { type: 'string', minLength: 1, maxLength: 500000 }, evidence: { type: 'object', properties: { path, quote: { type: 'string', minLength: 1, maxLength: 300 } }, required: ['path', 'quote'], additionalProperties: false } }, required: ['character', 'chapter', 'content'], additionalProperties: false } },
  }, async (req, reply) => reply.code(201).send(await service.create(req.params.workspaceId, req.body)));
  app.post<{ Params: { workspaceId: string }; Body: { path: string } }>('/api/workspaces/:workspaceId/character-cards/read', {
    schema: { params, body: { type: 'object', properties: { path }, required: ['path'], additionalProperties: false } },
  }, req => service.read(req.params.workspaceId, req.body.path));
}
