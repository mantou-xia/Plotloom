import type { EndpointDoc, FieldDoc } from './catalog.ts';

const f = (name: string, type: string, required: boolean, description: string, example: string): FieldDoc => ({ name, type, required, description, example });
const date = '2026-11-24T08:00:00.000Z';
const accountId = f('accountId', 'string', true, '路径参数，来自扫码确认结果或连接列表。', 'weixin-account-id');
const sessionId = f('sessionId', 'string | null', true, '当前会话 ID；全局接入尚未选择目标时为 null。', 'existing-session-id');
const fixedSession = f('sessionId', 'string', false, '固定接入使用的已有会话 ID，和全局模式二选一。', 'existing-session-id');
const mode = f('mode', 'fixed | global', true, '固定对话或全局接入。', 'global');
const account = [
  f('id', 'string', true, '本机连接 ID。', 'weixin-account-id'), f('channel', 'weixin', true, 'IM 渠道。', 'weixin'),
  f('botId', 'string', true, '微信签发的机器人 ID。', 'bot@im.bot'), f('peerId', 'string', true, '扫码者的微信用户 ID，仅允许与此用户收发。', 'owner@im.wechat'),
  sessionId, mode, f('target', 'object', false, '全局接入当前目标，选定后返回。', '{}'),
  f('target.kind', 'novel | project', false, '目标类型。', 'novel'), f('target.id', 'string', false, '平台登记的目标 ID。', 'novel-id'),
  f('target.name', 'string', false, '当前目标显示名称。', '归潮'),
  f('enabled', 'boolean', true, '是否开启收发；服务需保持运行。', 'true'),
  f('idleSessionHours', 'number | null', true, '微信对话空闲多少小时后自动新建会话，null 表示关闭。', '6'),
  f('status', 'connecting | online | disabled | error | login_required', true, '连接活动状态；online 表示本机轮询已启动，不代表消息送达。', 'online'),
  f('hasContext', 'boolean', true, '是否已有本人入站消息的上下文令牌；令牌本身不会返回。', 'false'),
  f('createdAt', 'string', true, '首次登记时间。', date), f('lastReceivedAt', 'string', false, '最近一次本人消息接收时间。', date),
  f('error', 'object', false, '连接错误的固定公开说明，包含 code 和 message。', '{"code":"IM_LOGIN_REQUIRED","message":"请重新扫码。"}'),
];
const accountExample = { id: 'weixin-account-id', channel: 'weixin', botId: 'bot@im.bot', peerId: 'owner@im.wechat',
  sessionId: null, mode: 'global', enabled: true, idleSessionHours: null, status: 'online', hasContext: false, createdAt: date };
const login = [f('id', 'string', true, '本次扫码请求 ID，服务重启后失效。', 'weixin-login-id'), sessionId, mode,
  f('status', 'waiting | scanned | pin_required | confirmed | expired | already_bound', true, 'waiting 等扫码；pin_required 需输入手机数字；confirmed 已保存并启动；expired 重新获取；already_bound 查看已有连接。', 'waiting'),
  f('qrContent', 'string', true, '微信返回的二维码原文；试验台渲染成二维码，不是机器人令牌。', 'https://weixin.qq.com/example-qr'),
  f('expiresAt', 'string', true, '本次扫码本机等待期限，最长五分钟；官方可能更早失效。', date),
  f('accountId', 'string', false, 'confirmed 时返回本机连接 ID。', 'weixin-account-id')];
const loginExample = { id: 'weixin-login-id', sessionId: null, mode: 'global', status: 'waiting', qrContent: 'https://weixin.qq.com/example-qr', expiresAt: date };
const message = [f('id', 'string', true, '本机消息 ID；发给微信时作为 client_id。', 'message-id'), accountId, sessionId,
  f('direction', 'inbound | outbound', true, '入站或出站。', 'outbound'),
  f('kind', 'user | reply | notification | control', true, '用户内容、Agent 回复、主动通知或交互控制。', 'notification'),
  f('text', 'string', true, '消息文字，不包含凭据、游标和会话令牌。', 'Plotloom 主动触达测试。'),
  f('status', 'received | processing | completed | failed | interrupted | sending | accepted | rejected | unknown', true,
    'accepted 仅表示微信接口接受，非送达或已读；rejected 明确拒绝；unknown 无法确认，不自动重发；入站 completed 表示处理结束，回复状态另查出站记录。', 'accepted'),
  f('requestId', 'string', false, '出站幂等键，同一连接下不能用于不同文字。', 'notify-20261124-1'),
  f('createdAt', 'string', true, '本机记录创建时间。', date), f('updatedAt', 'string', true, '最后状态变更时间。', date),
  f('error', 'object', false, '失败说明，包含 code 和 message；不包含微信原始错误正文。', '{"code":"IM_SEND_UNKNOWN","message":"发送结果需核查。"}')];
const messageExample = { id: 'message-id', accountId: 'weixin-account-id', sessionId: 'existing-session-id', direction: 'outbound',
  kind: 'notification', text: 'Plotloom 主动触达测试。', status: 'accepted', requestId: 'notify-20261124-1', createdAt: date, updatedAt: date };
const list = (name: string, fields: FieldDoc[]) => [f(name, 'array', true, '本机保存的公开记录。', '[]'), ...fields.map(field => ({ ...field, name: `${name}[].${field.name}` }))];

