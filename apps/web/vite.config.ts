import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import { fileURLToPath } from 'node:url';

// 产品前端独立监听，便于与后端（4317）和接口试验台（4318）同时运行。
export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const env = { ...loadEnv(mode, root, 'PLOTLOOM_'), ...process.env };
  const target = new URL(env.PLOTLOOM_WEB_API_TARGET ?? `http://127.0.0.1:${env.PLOTLOOM_PORT ?? 4317}`);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('正式前端仅代理本机 HTTP 服务。');
  const proxy: Record<string, ProxyOptions> = { '/api': { target: target.origin, changeOrigin: true,
    configure(proxy) { proxy.on('proxyReq', request => request.setHeader('Origin', target.origin)); },
  } };
  // 先校验浏览器同源，再转换代理 Origin，保留后端本机访问约束。
  const originGuard: Plugin = {
    name: 'plotloom-web-origin',
    configureServer(server) { server.middlewares.use(guardOrigin); },
    configurePreviewServer(server) { server.middlewares.use(guardOrigin); },
  };
  return { plugins: [react(), originGuard], server: { port: 4319, strictPort: true, proxy }, preview: { port: 4319, strictPort: true, proxy } };
});

function guardOrigin(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse, next: () => void) {
  if (request.url?.startsWith('/api') && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'ORIGIN_FORBIDDEN', message: '不允许跨站访问本机服务。' } }));
    return;
  }
  next();
}
