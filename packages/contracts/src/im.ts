import type { PublicError } from './index.ts';

export interface WeixinTarget { kind: 'novel' | 'project'; id: string; name: string }
export type WeixinLoginRequest = { sessionId: string; mode?: 'fixed' } | { mode: 'global'; sessionId?: never };

/** 全局连接的当前会话可以为空，公开响应不包含微信凭据。 */
export interface WeixinAccount {
  id: string;
  channel: 'weixin';
  botId: string;
  peerId: string;
  sessionId: string | null;
  mode: 'fixed' | 'global';
  target?: WeixinTarget;
  enabled: boolean;
  idleSessionHours: number | null;
  status: 'connecting' | 'online' | 'disabled' | 'error' | 'login_required';
  hasContext: boolean;
  createdAt: string;
  lastReceivedAt?: string;
  error?: PublicError;
}

export interface WeixinLogin {
  id: string;
  sessionId: string | null;
  mode: 'fixed' | 'global';
  status: 'waiting' | 'scanned' | 'pin_required' | 'confirmed' | 'expired' | 'already_bound';
  /** 编码为二维码的原文；由微信提供，仅用于本次扫码授权。 */
  qrContent: string;
  expiresAt: string;
  accountId?: string;
}

export interface ImMessage {
  id: string;
  accountId: string;
  sessionId: string | null;
  direction: 'inbound' | 'outbound';
  kind: 'user' | 'reply' | 'notification' | 'control';
  text: string;
  /** accepted 只表示微信服务端接受；unknown 不允许自动重发。 */
  status: 'received' | 'processing' | 'completed' | 'failed' | 'interrupted' | 'sending' | 'accepted' | 'rejected' | 'unknown';
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  error?: PublicError;
}

export interface ImSendRequest { requestId: string; text: string }
export const WEIXIN_IDLE_SESSION = { min: 1, max: 168, defaultHours: 6 } as const;
export interface WeixinAccountUpdate { enabled?: boolean; sessionId?: string; mode?: 'global'; idleSessionHours?: number | null }