/** 与实际路由一起维护；试验台可完成本人扫码、主动发送、查询与停用的完整流程。 */
export const WEIXIN_CATALOG: EndpointDoc[] = [
  { id: 'im.weixin.login', module: 'im', name: '获取微信绑定二维码', method: 'POST', path: '/api/im/weixin/logins', success: 201,
    description: '取得本人微信扫码二维码。全局接入默认可直接普通聊天，也可切换小说和项目；固定接入使用已有对话。',
    note: '全局模式提交 mode: global。固定模式提交 sessionId。扫码后查询状态。400 参数冲突；404 会话不存在；502 微信网络或协议错误。',
    request: [{ ...mode, required: false }, fixedSession], response: login,
    examples: [{ name: '扫码全局接入', body: { mode: 'global' } }, { name: '绑定固定会话', body: { sessionId: 'existing-session-id' } }], responseExample: loginExample },
  { id: 'im.weixin.poll', module: 'im', name: '查询扫码状态或提交 PIN', method: 'POST', path: '/api/im/weixin/logins/:loginId/poll', success: 200,
    description: '每次长轮询最长约 35 秒；确认后保存私有凭据，自动开始接收本人微信文字。',
    note: 'waiting/scanned 时继续查询；pin_required 时填写手机显示的数字，再查；expired 时重新获取二维码。400 PIN 格式错误；404 登录不存在；409 重复查询、会话已被其他连接绑定；502 协议错误。PIN 不保存。',
    request: [f('loginId', 'string', true, '获取二维码返回的 id。', 'weixin-login-id'), f('pin', 'string', false, '手机要求时提交 4–12 位数字，保留开头的零。', '123456')],
    response: login, examples: [{ name: '等待扫码确认', body: {} }, { name: '提交手机 PIN', body: { pin: '123456' } }],
    responseExample: { ...loginExample, status: 'confirmed', accountId: 'weixin-account-id' } },
  { id: 'im.weixin.accounts', module: 'im', name: '列出微信连接', method: 'GET', path: '/api/im/weixin/accounts', success: 200,
    description: '查看微信连接、接入模式、当前目标、会话及连接错误。', note: '从不返回 bot token 或 context_token。新数据目录返回空列表；login_required 时重新扫码。异源请求返回 403。',
    request: [], response: list('accounts', account), examples: [], responseExample: { accounts: [accountExample] } },
  { id: 'im.weixin.update', module: 'im', name: '更新微信连接设置', method: 'PUT', path: '/api/im/weixin/accounts/:accountId', success: 200,
    description: '启停微信收发、切换接入模式或设置自动新起会话。全局模式的空闲时间按目标分别计算。',
    note: '切换全局无需扫码，首次在微信选择目标后创建对话；提交 sessionId 切为固定模式。400 空请求或同时提交 mode 和 sessionId；404 连接或会话不存在；409 会话已绑定。',
    request: [accountId, f('enabled', 'boolean', false, '是否启用连接。', 'false'), fixedSession,
      f('mode', 'global', false, '切换为全局接入。', 'global'),
      f('idleSessionHours', 'number | null', false, '1–168 的整数；null 关闭，省略保留原值。范围无效返回 400。', '6')], response: account,
    examples: [{ name: '停用收发', body: { enabled: false } }, { name: '启用收发', body: { enabled: true } }, { name: '更换会话', body: { sessionId: 'existing-session-id' } },
      { name: '切换为全局接入', body: { mode: 'global' } }, { name: '空闲 6 小时后新起会话', body: { idleSessionHours: 6 } }, { name: '关闭自动新起会话', body: { idleSessionHours: null } }], responseExample: { ...accountExample, enabled: false, status: 'disabled' } },
  { id: 'im.weixin.remove', module: 'im', name: '移除本机微信连接', method: 'DELETE', path: '/api/im/weixin/accounts/:accountId', success: 200,
    description: '停止通道并清除本机微信凭据、绑定和通道收发记录；已有 Agent 会话及其内容保留。',
    note: '仅删除本机连接，不等于撤销微信端授权；需要时在微信内管理插件授权。404 连接不存在。删除后需重新扫码。',
    request: [accountId], response: [f('removed', 'boolean', true, '本机连接已清除。', 'true')], examples: [], responseExample: { removed: true } },
  { id: 'im.weixin.messages', module: 'im', name: '查看最近收发结果', method: 'GET', path: '/api/im/weixin/accounts/:accountId/messages', success: 200,
    description: '返回该连接最近 100 条消息，按接收或创建顺序排列；处理状态和主动发送结果独立保存。',
    note: 'processing 为运行中；文件预览以 control 消息在生成结束后送出，批准或拒绝作为随后独立的入站消息记录。unknown 表示微信接受情况不明；interrupted 表示服务停止或重启。404 连接不存在。',
    request: [accountId], response: list('messages', message), examples: [], responseExample: { messages: [messageExample] } },
  { id: 'im.weixin.send', module: 'im', name: '主动发送微信文字', method: 'POST', path: '/api/im/weixin/accounts/:accountId/messages', success: 200,
    description: '无需收到新消息即可向绑定者本人发出通知，后续记账、任务等业务可调用同一接口。',
    note: 'requestId 用于防重复，同键同文返回已保存结果。HTTP 200 代表有尝试记录，须检查 status：accepted 非终端送达；rejected 明确拒绝；unknown 不自动重试。微信可能要求本人先发消息，无法保证任意时段可达。400 超过 4000 UTF-8 字节或参数无效；404 无连接；409 停用、登录失效、幂等冲突。',
    request: [accountId, f('requestId', 'string', true, '1–120 位字母、数字、下划线或短横线；同一业务事件重复调用必须沿用。', 'notify-20261124-1'),
      f('text', 'string', true, '非空有效文字，最多 4000 UTF-8 字节。', 'Plotloom 主动触达测试。')],
    response: message, examples: [{ name: '发送一次主动通知', body: { requestId: 'notify-20261124-1', text: 'Plotloom 主动触达测试。' } }], responseExample: messageExample },
];
