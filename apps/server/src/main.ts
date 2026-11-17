import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildServer } from './bootstrap.ts';

/** 仅监听回环地址；凭据从本进程环境加载，永远不进入 API 响应。 */
async function main() {
  const provider = process.env.PLOTLOOM_PROVIDER;
  const model = process.env.PLOTLOOM_MODEL;
  if (!!provider !== !!model) throw new Error('供应商和模型必须同时配置');
  const app = await buildServer({
    dataDir: resolve(process.env.PLOTLOOM_DATA_DIR ?? '.plotloom-data'),
    modelsPath: resolve(process.env.PLOTLOOM_MODELS_PATH ?? 'models.json'),
    defaultModel: provider && model ? { provider, model } : undefined,
    apiKey: process.env.PLOTLOOM_API_KEY?.trim(),
    systemPrompt: process.env.PLOTLOOM_SYSTEM_PROMPT_FILE
      ? await readFile(resolve(process.env.PLOTLOOM_SYSTEM_PROMPT_FILE), 'utf8') : undefined,
    logger: true,
  });
  const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.PLOTLOOM_PORT ?? 4317) });
  console.log(`Plotloom Agent: ${address}`);
  const close = async () => { await app.close(); };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  // 接口测试进程经 IPC 请求正常退出，以实际验证服务重启后的 JSONL 重开。
  process.on('message', (message) => {
    if (message === 'shutdown') void app.close().then(() => { process.disconnect?.(); });
  });
  process.send?.({ address });
}

main().catch(() => {
  console.error('Plotloom 启动失败，请检查本机配置、数据目录和端口。');
  process.exitCode = 1;
});
