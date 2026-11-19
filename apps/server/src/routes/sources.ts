import type { FastifyInstance } from 'fastify';
import type { MessageSourceService } from '@plotloom/application/sources';
import { ATTACHMENT_TYPES, SOURCE_LIMITS, type UploadAttachmentRequest } from '@plotloom/contracts/sources';

const id = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const params = { type: 'object', required: ['id'], properties: { id } };
const fileParams = { type: 'object', required: ['id', 'attachmentId'], properties: { id, attachmentId: id } };
export const sourceProperties = {
  attachmentIds: { type: 'array', maxItems: SOURCE_LIMITS.attachmentCount, uniqueItems: true, items: id },
  references: { type: 'array', maxItems: SOURCE_LIMITS.referenceCount, items: { type: 'object', additionalProperties: false,
    required: ['workspaceId', 'path', 'version'], properties: { workspaceId: id, path: { type: 'string', minLength: 1, maxLength: 500 },
      version: { type: 'string', pattern: '^[a-f0-9]{64}$' }, selection: { type: 'object', additionalProperties: false, required: ['start', 'end', 'text'],
        properties: { start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 }, text: { type: 'string', maxLength: SOURCE_LIMITS.inputChars } } } } } },
};

/** 所有文件通过公开编码内容传输；HTTP 不读取客户端提供的本机路径。 */
export function registerSourceRoutes(app: FastifyInstance, sources: MessageSourceService): void {
  app.post<{ Params: { id: string }; Body: UploadAttachmentRequest }>('/api/sessions/:id/attachments', {
    bodyLimit: Math.ceil(SOURCE_LIMITS.imageBytes / 3) * 4 + 4096,
    schema: { params, body: { type: 'object', additionalProperties: false, required: ['name', 'mimeType', 'data'],
      properties: { name: { type: 'string', minLength: 1, maxLength: 200 }, mimeType: { type: 'string', enum: ATTACHMENT_TYPES }, data: { type: 'string', minLength: 1 } } } },
  }, async (request, reply) => reply.code(201).send(await sources.upload(request.params.id, request.body)));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/attachments', { schema: { params } }, request => sources.list(request.params.id));
  app.get<{ Params: { id: string; attachmentId: string } }>('/api/sessions/:id/attachments/:attachmentId', { schema: { params: fileParams } }, request => sources.read(request.params.id, request.params.attachmentId));
  app.delete<{ Params: { id: string; attachmentId: string } }>('/api/sessions/:id/attachments/:attachmentId', { schema: { params: fileParams } }, request => sources.remove(request.params.id, request.params.attachmentId));
}
