import type { AgentEvent } from '@plotloom/contracts';
import type { EndpointDoc, FieldDoc } from '@plotloom/contracts/catalog';
import { readSseFrames } from '@plotloom/contracts/sse';

export interface CheckResult { name: string; passed: boolean; detail: string }
export interface StreamItem { event: AgentEvent; elapsedMs: number }

/** 试验台报告会话标识缺失和残帧，完整事件继续交给目录对应的检查。 */
export async function consumeSse(response: Response, receive: (event: AgentEvent) => void): Promise<void> {
  if (!response.body) throw new Error('响应没有可读取的流。');
  const remainder = await readSseFrames(response.body, (type, data) => {
    const parsed: unknown = JSON.parse(data);
    if (!isObject(parsed) || typeof parsed.sessionId !== 'string') throw new Error('SSE 事件缺少合法 sessionId。');
    receive({ ...parsed, type } as AgentEvent);
  });
  const tail = remainder.trim();
  if (tail && !tail.startsWith(':')) throw new Error('连接结束时存在不完整的 SSE 数据。');
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 根据目录字段检查响应形状；数组逐项检查，空数组合法，不用示例内容冒充实际断言。 */
export function checkFields(value: unknown, fields: readonly FieldDoc[]): CheckResult[] {
  return fields.map((field) => {
    const values = valuesAt(value, field.name.split('.'));
    const valid = values.every((item) => item === undefined ? !field.required : matchesType(item, field.type));
    return { name: field.name, passed: valid, detail: valid ? `符合 ${field.type}` : `预期 ${field.type}${field.required ? '，不可缺失' : ''}` };
  });
}

function valuesAt(value: unknown, path: string[]): unknown[] {
  if (!path.length) return [value];
  const [head, ...rest] = path;
  const array = head.endsWith('[]');
  const key = array ? head.slice(0, -2) : head;
  const next = isObject(value) ? value[key] : undefined;
  if (array) return Array.isArray(next) ? next.flatMap((item) => valuesAt(item, rest)) : [undefined];
  return valuesAt(next, rest);
}

function matchesType(value: unknown, type: string): boolean {
  return type.split(' | ').some((candidate) => {
    if (candidate === 'null') return value === null;
    if (candidate === 'array') return Array.isArray(value);
    if (candidate === 'object') return isObject(value);
    if (['string', 'boolean', 'number'].includes(candidate)) return typeof value === candidate;
    return value === candidate;
  });
}

export function checkJson(endpoint: EndpointDoc, status: number, contentType: string, body: unknown): CheckResult[] {
  return [
    { name: 'HTTP 状态', passed: status === endpoint.success, detail: `${status} / 预期 ${endpoint.success}` },
    { name: '响应格式', passed: contentType.includes('application/json'), detail: contentType || '缺少 Content-Type' },
    ...(status === endpoint.success ? checkFields(body, endpoint.response) : []),
  ];
}

/** HTTP 200 只说明流建立成功；必须检查最终事件，断流不能展示为生成完成。 */
export function checkStream(events: AgentEvent[], sessionId: string): CheckResult[] {
  const finals = events.filter((event) => ['completed', 'aborted', 'failed'].includes(event.type));
  return [
    { name: '消息接受', passed: events[0]?.type === 'accepted' && events.filter((event) => event.type === 'accepted').length === 1, detail: '首个事件为 accepted，且仅出现一次' },
    { name: '会话一致', passed: events.length > 0 && events.every((event) => event.sessionId === sessionId), detail: '所有事件属于本次请求的会话' },
    { name: '唯一结束事件', passed: finals.length === 1 && events.at(-1) === finals[0], detail: finals.length ? `${finals.length} 个最终事件：${finals.map((event) => event.type).join(', ')}` : '尚未收到完成、中断或失败事件' },
    { name: '生成结果', passed: finals[0]?.type === 'completed' || finals[0]?.type === 'aborted', detail: finals[0]?.type ?? '连接结束，生成状态未知；请查询会话' },
  ];
}
