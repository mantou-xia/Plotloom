import type { EndpointDoc, FieldDoc } from './catalog.ts';

const field = (name: string, type: string, required: boolean, description: string, example: string): FieldDoc => ({ name, type, required, description, example });
const session = field('id', 'string', true, '附件所属的会话 ID；只能在该会话读取、发送或移除。', 'session-id');
const attachmentId = field('attachmentId', 'string', true, '上传返回的附件 ID，试验台上传后自动填入。', 'attachment-id');
export const ATTACHMENT_FIELDS = [
  field('id', 'string', true, '附件唯一 ID，后续消息使用 attachmentIds 引用。', 'attachment-id'),
  field('sessionId', 'string', true, '所属会话。', 'session-id'),
  field('name', 'string', true, '原文件名，仅作显示，不作为服务器路径。', '线索.txt'),
  field('mimeType', 'string', true, 'image/png、image/jpeg、image/webp、text/plain 或 text/markdown。', 'text/plain'),
  field('size', 'number', true, '原始文件字节数，不是 base64 长度。', '5'),
  field('createdAt', 'string', true, '上传完成时间，ISO 8601。', '2026-11-19T04:00:00.000Z'),
];
export const REFERENCE_FIELDS = [
  field('workspaceId', 'string', true, '已登记工作区 ID。项目聊天可显式引用；小说聊天仅允许本书。', 'workspace-id'),
  field('path', 'string', true, '工作区内 Markdown 相对路径，沿用既有路径约束。', '角色/林舟.md'),
  field('version', 'string', true, '文档内容版本（64 位 SHA-256）；项目聊天可引用已保存历史版本，未知版本返回 404。', 'a'.repeat(64)),
  field('selection', 'object', false, '可选原文选区；不传则引用全文。', '{"start":0,"end":2,"text":"林舟"}'),
  field('selection.start', 'number', false, 'UTF-16 起点，含。', '0'), field('selection.end', 'number', false, 'UTF-16 终点，不含。', '2'),
  field('selection.text', 'string', false, '必须等于指定版本对应选区，不得切开 emoji。', '林舟'),
];
export const SOURCE_REQUEST_FIELDS = [
  field('attachmentIds', 'array', false, '当前会话附件 ID，最多 10 个，不重复、合计不超过 20 MiB；图片需模型 input 包含 image。', '["attachment-id"]'),
  field('references', 'array', false, '最多 20 个显式文档引用，同一工作区的同一路径不能重复。文字及实际引用文本合计最多 100000 字符。', '[{"workspaceId":"workspace-id","path":"角色/林舟.md","version":"替换为文档版本"}]'),
  ...REFERENCE_FIELDS.map(item => ({ ...item, name: `references[].${item.name}`, required: false })),
];
const example = { id: 'attachment-id', sessionId: 'session-id', name: '线索.txt', mimeType: 'text/plain', size: 5, createdAt: '2026-11-19T04:00:00.000Z' };
const errors = '参数错误返回 400 INVALID_REQUEST；未知会话返回 404 SESSION_NOT_FOUND；附件不存在或跨会话返回 404 ATTACHMENT_NOT_FOUND。';

export const SOURCE_CATALOG: readonly EndpointDoc[] = [
  { id: 'attachments.upload', module: 'attachments', name: '上传聊天附件', method: 'POST', path: '/api/sessions/:id/attachments', success: 201,
    description: '上传 PNG/JPEG/WebP 图片或 UTF-8 TXT/Markdown，返回可重复引用的当前会话附件 ID。',
    note: `${errors} 图片最大 10 MiB，文本最大 1 MiB；JSON base64 请求体上限约 13.34 MiB，超过 HTTP 上限返回 400。类型不符、大小超限、图片损坏或非 UTF-8 返回 422 ATTACHMENT_TYPE_UNSUPPORTED / ATTACHMENT_TOO_LARGE / ATTACHMENT_IMAGE_INVALID / ENCODING_UNSUPPORTED。不支持 PDF/Word。上传不调用模型，不自动发送消息；断开请求后可查询列表确认结果，失败可重新上传。`,
    request: [session, field('name', 'string', true, '1–200 字符文件名，不含路径；扩展名须匹配实际类型。', '线索.txt'),
      field('mimeType', 'string', true, '允许的五种 MIME 类型之一；浏览器文件选择器自动推断。', 'text/plain'),
      field('data', 'string', true, '非空原始文件的标准 base64，不含 data URL 前缀。', 'aGVsbG8=')],
    response: ATTACHMENT_FIELDS, examples: [{ name: '上传文本示例', body: { name: '线索.txt', mimeType: 'text/plain', data: 'aGVsbG8=' } }], responseExample: example },
  { id: 'attachments.list', module: 'attachments', name: '列出聊天附件', method: 'GET', path: '/api/sessions/:id/attachments', success: 200,
    description: '列出当前会话上传的附件元信息，包括已发送和未发送附件。', note: `${errors} 不返回文件编码内容；重启后可继续查询。`,
    request: [session], response: [field('attachments', 'array', true, '按上传时间排列，可为空。', '[]'), ...ATTACHMENT_FIELDS.map(item => ({ ...item, name: `attachments[].${item.name}` }))],
    examples: [], responseExample: { attachments: [example] } },
  { id: 'attachments.get', module: 'attachments', name: '读取附件内容', method: 'GET', path: '/api/sessions/:id/attachments/:attachmentId', success: 200,
    description: '读取原始附件，用于图片预览、文本阅读或下载。', note: `${errors} 返回 JSON base64，客户端按已校验的 mimeType 解码；不返回本机文件路径。`,
    request: [session, attachmentId], response: [...ATTACHMENT_FIELDS, field('data', 'string', true, '原始文件 base64，可用于 data URL 预览。', 'aGVsbG8=')],
    examples: [], responseExample: { ...example, data: 'aGVsbG8=' } },
  { id: 'attachments.delete', module: 'attachments', name: '移除未发送附件', method: 'DELETE', path: '/api/sessions/:id/attachments/:attachmentId', success: 200,
    description: '删除当前会话尚未进入消息历史的附件。', note: `${errors} 已发送附件返回 409 ATTACHMENT_IN_USE，避免历史预览失效；会话生成、配置或压缩中返回 409 SESSION_BUSY，停止或完成后重试。已删除文件再次移除返回 404。`,
    request: [session, attachmentId], response: [field('id', 'string', true, '已删除附件 ID。', example.id), field('deleted', 'boolean', true, '删除成功为 true。', 'true')],
    examples: [], responseExample: { id: example.id, deleted: true } },
];
