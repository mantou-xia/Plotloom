import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import type { AgentService } from '@plotloom/agent-pi';
import type { WorkspaceService } from '@plotloom/application';
import type { ReplyFeedbackInput } from '@plotloom/contracts';

const id = { type: 'string', minLength: 1, maxLength: 120, pattern: '^[a-zA-Z0-9-]+$' };
const feedbackParams = { type: 'object', properties: { id, turnId: id }, required: ['id', 'turnId'] };
const feedbackBody = { type: 'object', additionalProperties: false, required: ['rating', 'comment'],
  properties: { rating: { enum: ['like', 'dislike', null] }, comment: { type: 'string', maxLength: 2000 } } };

/** 仅按请求生成压缩流，日常使用沿用本地会话和版本存储，避免重复保存正文。 */
export function registerAgentUsageRoutes(app: FastifyInstance, agent: AgentService, workspaces: WorkspaceService) {
  app.put<{ Params: { id: string; turnId: string }; Body: ReplyFeedbackInput }>('/api/sessions/:id/feedback/:turnId', {
    schema: { params: feedbackParams, body: feedbackBody },
  }, request => agent.saveReplyFeedback(request.params.id, request.params.turnId, request.body));
  app.post('/api/agent-usage/export', {
    schema: { body: { type: 'object', additionalProperties: false, properties: {} } },
  }, async (_request, reply) => {
    async function* records() {
      yield JSON.stringify({ type: 'manifest', version: 1, exportedAt: new Date().toISOString() }) + '\n';
      for await (const entry of agent.usageRecords()) yield JSON.stringify(entry) + '\n';
      for await (const entry of workspaces.usageRecords()) yield JSON.stringify(entry) + '\n';
    }
    return reply.type('application/gzip').header('Cache-Control', 'no-store')
      .header('Content-Disposition', 'attachment; filename="Plotloom-agent-usage.jsonl.gz"')
      .send(Readable.from(records()).compose(createGzip()));
  });
}
