import type { ErrorResponse } from '@plotloom/contracts';

/** 通用公开 HTTP 协议封装；不弹提示，由操作边界决定是否反馈，后台成功保持静默。 */
export async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(path, { method, signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as ErrorResponse | null;
    throw new Error(data?.error?.message || `请求失败（${response.status}），请检查后端服务。`);
  }
  return response;
}

/** 完整读取 JSON 后再交回业务，解析失败同样由操作包装器报告。 */
export async function requestJson<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return (await request(path, method, body, signal)).json() as Promise<T>;
}
