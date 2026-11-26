import { useMemo } from 'react';
import type { ComponentExample } from '@plotloom/ui/workbench/catalog';
import type { WeixinAccount, WeixinLogin } from '@plotloom/contracts/im';
import { MobileAccessSettings, type MobileAccessApi } from '../../web/src/features/settings/mobile-access';

export const mobileAccessExample: ComponentExample = {
  id: 'mobile-access',
  name: '手机接入',
  category: '产品设置',
  exportPath: 'apps/web/src/features/settings/mobile-access.tsx',
  description: '连接微信，管理消息收发和自动新起会话。',
  interaction: 'api 可注入会话列表、扫码、PIN 和保存操作。预览使用模拟账号与二维码。',
  width: 700,
  height: 650,
  states: [
    { id: 'empty', name: '扫码连接', description: '选择会话并获取二维码，等待模拟确认。' },
    { id: 'pin', name: '需要 PIN', description: '获取二维码，输入 123456 模拟手机确认。' },
    { id: 'connected', name: '固定对话', description: '可切换全局接入，也可配置自动新起会话。' },
    { id: 'global', name: '全局接入', description: '查看当前目标并保存空闲时长。' },
    { id: 'idle-off', name: '空闲时间停用', description: '检查数字、单位和保存按钮对齐，可打开自动新起会话后编辑时长。' },
    { id: 'expired', name: '二维码过期', description: '生成二维码后查看过期状态和重试。' },
    { id: 'error', name: '连接加载失败', description: '检查刷新按钮和失败反馈。' },
  ],
};

/** 模拟协议状态，二维码包含示例地址，所有交互使用产品实际组件。 */
export function MobileAccessExample({ state, onAction }: { state: string; onAction: (action: string) => void }) {
  const api = useMemo<MobileAccessApi>(() => {
    let bound = state === 'connected' || state === 'global' || state === 'idle-off';
    let account: WeixinAccount = { id: 'demo-account', channel: 'weixin', botId: 'demo-bot', peerId: 'demo-peer', sessionId: 'demo-chat', mode: 'fixed',
      enabled: true, idleSessionHours: bound && state !== 'idle-off' ? 6 : null, status: 'online', hasContext: bound, createdAt: '2026-11-26T00:00:00Z' };
    if (state === 'global' || state === 'idle-off') account = { ...account, mode: 'global', target: { id: 'book-1', kind: 'novel', name: '归潮' } };
    const chats = [{ id: 'demo-chat', name: '微信日常对话', archived: false }];
    let login: WeixinLogin = { id: 'demo-login', sessionId: 'demo-chat', mode: 'fixed', status: 'waiting',
      qrContent: 'https://example.com/plotloom-preview', expiresAt: '2026-11-26T00:05:00Z' };
    let polls = 0;
    return {
      async load() {
        if (state === 'error') throw new Error('无法读取微信连接，请重试。');
        return { accounts: bound ? [account] : [], chats };
      },
      async start(input) {
        polls = 0; onAction('获取微信二维码');
        login = { ...login, mode: input.mode ?? 'fixed', sessionId: input.sessionId ?? null };
        return login;
      },
      async poll(_id, pin) {
        if (state === 'expired') return { ...login, status: 'expired' };
        if (state === 'pin' && pin !== '123456') return { ...login, status: 'pin_required' };
        if (state !== 'pin' && ++polls < 4) return { ...login, status: 'waiting' };
        bound = true;
        account = { ...account, mode: login.mode, sessionId: login.sessionId };
        return { ...login, status: 'confirmed', accountId: account.id };
      },
      async update(_id, input) {
        onAction('保存会话设置');
        account = { ...account, ...input, status: (input.enabled ?? account.enabled) ? 'online' : 'disabled' };
        if (input.mode === 'global') account.sessionId = null;
        return account;
      },
    };
  }, [state, onAction]);
  return <MobileAccessSettings api={api} />;
}
