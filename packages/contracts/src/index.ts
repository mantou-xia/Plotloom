import type { Attachment, DocumentReferenceContent, MessageSources } from './sources.ts';
/** 公开 HTTP / SSE 契约；这里不得导入 SDK 或后端实现类型。 */
export interface ModelSelection { provider: string; model: string }
/** 可编辑的本机自定义供应商；密钥只出现在写入请求。 */
export interface ProviderEndpoint { api: string; baseUrl: string }
export interface ProviderSettings extends ProviderEndpoint {
  id: string; models: string[]; configured: boolean;
  name?: string; avatar?: string; enabled?: boolean;
  /** 主端点由 api/baseUrl 表示；未单独指定协议的模型继承主端点。 */
  endpoints?: ProviderEndpoint[]; modelApis?: Record<string, string>;
}
export type ProviderWrite = Omit<ProviderSettings, 'configured'> & { apiKey?: string };
export const PROVIDER_APIS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const;
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
/** 正文用 Markdown 链接 `[来源](#plotloom-source-<id>)` 引用本轮工具返回的网页。 */
export const CITATION_LINK_PREFIX = '#plotloom-source-';
export interface WebCitation { id: string; title: string; url: string }
export type MessageBlock = { type: 'text' | 'thinking'; text: string } | {
  type: 'tool'; callId: string; name: string; status: 'running' | 'completed' | 'failed' | 'stopped'; text?: string;
  input?: string;
  source?: Omit<WebCitation, 'id'> & { id?: string };
} | { type: 'event'; name: 'retrying' | 'compacting'; text: string; status: 'running' | 'completed' | 'failed' | 'stopped' };
export interface Message {
  id: string;
  /** 一次用户请求的稳定 ID；过程和最终回答共用同一轮次。 */
  turnId?: string;
  /** 已结束轮次的实际耗时（秒），记录在用户消息上。 */
  elapsedSeconds?: number;
  role: 'user' | 'assistant' | 'tool';
  content: MessageBlock[];
  /** 只有 SDK 确认消息不继续调用工具后才标记 answer；首个正文增量不是最终回答依据。 */
  phase?: 'process' | 'answer';
  streaming?: boolean;
  outcome?: Outcome;
  attachments?: Attachment[];
  references?: DocumentReferenceContent[];
  /** 最终正文中已校验的本轮网页引用，按首次引用顺序去重。 */
  citations?: WebCitation[];
}
export type SessionActivity = 'idle' | 'generating' | 'configuring' | 'compacting';
export interface SessionSummary extends ModelSelection { id: string; status: SessionStatus; activity: SessionActivity; name: string; thinkingLevel: ThinkingLevel; projectPath?: string }
export interface SessionOrganization { pinned: boolean; archived: boolean }
export interface SessionListItem extends SessionSummary, SessionOrganization { updatedAt: string; archivedAt?: string }
export interface SessionDetail extends SessionSummary {
  messages: Message[];
  /** 可重放的最新用户消息。旧记录缺少请求快照时省略；忙时客户端应禁用操作。 */
  retryMessageId?: string;
}
export interface RetryMessageRequest { messageId: string }
/** 项目目录仅在创建时指定，固定到会话；省略表示普通聊天，不开放项目工具。 */
export interface CreateSessionRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel; name?: string; projectPath?: string }
export interface ProjectFiles { entries: Array<{ path: string; name: string; isDirectory: boolean }>; truncated: boolean }
/** 项目独立于聊天持久化；目录规范化且唯一，现有会话通过 projectPath 关联。 */
export interface Project { id: string; name: string; path: string; createdAt: string }
export interface CreateProjectRequest { name: string; path: string }
/** 系统选择器取消属于正常结果，不创建项目，也不覆盖调用方之前选择的目录。 */
export interface ProjectFolderSelection { path: string | null }
/** 仅修改显式传入的会话配置；自动压缩默认启用，关闭不影响手动压缩。 */
export interface SessionConfigRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel; autoCompaction?: boolean }
export interface SessionConfig extends ModelSelection { id: string; thinkingLevel: ThinkingLevel; autoCompaction: boolean; capabilities: ModelCapabilities }
/** SDK 上下文估算；压缩后尚无新回复时 tokens/percent 可为 null，不表示没有占用。 */
export interface SessionContext { id: string; status: SessionStatus; activity: SessionActivity; tokens: number | null; contextWindow: number; percent: number | null; autoCompaction: boolean }
export interface SessionStats { id: string; userMessages: number; assistantMessages: number; toolCalls: number; toolResults: number; totalMessages: number; usage?: Usage }
export interface ToolInfo { name: string; description: string; parameters: Record<string, unknown>; active: boolean }
export interface SessionTools { id: string; tools: ToolInfo[] }
export interface CompactionResult { id: string; status: 'idle'; outcome: 'completed' | 'aborted'; summary?: string; tokensBefore?: number; estimatedTokensAfter?: number; usage?: Usage }
/** 文字、附件或文档引用至少提供一项；纯附件/引用允许省略 text。 */
export interface SubmitMessageRequest extends MessageSources { text?: string; skillIds?: string[] }
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
