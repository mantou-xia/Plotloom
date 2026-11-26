import { useEffect, useRef, useState } from 'react';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { NumberInput } from '@plotloom/ui/number-input';
import { Select } from '@plotloom/ui/select';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { Switch } from '@plotloom/ui/switch';
import { WEIXIN_IDLE_SESSION, type WeixinAccount, type WeixinAccountUpdate, type WeixinLogin, type WeixinLoginRequest } from '@plotloom/contracts/im';
import type { ChatSummary } from '@plotloom/contracts/skills';
import { requestJson } from '../../utils/http';
import './mobile-access.css';

const base = '/api/im/weixin';
const globalChoice = 'plotloom:global';
type Chat = Pick<ChatSummary, 'id' | 'name' | 'archived'>;
export interface MobileAccessApi {
  load(signal?: AbortSignal): Promise<{ accounts: WeixinAccount[]; chats: Chat[] }>;
  start(input: WeixinLoginRequest, signal: AbortSignal): Promise<WeixinLogin>;
  poll(loginId: string, pin: string | undefined, signal: AbortSignal): Promise<WeixinLogin>;
  update(accountId: string, input: WeixinAccountUpdate): Promise<WeixinAccount>;
}
const liveApi: MobileAccessApi = {
  async load(signal) {
    const [{ accounts }, { sessions }] = await Promise.all([
      requestJson<{ accounts: WeixinAccount[] }>(base + '/accounts', 'GET', undefined, signal),
      requestJson<{ sessions: ChatSummary[] }>('/api/chats', 'GET', undefined, signal),
    ]);
    return { accounts, chats: sessions };
  },
  start: (input, signal) => requestJson(base + '/logins', 'POST', input, signal),
  poll: (id, pin, signal) => requestJson(base + '/logins/' + encodeURIComponent(id) + '/poll', 'POST', pin ? { pin } : {}, signal),
  update: (id, input) => requestJson(base + '/accounts/' + encodeURIComponent(id), 'PUT', input),
};
const accountStatus = { connecting: '连接中', online: '已连接', disabled: '已停用', error: '连接异常', login_required: '需要重新扫码' };
const loginStatus = {
  waiting: '打开微信扫一扫，扫描此二维码。',
  scanned: '已扫码，请在手机上确认。',
  pin_required: '请输入微信显示的 PIN。',
  confirmed: '已完成微信连接。',
  expired: '二维码已过期，请重新获取。',
  already_bound: '微信提示此机器人已绑定。请检查已有连接。',
};
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。';
const validHours = (hours: number | null) => hours !== null && Number.isInteger(hours) &&
  hours >= WEIXIN_IDLE_SESSION.min && hours <= WEIXIN_IDLE_SESSION.max;

/** 产品和调试台共用设置组件，连接、聊天和状态均通过公开协议加载。 */
export function MobileAccessSettings({ api = liveApi }: { api?: MobileAccessApi }) {
  const [data, setData] = useState<Awaited<ReturnType<MobileAccessApi['load']>>>();
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.load(controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoadError(''); } },
      error => { if (!controller.signal.aborted) setLoadError(errorText(error)); });
    return () => controller.abort();
  }, [api, reload]);
  const chats = data?.chats ?? [];
  const choices = [{ value: globalChoice, label: '全局接入' },
    ...chats.filter(chat => !chat.archived).map(chat => ({ value: chat.id, label: chat.name }))];

  return <div className="plotloom-mobile-access">
    <SettingsSection title="微信" description="在手机微信中与 Plotloom 的 Agent 对话。本机服务需要保持运行。">
      <SettingsRow title="微信连接" description="扫码连接后，可以在微信里按名称切换小说和项目。">
        <div className="plotloom-mobile-actions">
          <Button variant="secondary" onClick={() => setReload(value => value + 1)}>刷新</Button>
          <Button onClick={() => setOpen(true)}>扫码连接</Button>
        </div>
      </SettingsRow>
      <p className="plotloom-mobile-feedback" role="status">{loadError || (data ? (data.accounts.length ? `已保存 ${data.accounts.length} 个微信连接` : '暂无微信连接') : '正在加载…')}</p>
    </SettingsSection>
    {data?.accounts.map(account => <ConnectionSettings key={account.id} account={account}
      chatName={account.mode === 'global' ? account.target?.name ?? '全局接入'
        : chats.find(chat => chat.id === account.sessionId)?.name ?? '未找到绑定对话'} api={api}
      onSaved={saved => setData(current => current && { ...current, accounts: current.accounts.map(item => item.id === saved.id ? saved : item) })} />)}
    {open ? <WeixinLinkDialog api={api} choices={choices} onClose={() => setOpen(false)}
      onConnected={() => setReload(value => value + 1)} /> : null}
  </div>;
}

