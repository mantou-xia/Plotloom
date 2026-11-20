import type { ExecutionEntry } from '../execution-timeline/types.ts';
import type { ToolCallData } from '../tool-call/tool-call-item.tsx';

const tool: ToolCallData = { name: 'read', summary: '读取项目说明', status: 'completed', input: '{ "path": "README.md" }', output: '# 项目说明\n使用公开接口连接前后端。' };
const mixed: ExecutionEntry[] = [
  { id: 'think-1', type: 'thinking', content: '先核对项目已有约定，再定位需要调整的部分。' },
  { id: 'message-1', type: 'message', content: '我先查看项目说明和目录结构。' },
  { id: 'read-1', type: 'tool', ...tool },
  { id: 'think-2', type: 'thinking', content: '资料已经齐全，可以据此整理修改步骤。' },
  { id: 'edit-1', type: 'tool', name: 'edit', summary: '更新组件实现', status: 'completed', input: '{ "path": "component.tsx" }', output: '已更新 1 个文件。' },
  { id: 'message-2', type: 'message', content: '修改完成，开始验证。' },
  { id: 'test-1', type: 'tool', name: 'shell', summary: '运行类型检查', status: 'running', input: 'pnpm typecheck', output: '正在检查类型…' },
];
const long: ExecutionEntry[] = Array.from({ length: 12 }, (_, i) => mixed.map(item => ({ ...item, id: `${item.id}-${i}` }))).flat();
const events: ExecutionEntry[] = [
  { id: 'retry', type: 'event', title: '请求重试', description: '第一次请求超时，正在重试', status: 'running', content: '已等待 2 秒。' },
  { id: 'compact', type: 'event', title: '上下文整理', description: '已保留任务目标与关键发现', status: 'completed', content: '保留摘要，继续当前任务。' },
];
/** 全部为本地展示数据；记录顺序与 id 模拟公开事件，组件不补造模型内容。 */
export const processSamples: Record<string, ExecutionEntry[]> = {
  default: mixed, streaming: mixed.slice(0, 2), long,
  'no-thinking': mixed.filter(item => item.type !== 'thinking'),
  events: [...mixed.slice(0, 3), ...events, ...mixed.slice(3)],
  answering: mixed.map(item => item.type === 'tool' ? { ...item, status: 'completed' } : item),
  completed: mixed.map(item => item.type === 'tool' ? { ...item, status: 'completed' } : item),
  failed: [...mixed.slice(0, -1), { ...mixed[6], type: 'tool', id: 'test-1', name: 'shell', status: 'failed', summary: '类型检查失败', output: 'component.tsx: 类型不匹配。' }],
  stopped: [...mixed.slice(0, -1), { id: 'stop', type: 'event', title: '用户停止任务', description: '保留已完成的工作记录', status: 'stopped' }],
  empty: [],
};
export const toolSamples: Record<string, ToolCallData> = {
  default: tool, running: { ...tool, status: 'running', output: '正在读取…' },
  failed: { ...tool, status: 'failed', output: '文件读取失败：访问被拒绝。' },
  stopped: { ...tool, status: 'stopped', output: '操作已停止。' },
  empty: { ...tool, output: '' }, long: { ...tool, output: Array.from({ length: 50 }, (_, i) => `${i + 1}: 示例工具原始结果 <script>不执行</script>`).join('\n') },
  'no-details': { name: 'notify', summary: '记录任务进度', status: 'completed' },
  'visited-page': { name: 'browser', status: 'completed', source: { title: '示例网页', url: 'https://example.com/' } },
};
