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
/** 识别已知的供应商错误，只向客户端返回固定文案，避免泄露原始响应。 */
export function modelFailure(errorMessage?: string): PublicError {
  return {
    code: 'MODEL_FAILED',
    message: /\ball available accounts exhausted\b/i.test(errorMessage ?? '')
      ? '模型服务商当前没有可用的上游账号，请稍后重试或切换模型。'
      : '模型生成失败，请稍后重试。',
  };
}
export function publicError(error: unknown): PublicError {
  return error instanceof AgentError
    ? { code: error.code, message: error.message }
    : { code: 'INTERNAL_ERROR', message: '本机服务处理失败，请检查服务日志。' };
}