/** 本地输入允许编辑中暂时为空，只有保存时才提交校验后的时长。 */
function ConnectionSettings({ account, chatName, api, onSaved }: {
  account: WeixinAccount; chatName: string; api: MobileAccessApi; onSaved: (account: WeixinAccount) => void;
}) {
  const enabled = account.idleSessionHours !== null;
  const [hours, setHours] = useState<number | null>(account.idleSessionHours ?? WEIXIN_IDLE_SESSION.defaultHours);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => setHours(account.idleSessionHours ?? WEIXIN_IDLE_SESSION.defaultHours), [account.idleSessionHours]);
  async function save(input: WeixinAccountUpdate) {
    setBusy(true);
    setFeedback('正在保存…');
    try { onSaved(await api.update(account.id, input)); setFeedback('已保存。'); }
    catch (error) { setFeedback(errorText(error)); }
    finally { setBusy(false); }
  }
  return <SettingsSection title="会话管理" description={`微信 · ${chatName}`}>
    <SettingsRow title="接入模式" description={account.mode === 'global'
      ? (account.target ? `当前目标是《${account.target.name}》。在微信发送“可聊什么”可查看目标。` : '在微信发送“可聊什么”可查看已登记的小说和项目。')
      : '当前使用固定对话。开启全局接入后，可在微信中切换小说和项目。'}>
      {account.mode === 'fixed' ? <Button variant="secondary" disabled={busy} onClick={() => void save({ mode: 'global' })}>切换为全局接入</Button>
        : <span>全局接入</span>}
    </SettingsRow>
    <SettingsRow title="微信收发" description={account.error?.message || accountStatus[account.status]}>
      <Switch aria-label={`启用微信收发（${chatName}）`} checked={account.enabled} disabled={busy || account.status === 'login_required'}
        onCheckedChange={value => void save({ enabled: value })} />
    </SettingsRow>
    <SettingsRow title="自动新起会话" description="超过设定时间没有微信对话，下一条普通消息会开启新会话。旧对话仍可在平台查看。">
      <Switch aria-label={`自动新起会话（${chatName}）`} checked={enabled} disabled={busy}
        onCheckedChange={value => void save({ idleSessionHours: value ? WEIXIN_IDLE_SESSION.defaultHours : null })} />
    </SettingsRow>
    <SettingsRow title="空闲时间" description="可设为 1 到 168 小时。新会话从空白上下文开始。">
      <div className="plotloom-mobile-actions">
        <div className="plotloom-mobile-duration">
          <NumberInput aria-label={`空闲小时数（${chatName}）`} min={WEIXIN_IDLE_SESSION.min} max={WEIXIN_IDLE_SESSION.max} step={1}
            value={hours} disabled={!enabled || busy} onValueChange={setHours} className="plotloom-mobile-hours" />
          <span aria-hidden="true">小时</span>
        </div>
        <Button variant="secondary" disabled={!enabled || busy || !validHours(hours) || hours === account.idleSessionHours}
          onClick={() => void save({ idleSessionHours: hours })}>保存</Button>
      </div>
    </SettingsRow>
    <p className="plotloom-mobile-feedback" role="status">{feedback}</p>
  </SettingsSection>;
}

