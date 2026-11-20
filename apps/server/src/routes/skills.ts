import type { FastifyInstance } from 'fastify';
import type { SkillFolderImportResult, ToolInfo } from '@plotloom/contracts/skills';
import type { FolderPicker } from '../platform/folder-picker.ts';
import type { SkillService } from '@plotloom/application/skills';
import { THINKING_LEVELS, type CreateSessionRequest } from '@plotloom/contracts';

const id = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const ids = { type: 'array', maxItems: 50, uniqueItems: true, items: id };
const path = { type: 'string', minLength: 1, maxLength: 500 };
const content = { type: 'string', maxLength: 500000 };
const skillParams = obj({ skillId: id }); const workspaceParams = obj({ workspaceId: id }); const sessionParams = obj({ id });

/** 管理和启用通过独立用例；HTTP 不访问技能目录或 Pi JSONL。 */
export function registerSkillRoutes(app: FastifyInstance, service: SkillService, picker: FolderPicker, tools: ToolInfo[]) {
  app.get('/api/tools', () => ({ tools }));
  app.get('/api/skills', () => service.list());
  app.put<{ Params: { skillId: string }; Body: { enabled: boolean } }>('/api/skills/:skillId/enabled', {
    schema: { params: skillParams, body: obj({ enabled: { type: 'boolean' } }) },
  }, req => service.setEnabled(req.params.skillId, req.body.enabled));
  app.post<{ Body: { content: string } }>('/api/skills', { schema: { body: obj({ content }) } }, async (req, reply) => reply.code(201).send(await service.create(req.body.content)));
  // 不接收外部路径：只导入用户在本机系统窗口确认的目录，取消不写入技能库。
  app.post('/api/skills/import-folder', { schema: { body: obj({}) } }, async (_request, reply): Promise<SkillFolderImportResult> => {
    const controller = new AbortController();
    const disconnect = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.once('close', disconnect);
    try {
      const selection = await picker.select(controller.signal);
      if (controller.signal.aborted || selection.path === null) return { skill: null };
      return { skill: await service.import(selection.path) };
    } finally { reply.raw.off('close', disconnect); }
  });
  app.get<{ Params: { skillId: string } }>('/api/skills/:skillId', { schema: { params: skillParams } }, req => service.get(req.params.skillId));
  app.post<{ Params: { skillId: string }; Body: { path: string } }>('/api/skills/:skillId/file', { schema: { params: skillParams, body: obj({ path }) } }, req => service.file(req.params.skillId, req.body.path));
  app.put<{ Params: { skillId: string }; Body: { path: string; content: string; baseVersion: string } }>('/api/skills/:skillId/file', {
    schema: { params: skillParams, body: obj({ path, content, baseVersion: { type: 'string', pattern: '^[a-f0-9]{64}$' } }) },
  }, req => service.update(req.params.skillId, req.body));
  app.post<{ Params: { skillId: string }; Body: { name: string } }>('/api/skills/:skillId/copy', { schema: { params: skillParams, body: obj({ name: { type: 'string', minLength: 1, maxLength: 64 } }) } }, async (req, reply) => reply.code(201).send(await service.copy(req.params.skillId, req.body.name)));
  app.delete<{ Params: { skillId: string } }>('/api/skills/:skillId', { schema: { params: skillParams } }, req => service.delete(req.params.skillId));
  app.get<{ Params: { workspaceId: string } }>('/api/workspaces/:workspaceId/skills', { schema: { params: workspaceParams } }, req => service.workspaceSettings(req.params.workspaceId));
  app.put<{ Params: { workspaceId: string }; Body: { skillIds: string[] } }>('/api/workspaces/:workspaceId/skills', { schema: { params: workspaceParams, body: obj({ skillIds: ids }) } }, req => service.setWorkspaceSettings(req.params.workspaceId, req.body.skillIds));
  app.get<{ Params: { id: string } }>('/api/sessions/:id/skills', { schema: { params: sessionParams } }, req => service.sessionSettings(req.params.id));
  app.put<{ Params: { id: string }; Body: { skillIds: string[] | null } }>('/api/sessions/:id/skills', { schema: { params: sessionParams, body: obj({ skillIds: { anyOf: [ids, { type: 'null' }] } }) } }, req => service.setSessionSettings(req.params.id, req.body.skillIds));
  app.get('/api/chats', () => service.chats());
  app.get<{ Params: { workspaceId: string } }>('/api/workspaces/:workspaceId/sessions', { schema: { params: workspaceParams } }, req => service.chats(req.params.workspaceId));
  app.post<{ Params: { workspaceId: string }; Body: CreateSessionRequest }>('/api/workspaces/:workspaceId/sessions', {
    schema: { params: workspaceParams, body: { ...obj({ name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' }, provider: { type: 'string', minLength: 1 }, model: { type: 'string', minLength: 1 }, thinkingLevel: { type: 'string', enum: THINKING_LEVELS } }, []), dependencies: { provider: ['model'], model: ['provider'] } } },
  }, async (req, reply) => reply.code(201).send(await service.createChat(req.params.workspaceId, req.body)));
}
