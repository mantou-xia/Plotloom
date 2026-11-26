import { isObject, type CheckResult } from './client.ts';

/** HTTP 200 只说明存在发送记录；试验台必须另外核对微信接受状态，不能把 unknown 显示为成功。 */
export function weixinSendChecks(body: unknown): CheckResult[] {
  if (!isObject(body)) return [];
  return [{ name: '微信服务端接受', passed: body.status === 'accepted', detail: body.status === 'accepted'
    ? 'accepted：微信接口已接受，尚无手机送达或已读回执。'
    : `${String(body.status)}：未确认微信接受；请核查结果，不要用新 requestId 盲目重发。` }];
}
