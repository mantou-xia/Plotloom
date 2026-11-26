import type { PublicError } from './index.ts';

/** IM 只绑定现有 Agent 会话；公开响应不包含微信登录或会话令牌。 */
export interface WeixinAccount {
  id: string;
  channel: 'weixin';
  botId: string;
  peerId: string;
  sessionId: string;
  enabled: boolean;
  status: 'connecting' | 'online' | 'disabled' | 'error' | 'login_required';
  hasContext: boolean;
  createdAt: string;
  lastReceivedAt?: string;
  error?: PublicError;
}

export interface WeixinLogin {
  id: string;
  sessionId: string;
  status: 'waiting' | 'scanned' | 'pin_required' | 'confirmed' | 'expired' | 'already_bound';
  /** 编码为二维码的原文；由微信提供，仅用于本次扫码授权。 */
  qrContent: string;
  expiresAt: string;
  accountId?: string;
}

export interface ImMessage {
  id: string;
  accountId: string;
  sessionId: string;
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
export interface WeixinAccountUpdate { enabled?: boolean; sessionId?: string }
