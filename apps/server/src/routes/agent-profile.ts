import type { FastifyInstance } from 'fastify';
import { AGENT_PROFILE_LIMITS, type AgentProfileUpdate } from '@plotloom/contracts';
import type { FileAgentProfile } from '@plotloom/storage/agent-profile';

const textFields = Object.fromEntries(Object.entries(AGENT_PROFILE_LIMITS)
  .map(([key, maxLength]) => [key, { type: 'string', maxLength }]));

/** 首用引导与设置页使用同一个本机接口，模型和会话都无需提前创建。 */
export function registerAgentProfileRoutes(app: FastifyInstance, profiles: FileAgentProfile) {
  app.get('/api/agent-profile', () => profiles.read());
  app.put<{ Body: AgentProfileUpdate }>('/api/agent-profile', {
    schema: { body: { type: 'object', oneOf: [
      { additionalProperties: false, required: ['action'], properties: { action: { const: 'skip' } } },
      { additionalProperties: false, required: ['action', ...Object.keys(textFields)],
        properties: { action: { const: 'save' }, ...textFields } },
    ] } },
  }, req => profiles.update(req.body));
}
