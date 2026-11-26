import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { WeixinHttpClient } from '../../apps/server/src/im/weixin-http.ts';

/** 隔离测试入口只注入微信协议替身，实际服务装配、公开路由和 Agent 保持一致。 */
const app = await buildServer({ dataDir: process.env.PLOTLOOM_DATA_DIR!, modelsPath: process.env.PLOTLOOM_MODELS_PATH!,
  defaultModel: { provider: 'p1-test', model: 'fixture' }, apiKey: process.env.PLOTLOOM_API_KEY },
  { weixinGateway: new WeixinHttpClient({ origin: process.env.PLOTLOOM_TEST_WEIXIN_ORIGIN!, timeoutMs: 2000 }) });
const address = await app.listen({ host: '127.0.0.1', port: 0 });
process.on('message', message => { if (message === 'shutdown') void app.close().then(() => process.disconnect?.()); });
process.send?.({ address });
