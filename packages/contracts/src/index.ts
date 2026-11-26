import type { Attachment, DocumentReferenceContent, MessageSources } from './sources.ts';
/** 单作者的本机 Agent 人设，项目和小说共享同一份设置。 */
export const AGENT_PROFILE_LIMITS = { name: 40, style: 160, preferences: 1000 } as const;
export interface AgentPersona { name: string; style: string; preferences: string }
export interface AgentProfile extends AgentPersona { setup: 'pending' | 'skipped' | 'configured' }
export type AgentProfileUpdate = { action: 'skip' } | ({ action: 'save' } & AgentPersona);

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
export type SessionActivity = 'idle' | 'generating' | 'awaiting_approval' | 'awaiting_answer' | 'configuring' | 'compacting';
export interface SessionSummary extends ModelSelection { id: string; status: SessionStatus; activity: SessionActivity; name: string; thinkingLevel: ThinkingLevel; projectPath?: string }
export interface SessionOrganization { pinned: boolean; archived: boolean }
export interface SessionListItem extends SessionSummary, SessionOrganization { updatedAt: string; archivedAt?: string }
export interface ReplyFeedbackInput { rating: 'like' | 'dislike' | null; comment: string }
export interface ReplyFeedback extends ReplyFeedbackInput { turnId: string; updatedAt: string }
export interface SessionDetail extends SessionSummary {
  manuscriptRequest?: { id: string; createdAt: string; view: import('./workspaces.ts').ManuscriptView };
  messages: Message[];
  /** 当前轮尚可决定的项目写入。刷新后从详情重新读取。 */
  pendingApprovals?: ToolApproval[];
  /** 当前轮正在等待的选择题；刷新后从详情恢复。 */
  pendingQuestion?: AgentQuestion;
  /** 成功写入的已结束轮次；没有记录时省略。 */
  fileChanges?: TurnFileChanges[];
  /** 每轮最新的本地评价；空评价不在此列表显示。 */
  feedback?: ReplyFeedback[];
  /** 可重放的最新用户消息。旧记录缺少请求快照时省略；忙时客户端应禁用操作。 */
  retryMessageId?: string;
}
export type FileApprovalTarget = Pick<ToolApproval, 'path' | 'operation' | 'label'>;
export interface ToolApproval {
  /** 小说专属操作的标题，例如导入章节或提交重写候选。 */
  label?: string;
  id: string;
  turnId: string;
  callId: string;
  operation: 'create' | 'overwrite' | 'edit';
  path: string;
  preview: string;
  expiresAt: string;
}
export type ToolApprovalDecision = 'approve' | 'deny';
export interface AgentQuestion {
  id: string;
  callId: string;
  question: string;
  options: string[];
}
export type AgentQuestionAnswer =
  | { kind: 'option'; index: number }
  | { kind: 'custom'; text: string }
  | { kind: 'skip' };
export interface RetryMessageRequest { messageId: string }
export interface CreateSessionRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel; name?: string }
/** 项目目录随会话创建固定；小说通过工作区入口创建。 */
export interface CreateProjectSessionRequest extends CreateSessionRequest { projectPath: string }
export type CreateChatSessionRequest = CreateProjectSessionRequest | (CreateSessionRequest & { mode: 'general' });

/** 文件路径相对于当前会话的项目或小说目录。 */
export interface DeliverableRequest { path: string; action: 'preview' | 'open' }
export type DeliverableResult =
  | { kind: 'markdown'; content: string }
  | { kind: 'image'; src: string }
  | { kind: 'unsupported' | 'opened' };
export interface ProjectFiles { entries: Array<{ path: string; name: string; isDirectory: boolean }>; truncated: boolean }
/** 一次成功的 Agent 文件写入。同一路径的多次写入各有独立记录。 */
export interface ProjectFileChange {
  id: string;
  path: string;
  operation: ToolApproval['operation'];
  createdAt: string;
}
export interface TurnFileChanges {
  turnId: string;
  files: Array<{
    path: string;
    added: number | null;
    removed: number | null;
    writeIds: string[];
  }>;
}
export interface ProjectDiffBlock {
  kind: 'context' | 'added' | 'removed';
  beforeStart: number | null;
  afterStart: number | null;
  lines: string[];
}
export interface ProjectFileDiff extends ProjectFileChange {
  added: number;
  removed: number;
  blocks: ProjectDiffBlock[];
}
/** 项目独立于聊天持久化；目录规范化且唯一，现有会话通过 projectPath 关联。 */
export interface Project { id: string; name: string; path: string; createdAt: string; pinned?: boolean; sidebarHidden?: boolean }
export type ProjectUpdate = Partial<Pick<Project, 'name' | 'pinned' | 'sidebarHidden'>>;
export interface CreateProjectRequest { name: string; path: string }
/** 系统选择器取消属于正常结果，不创建项目，也不覆盖调用方之前选择的目录。 */
export interface ProjectFolderSelection { path: string | null }
/** 仅修改显式传入的会话配置；自动压缩默认启用，关闭不影响手动压缩。 */
export const PROJECT_APPROVAL_MODES = ['required', 'full_access'] as const;
export type ProjectApprovalMode = typeof PROJECT_APPROVAL_MODES[number];
export interface SessionConfigRequest { provider?: string; model?: string; thinkingLevel?: ThinkingLevel; autoCompaction?: boolean; projectApprovalMode?: ProjectApprovalMode }
export interface SessionConfig extends ModelSelection { id: string; thinkingLevel: ThinkingLevel; autoCompaction: boolean; capabilities: ModelCapabilities; projectApprovalMode?: ProjectApprovalMode }
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
  | { type: 'tool_approval_required'; approval: ToolApproval }
  | { type: 'user_answer_required'; question: AgentQuestion }
  | { type: 'tool_end'; callId: string; name: string; outcome: 'completed' | 'failed'; manuscriptView?: import('./workspaces.ts').ManuscriptView }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'compacting'; phase: 'start' | 'end' }
  | { type: 'completed'; usage?: Usage }
  | { type: 'aborted' }
  | { type: 'failed'; error: PublicError }
);
