import type { MotionOptions, MotionController } from "./motion-runtime";
export interface ComposerSkill { id: string; name: string; description?: string }
export interface ComposerMention { kind: string; path?: string; relPath?: string; name?: string }
export interface ComposerAttachment { id: string; name: string; kind: string; status: string; dataUrl?: string; extractedText?: string }
export interface ComposerMessage { text: string; model: string; thinking: string; attachments: ComposerAttachment[]; skills: ComposerSkill[]; mentions: ComposerMention[]; permission: string }
/** 只交换 UI 数据和异步回调；接口地址、凭据、会话归属由应用负责。 */
export type DeepAgentComposerOptions = MotionOptions & {
  value?: string; onValueChange?: (value: string) => void | Promise<void>;
  thinkingOptions?: Array<{ value: string; label: string }>;
  disabled?: boolean; models?: string[]; modelLabels?: Record<string, string>; selectedModel?: string;
  /** 收起按钮使用的纯模型名称；modelLabels 仍用于菜单的完整标签。 */
  modelNames?: Record<string, string>;
  onModelChange?: (model: string) => void | Promise<void>;
  busy?: boolean; stopping?: boolean; onStop?: () => void;
  permissionOptions?: boolean; onPermissionChange?: (permission: string) => void;
  advancedMentions?: boolean; projectPath?: string; skills?: ComposerSkill[];
  onSearchFiles?: (query: string) => Promise<{ entries: Array<{ path: string; name: string; isDirectory: boolean }>; truncated: boolean }>;
  attachmentAccept?: string; maxAttachments?: number;
  onAttachmentUpload?: (input: { name: string; mimeType: string; data: string }) => Promise<{ id: string; size: number }>;
  onAttachmentRemove?: (id: string) => Promise<void>;
  context?: { tokens: number | null; contextWindow: number };
  /** 返回 false 或抛错保留输入；异步宿主应在服务端 accepted 后返回 true。 */
  onSubmit?: (message: ComposerMessage) => void | boolean | Promise<void | boolean>;
};
export function mountDeepAgentComposer(target: HTMLElement, options?: DeepAgentComposerOptions): Omit<MotionController, "update"> & { update(options: DeepAgentComposerOptions): void };
