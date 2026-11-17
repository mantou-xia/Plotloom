import type { PublicError } from '@plotloom/contracts';

/** 仅允许显式业务错误越过接口边界；SDK、供应商和文件异常统一隐藏细节。 */
export class AgentError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
export const modelFailure: PublicError = { code: 'MODEL_FAILED', message: '模型生成失败，请检查本机模型配置后重试。' };
export function publicError(error: unknown): PublicError {
  return error instanceof AgentError
    ? { code: error.code, message: error.message }
    : { code: 'INTERNAL_ERROR', message: '本机服务处理失败，请检查服务日志。' };
}
