import { buildServer } from './bootstrap.ts';
import { fileURLToPath } from 'node:url';

/** 桌面宿主分配可写目录和启动令牌，端口交给系统选择，避免撞上开发服务。 */
async function startDesktopServer() {
  const port = (process as NodeJS.Process & { parentPort?: {
    once(event: 'message', listener: (event: { data: unknown }) => void): void;
    postMessage(message: unknown): void;
  } }).parentPort;
  const [dataDir, executablePath] = process.argv.slice(2);
  const desktopToken = process.env.PLOTLOOM_DESKTOP_TOKEN;
  if (!port || !dataDir || !executablePath || !desktopToken) throw new Error('桌面启动参数缺失');
  // 随包目录只补齐模型能力，供应商仍从用户数据目录加载。
  const modelCapabilitiesPath = fileURLToPath(new URL('../model-capabilities.json', import.meta.url));
  const server = await buildServer({ dataDir, modelCapabilitiesPath, browser: { executablePath } }, { desktopToken });
  port.once('message', ({ data }) => {
    if (data === 'shutdown') void server.close().finally(() => process.exit());
  });
  const address = await server.listen({ host: '127.0.0.1', port: 0 });
  port.postMessage({ address });
}

void startDesktopServer().catch(error => {
  console.error(error);
  process.exit(1);
});
