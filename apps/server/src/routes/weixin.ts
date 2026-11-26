import type { FastifyInstance } from 'fastify';
import type { WeixinService } from '@plotloom/application/weixin';
import { WEIXIN_IDLE_SESSION, type ImSendRequest, type WeixinAccountUpdate, type WeixinLoginRequest } from '@plotloom/contracts/im';

const resourceId = { type: 'string', pattern: '^[a-zA-Z0-9-]{1,80}$' };
const params = (name: string) => ({ type: 'object', required: [name], additionalProperties: false, properties: { [name]: resourceId } });

/** 公开业务接口只暴露连接投影和消息结果；凭据、游标与 context_token 从不出现在响应中。 */
export function registerWeixinRoutes(app: FastifyInstance, weixin: WeixinService) {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/im/weixin/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.post<{ Body: WeixinLoginRequest }>('/api/im/weixin/logins', {
    schema: { body: { type: 'object', additionalProperties: false, properties: {
      sessionId: resourceId, mode: { enum: ['fixed', 'global'] },
    }, oneOf: [
      { required: ['sessionId'], properties: { mode: { const: 'fixed' } } },
      { required: ['mode'], properties: { mode: { const: 'global' } }, not: { required: ['sessionId'] } },
    ] } },
  }, async (request, reply) => reply.code(201).send(await weixin.createLogin(request.body)));
  app.post<{ Params: { loginId: string }; Body: { pin?: string } }>('/api/im/weixin/logins/:loginId/poll', {
    schema: { params: params('loginId'), body: { type: 'object', additionalProperties: false,
      properties: { pin: { type: 'string', pattern: '^[0-9]{4,12}$' } } } },
  }, request => weixin.pollLogin(request.params.loginId, request.body.pin));
  app.get('/api/im/weixin/accounts', async () => ({ accounts: await weixin.list() }));
  app.put<{ Params: { accountId: string }; Body: WeixinAccountUpdate }>('/api/im/weixin/accounts/:accountId', {
    schema: { params: params('accountId'), body: { type: 'object', additionalProperties: false, minProperties: 1,
      not: { required: ['mode', 'sessionId'] },
      properties: { enabled: { type: 'boolean' }, sessionId: resourceId, mode: { const: 'global' }, idleSessionHours: { anyOf: [
        { type: 'null' }, { type: 'integer', minimum: WEIXIN_IDLE_SESSION.min, maximum: WEIXIN_IDLE_SESSION.max },
      ] } } } },
  }, request => weixin.updateAccount(request.params.accountId, request.body));
  app.delete<{ Params: { accountId: string } }>('/api/im/weixin/accounts/:accountId', {
    schema: { params: params('accountId') },
  }, request => weixin.removeAccount(request.params.accountId));
  app.get<{ Params: { accountId: string } }>('/api/im/weixin/accounts/:accountId/messages', {
    schema: { params: params('accountId') },
  }, async request => ({ messages: await weixin.messages(request.params.accountId) }));
  app.post<{ Params: { accountId: string }; Body: ImSendRequest }>('/api/im/weixin/accounts/:accountId/messages', {
    schema: { params: params('accountId'), body: { type: 'object', additionalProperties: false, required: ['requestId', 'text'],
      properties: { requestId: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,120}$' },
        text: { type: 'string', minLength: 1, maxLength: 4000, pattern: '\\S' } } } },
  }, request => weixin.send(request.params.accountId, request.body));
}
