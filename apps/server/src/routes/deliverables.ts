import { open } from 'node:fs/promises';
import { extname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { AgentError } from '@plotloom/agent-pi';
import type { DeliverableRequest, DeliverableResult } from '@plotloom/contracts';

const imageTypes: Readonly<Record<string, string>> = {
  '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.gif': 'gif', '.webp': 'webp', '.bmp': 'bmp', '.avif': 'avif',
};
const maxPreviewBytes = 8 * 1024 * 1024;

/** 先解析当前会话的文件范围，再决定读取预览或交给系统；未识别的格式无需读取正文。 */
export function registerDeliverableRoutes(app: FastifyInstance,
  resolveFile: (id: string, path: string) => Promise<{ path: string; size: number }>,
  openExternal: (path: string) => Promise<void>) {
  app.post<{ Params: { id: string }; Body: DeliverableRequest }>('/api/sessions/:id/deliverable', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' } } },
      body: { type: 'object', additionalProperties: false, required: ['path', 'action'],
        properties: { path: { type: 'string', minLength: 1, maxLength: 1024 }, action: { enum: ['preview', 'open'] } } },
    },
  }, async ({ params, body }, reply): Promise<DeliverableResult> => {
    reply.header('Cache-Control', 'no-store');
    const { path, size } = await resolveFile(params.id, body.path);
    if (body.action === 'open') {
      await openExternal(path);
      return { kind: 'opened' };
    }
    const ext = extname(path).toLowerCase();
    const markdown = ext === '.md' || ext === '.markdown';
    const imageType = imageTypes[ext];
    if (!markdown && !imageType) return { kind: 'unsupported' };
    if (size > maxPreviewBytes) throw new AgentError(422, 'DELIVERABLE_TOO_LARGE', '文件超过 8 MiB，无法加载预览。');
    try {
      const file = await open(path, 'r');
      try {
        // 限制读取量，文件在查询大小后仍可能被外部程序修改。
        const { buffer, bytesRead } = await file.read({ buffer: Buffer.alloc(size + 1), length: size + 1 });
        if (bytesRead !== size) throw new Error('file changed');
        const bytes = buffer.subarray(0, bytesRead);
        return markdown ? { kind: 'markdown', content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
          : { kind: 'image', src: 'data:image/' + imageType + ';base64,' + bytes.toString('base64') };
      } finally { await file.close(); }
    } catch {
      throw new AgentError(422, 'DELIVERABLE_UNREADABLE', '无法读取文件预览，请检查文件是否可访问；Markdown 需要使用 UTF-8 编码。');
    }
  });
}
