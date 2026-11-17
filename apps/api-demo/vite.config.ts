import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import { fileURLToPath } from 'node:url';

/** 页面只调用 /api；本地代理解决同源接入，后端不依赖 Demo 的组件或构建产物。 */
export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const env = { ...loadEnv(mode, root, 'PLOTLOOM_'), ...process.env };
  const target = env.PLOTLOOM_DEMO_API_TARGET ?? `http://127.0.0.1:${env.PLOTLOOM_PORT ?? 4317}`;
  const targetUrl = new URL(target);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(targetUrl.hostname) || targetUrl.protocol !== 'http:') {
    throw new Error('Demo 仅连接本机 HTTP 服务。');
  }
  const proxy: Record<string, ProxyOptions> = {
    '/api': {
      target, changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request) => request.setHeader('Origin', targetUrl.origin));
      },
    },
  };
  // 拒绝异站请求后才进行 Origin 转换，防止开发代理绕过后端的本机访问约束。
  const originGuard: Plugin = {
    name: 'plotloom-local-origin',
    configureServer(server) { server.middlewares.use(guardOrigin); },
    configurePreviewServer(server) { server.middlewares.use(guardOrigin); },
  };
  return {
    plugins: [originGuard],
    server: { port: 4318, strictPort: true, proxy },
    preview: { port: 4318, strictPort: true, proxy },
    define: { __API_TARGET__: JSON.stringify(targetUrl.origin) },
  };
});

function guardOrigin(
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
  next: () => void,
) {
  if (request.url?.startsWith('/api') && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'ORIGIN_FORBIDDEN', message: '不允许跨站访问测试台。' } }));
    return;
  }
  next();
}