/** 弹窗只持有当前扫码请求，关闭或换码时取消本地等待，PIN 只用于一次提交。 */
function WeixinLinkDialog({ api, choices, onClose, onConnected }: {
  api: MobileAccessApi; choices: { value: string; label: string }[]; onClose: () => void; onConnected: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(globalChoice);
  const [login, setLogin] = useState<WeixinLogin>();
  const [qr, setQr] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function begin() {
    if (!sessionId) return;
    request.current?.abort();
    const next = new AbortController();
    request.current = next;
    setBusy(true); setPolling(false); setError(''); setLogin(undefined); setQr(''); setPin('');
    try {
      const result = await api.start(sessionId === globalChoice ? { mode: 'global' } : { sessionId }, next.signal);
      const { default: QRCode } = await import('qrcode');
      const image = await QRCode.toDataURL(result.qrContent, { width: 224, margin: 4 });
      if (!next.signal.aborted) { setQr(image); setLogin(result); setPolling(true); }
    } catch (cause) { if (!next.signal.aborted) setError(errorText(cause)); }
    finally { if (!next.signal.aborted) setBusy(false); }
  }

  async function poll(signal: AbortSignal, verifyCode?: string) {
    if (!login) return;
    try {
      const result = await api.poll(login.id, verifyCode, signal);
      if (signal.aborted) return;
      setLogin(result);
      if (result.status === 'confirmed' || result.status === 'already_bound') onConnected();
      setPolling(result.status === 'waiting' || result.status === 'scanned');
    } catch (cause) {
      if (!signal.aborted) { setPolling(false); setError(errorText(cause)); }
    }
  }
  useEffect(() => {
    if (!polling || !login) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void poll(controller.signal), 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [api, login, polling]);

  async function submitPin() {
    if (!/^\d{4,12}$/.test(pin)) return;
    const next = new AbortController();
    request.current = next;
    setBusy(true); setError(''); setPin('');
    try { await poll(next.signal, pin); }
    finally { if (!next.signal.aborted) setBusy(false); }
  }
  const needsPin = login?.status === 'pin_required';
  const showQr = login && ['waiting', 'scanned', 'pin_required'].includes(login.status);
  return <Dialog open onOpenChange={value => { if (!value) onClose(); }} title="连接微信" description="全局接入支持在微信中切换小说和项目，也可绑定一个固定对话。"
    footer={<>
      <Button variant="secondary" onClick={onClose}>{login?.status === 'confirmed' ? '完成' : '关闭'}</Button>
      <Button disabled={!sessionId || busy || login?.status === 'confirmed'} onClick={() => void begin()}>{login ? '重新获取二维码' : '获取二维码'}</Button>
    </>}>
    <div className="plotloom-mobile-link">
      <Select aria-label="接入方式" options={choices} value={sessionId} disabled={busy || !!login} clearable={false} onValueChange={setSessionId} />
      <div className="plotloom-mobile-qr">
        {showQr && qr ? <img src={qr} width="224" height="224" alt="微信连接二维码" /> : null}
      </div>
      <div className="plotloom-mobile-pin" style={{ visibility: needsPin ? 'visible' : 'hidden' }}>
        <Input aria-label="微信 PIN" value={pin} onChange={event => setPin(event.currentTarget.value)} inputMode="numeric" maxLength={12} disabled={busy || !needsPin} />
        <Button variant="secondary" onClick={() => void submitPin()} disabled={!needsPin || busy || !/^\d{4,12}$/.test(pin)}>提交 PIN</Button>
      </div>
      <p className="plotloom-mobile-feedback" role="status">{error || (login ? loginStatus[login.status] : busy ? '正在获取二维码…' : '获取二维码后，请使用本人微信扫码。')}</p>
    </div>
  </Dialog>;
}
