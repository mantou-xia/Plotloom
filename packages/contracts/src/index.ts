/** 公开 HTTP / SSE 契约；这里不得导入 SDK 或后端实现类型。 */
export interface ModelSelection { provider: string; model: string }
export interface ModelConfig { provider: string | null; model: string | null; configured: boolean }
export interface ModelInfo { provider: string; id: string; name: string; configured: boolean }
export type Outcome = 'completed' | 'aborted' | 'failed';
export type SessionStatus = 'idle' | 'running';
export interface PublicError { code: string; message: string }
export interface ErrorResponse { error: PublicError }
export type MessageBlock = { type: 'text'; text: string } | {
  type: 'tool'; callId: string; name: string; status: 'running' | 'completed' | 'failed'; text?: string;
};
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: MessageBlock[];
  outcome?: Outcome;
}
export interface SessionSummary extends ModelSelection { id: string; status: SessionStatus }
export interface SessionListItem extends SessionSummary { updatedAt: string }
export interface SessionDetail extends SessionSummary { messages: Message[] }
export interface CreateSessionRequest { provider?: string; model?: string }
export interface SubmitMessageRequest { text: string }
/** 整轮 SDK 提供的 token 合计；不把配置中的占位价格当成真实账单。 */
export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number }
export type AgentEvent = { sessionId: string } & (
  | { type: 'accepted'; messageId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; callId: string; name: string }
  | { type: 'tool_end'; callId: string; name: string; outcome: 'completed' | 'failed' }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'compacting'; phase: 'start' | 'end' }
  | { type: 'completed'; usage?: Usage }
  | { type: 'aborted' }
  | { type: 'failed'; error: PublicError }
);
