import type { FastifyInstance } from 'fastify';
import type { WorkspaceService } from '@plotloom/application';
import { NOVEL_COVER_IDS, type ExportRequest, type NovelShelfUpdate, type ProposalRequest, type SaveDocumentRequest } from '@plotloom/contracts/workspaces';

import { revealManuscript, recycleManuscript } from '../platform/manuscript-files.ts';

const path = { type: 'string', minLength: 1, maxLength: 500 };
const text = { type: 'string', maxLength: 500000 };
const id = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const version = { anyOf: [{ type: 'string', pattern: '^[a-f0-9]{64}$' }, { type: 'null' }] };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const params = obj({ workspaceId: id });
const proposalParams = obj({ workspaceId: id, proposalId: id });
const bodyPath = obj({ path });
const documentBody = obj({ path, baseVersion: version, content: text });
type WorkspaceParams = { workspaceId: string };
type ProposalParams = WorkspaceParams & { proposalId: string };

/** HTTP 仅校验协议并调用用例；任何界面均可通过这些接口独立操作 Markdown 资产。 */
export function registerWorkspaceRoutes(app: FastifyInstance, service: WorkspaceService, openFolder: (path: string) => Promise<{ opened: boolean }>): void {
  app.get('/api/workspaces', async () => ({ workspaces: await service.list() }));
  app.post<{ Body: { title: string; root: string } }>('/api/workspaces', {
    schema: { body: obj({ title: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' }, root: { type: 'string', minLength: 1, maxLength: 2000 } }) },
  }, async (req, reply) => reply.code(201).send(await service.create(req.body)));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId', { schema: { params } }, (req) => service.get(req.params.workspaceId));
  app.post<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/open-folder', { schema: { params, body: obj({}) } },
    async req => openFolder((await service.get(req.params.workspaceId)).root));
  app.put<{ Params: WorkspaceParams; Body: NovelShelfUpdate }>('/api/workspaces/:workspaceId/shelf', {
    schema: { params, body: { ...obj({ title: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' }, sidebarHidden: { type: 'boolean' }, pinned: { type: 'boolean' }, coverId: { type: 'string', enum: NOVEL_COVER_IDS } }, []), minProperties: 1 } },
  }, req => service.updateShelf(req.params.workspaceId, req.body));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/documents', { schema: { params } }, (req) => service.listDocuments(req.params.workspaceId));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/document-entries', { schema: { params } }, req => service.listEntries(req.params.workspaceId));
  app.post<{ Params: WorkspaceParams; Body: { path: string } }>('/api/workspaces/:workspaceId/document/reveal', { schema: { params, body: bodyPath } },
    req => service.revealDocument(req.params.workspaceId, req.body.path, revealManuscript));
  app.post<{ Params: WorkspaceParams; Body: { path: string; baseVersion: string } }>('/api/workspaces/:workspaceId/chapter/recycle', {
    schema: { params, body: obj({ path, baseVersion: { type: 'string', pattern: '^[a-f0-9]{64}$' } }) },
  }, req => service.recycleChapter(req.params.workspaceId, req.body.path, req.body.baseVersion, recycleManuscript));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/manuscript-stats', { schema: { params } },
    req => service.manuscriptStats(req.params.workspaceId));
  app.post<{ Params: WorkspaceParams; Body: { path: string } }>('/api/workspaces/:workspaceId/document/read', { schema: { params, body: bodyPath } }, (req) => service.read(req.params.workspaceId, req.body.path));
  app.put<{ Params: WorkspaceParams; Body: SaveDocumentRequest }>('/api/workspaces/:workspaceId/document', { schema: { params, body: documentBody } }, (req) => service.save(req.params.workspaceId, req.body));
  app.post<{ Params: WorkspaceParams; Body: { path: string } }>('/api/workspaces/:workspaceId/history', { schema: { params, body: bodyPath } }, (req) => service.history(req.params.workspaceId, req.body.path));
  app.post<{ Params: WorkspaceParams; Body: { path: string; baseVersion: string | null } }>('/api/workspaces/:workspaceId/finalize', {
    schema: { params, body: obj({ path, baseVersion: version }) },
  }, req => service.finalize(req.params.workspaceId, req.body));
  app.post<{ Params: WorkspaceParams; Body: { path: string; revisionId: string; baseVersion: string | null } }>('/api/workspaces/:workspaceId/restore', {
    schema: { params, body: obj({ path, revisionId: id, baseVersion: version }) },
  }, (req) => service.restore(req.params.workspaceId, req.body));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/proposals', { schema: { params } }, (req) => service.proposals(req.params.workspaceId));
  app.post<{ Params: WorkspaceParams; Body: ProposalRequest }>('/api/workspaces/:workspaceId/proposals', {
    schema: { params, body: obj({ path, baseVersion: version, content: text,
      selection: obj({ start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 }, text }),
      references: { type: 'array', maxItems: 100, items: obj({ path, version: { type: 'string', pattern: '^[a-f0-9]{64}$' } }) },
    }, ['path', 'baseVersion', 'content']) },
  }, async (req, reply) => reply.code(201).send(await service.createProposal(req.params.workspaceId, req.body)));
  app.get<{ Params: ProposalParams }>('/api/workspaces/:workspaceId/proposals/:proposalId', { schema: { params: proposalParams } }, (req) => service.proposal(req.params.workspaceId, req.params.proposalId));
  app.post<{ Params: ProposalParams & { changeId: string }; Body: { action: 'accept' | 'reject' } }>('/api/workspaces/:workspaceId/proposals/:proposalId/changes/:changeId', {
    schema: { params: obj({ workspaceId: id, proposalId: id, changeId: id }), body: obj({ action: { type: 'string', enum: ['accept', 'reject'] } }) },
  }, (req) => service.decide(req.params.workspaceId, req.params.proposalId, req.params.changeId, req.body.action));
  app.post<{ Params: WorkspaceParams; Body: { query: string; paths?: string[] } }>('/api/workspaces/:workspaceId/search', {
    schema: { params, body: obj({ query: { type: 'string', minLength: 1, maxLength: 1000 }, paths: { type: 'array', maxItems: 100, uniqueItems: true, items: path } }, ['query']) },
  }, (req) => service.search(req.params.workspaceId, req.body));
  app.post<{ Params: WorkspaceParams; Body: { path: string } }>('/api/workspaces/:workspaceId/chapter/export-txt', {
    schema: { params, body: bodyPath },
  }, req => service.exportChapterText(req.params.workspaceId, req.body.path));
  app.post<{ Params: WorkspaceParams; Body: ExportRequest }>('/api/workspaces/:workspaceId/export', {
    schema: { params, body: obj({ files: { type: 'array', minItems: 1, maxItems: 100, items: obj({ path, revisionId: id }, ['path']) } }) },
  }, (req) => service.export(req.params.workspaceId, req.body));
  app.post<{ Params: WorkspaceParams; Body: { destination: string } }>('/api/workspaces/:workspaceId/backup', {
    schema: { params, body: obj({ destination: { type: 'string', minLength: 1, maxLength: 2000 } }) },
  }, (req) => service.backup(req.params.workspaceId, req.body.destination));
  app.get<{ Params: WorkspaceParams }>('/api/workspaces/:workspaceId/recovery', { schema: { params } }, (req) => service.recovery(req.params.workspaceId));
  app.post<{ Params: WorkspaceParams; Body: { version: string | null } }>('/api/workspaces/:workspaceId/recovery', {
    schema: { params, body: obj({ version }) },
  }, (req) => service.keepCurrent(req.params.workspaceId, req.body.version));
}
