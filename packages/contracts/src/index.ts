/** 公开 HTTP / SSE 契约；这里不得导入 SDK 或后端实现类型。 */
export interface ModelSelection { provider: string; model: string }
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ThinkingLevel = typeof THINKING_LEVELS[number];
export interface ModelSettings extends ModelSelection { thinkingLevel?: ThinkingLevel }
export interface ModelConfig { provider: string | null; model: string | null; configured: boolean; thinkingLevel: ThinkingLevel }
export interface ModelCapabilities { reasoning: boolean; thinkingLevels: ThinkingLevel[]; contextWindow: number; maxTokens: number; input: string[] }
export interface ModelInfo extends ModelCapabilities { provider: string; id: string; name: string; configured: boolean }
export type Outcome = 'completed' | 'aborted' | 'failed';
export type SessionStatus = 'idle' | 'running';
export interface PublicError { code: string; message: string }
export interface ErrorResponse { error: PublicError }
export type MessageBlock = { type: 'text' | 'thinking'; text: string } | {
  type: 'tool'; callId: string; name: string; status: 'running' | 'completed' | 'failed'; text?: string;
};
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: MessageBlock[];
  outcome?: Outcome;
}
export type SessionActivity = 'idle' | 'generating' | 'configuring' | 'compacting';
export interface SessionSummary extends ModelSelection { id: string; status: SessionStatus; activity: SessionActivity; name: string; thinkingLevel: ThinkingLevel }
export interface SessionListItem extends SessionSummary { updatedAt: string }
export interface SessionDetail extends SessionSummary { messages: Message[] }
export interface CreateSessionRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel; name?: string }
export interface SessionConfigRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel }
export interface SessionConfig extends ModelSelection { id: string; thinkingLevel: ThinkingLevel; capabilities: ModelCapabilities }
/** SDK 上下文估算；压缩后尚无新回复时 tokens/percent 可为 null，不表示没有占用。 */
export interface SessionContext { id: string; status: SessionStatus; activity: SessionActivity; tokens: number | null; contextWindow: number; percent: number | null; autoCompaction: boolean }
export interface SessionStats { id: string; userMessages: number; assistantMessages: number; toolCalls: number; toolResults: number; totalMessages: number; usage?: Usage }
export interface ToolInfo { name: string; description: string; parameters: Record<string, unknown>; active: boolean }
export interface SessionTools { id: string; tools: ToolInfo[] }
export interface CompactionResult { id: string; status: 'idle'; outcome: 'completed' | 'aborted'; summary?: string; tokensBefore?: number; estimatedTokensAfter?: number; usage?: Usage }
export interface SubmitMessageRequest { text: string; skillIds?: string[] }
/** 整轮 SDK 提供的 token 合计；不把配置中的占位价格当成真实账单。 */
export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number }
export type AgentEvent = { sessionId: string } & (
  | { type: 'accepted'; messageId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_start'; callId: string; name: string }
  | { type: 'tool_end'; callId: string; name: string; outcome: 'completed' | 'failed' }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'compacting'; phase: 'start' | 'end' }
  | { type: 'completed'; usage?: Usage }
  | { type: 'aborted' }
  | { type: 'failed'; error: PublicError }
);
