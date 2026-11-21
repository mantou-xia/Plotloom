import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { marked } from 'marked';

const style = `body{margin:0;padding:32px;font:15px/1.7 system-ui;color:#292929;background:#fff}h1{font-size:24px}label{display:block;margin:16px 0}input,button{font:inherit;padding:8px 12px;border:0;border-radius:6px;background:#f2f2f3}button{cursor:pointer}input:focus-visible,button:focus-visible{outline:0;box-shadow:0 0 0 2px #777}a{color:#24539b}#result{min-height:28px}section{padding-block:16px}pre{padding:16px;background:#f6f6f7;white-space:pre-wrap}img{max-width:100%}`;
const html = body => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Plotloom 浏览器验证站点</title><style>${style}</style><body>${body}</body></html>`;

/** 合成网站只服务本机随机端口；登录通过真实 HTTP Cookie，不注入浏览器存储伪造登录。 */
export async function createSite() {
  const sessions = new Set();
  const evidence = [];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const token = /(?:^|; )spike_session=([^;]+)/.exec(request.headers.cookie ?? '')?.[1];
      const authenticated = sessions.has(token);
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (url.pathname === '/login' && request.method === 'POST') {
        let raw = ''; for await (const chunk of request) raw += chunk;
        const data = new URLSearchParams(raw);
        if (data.get('username') !== 'demo' || data.get('password') !== 'demo-only') { response.writeHead(401); response.end('合成账号不匹配'); return; }
        const id = randomUUID(); sessions.add(id);
        evidence.push({ event: 'login', at: Date.now() });
        response.writeHead(303, { Location: '/workspace', 'Set-Cookie': `spike_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600` });
        response.end(); return;
      }
      if (url.pathname === '/save' && request.method === 'POST') {
        if (!authenticated) { response.writeHead(401); response.end('请登录'); return; }
        let raw = ''; for await (const chunk of request) raw += chunk;
        const { text } = JSON.parse(raw);
        evidence.push({ event: 'save', text, at: Date.now() });
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ saved: text })); return;
      }
      if (url.pathname === '/image.svg') {
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480"><rect width="800" height="480" fill="#edf2f3"/><path d="M0 350L170 170 360 350 560 100 800 350V480H0Z" fill="#8da8ad"/><circle cx="170" cy="100" r="34" fill="#ebcb92"/><text x="40" y="430" font-size="28" fill="#273e43">Plotloom · Image preview fixture</text></svg>'); return;
      }
      if (url.pathname === '/preview/image') { response.end(html('<h1>图片只读预览</h1><img alt="合成山景测试图片" src="/image.svg">')); return; }
      if (url.pathname === '/preview/markdown') {
        // 只渲染仓库固定测试 Markdown，不接受用户文件或远程 HTML；正式产品复用既有 MarkdownRenderer。
        const markdown = await readFile(new URL('./sample.md', import.meta.url), 'utf8');
        response.end(html(marked.parse(markdown))); return;
      }
      if (url.pathname === '/second' && authenticated) { response.end(html('<h1>第二页</h1><p>登录状态仍然有效。</p><a href="/workspace">返回工作页</a>')); return; }
      if (!authenticated) {
        response.end(html('<h1>浏览器会话验证</h1><p>此页面禁止 iframe 嵌入；这里只使用合成账号，不连接真实用户账号。</p><form method="post" action="/login"><label>用户名<input name="username" autocomplete="off"></label><label>密码<input name="password" type="password" autocomplete="off"></label><button type="submit">登录</button></form>')); return;
      }
      response.end(html(`<h1>已登录：demo</h1><p id="session-marker">共享会话已就绪</p><a href="/second">打开第二页</a>
        <label>工作备注<input id="note" autocomplete="off"></label><button id="save">保存备注</button><p id="result" role="status"></p>
        <button id="count">计数 +1</button><span id="count-value">0</span>
        ${Array.from({ length: 24 }, (_, i) => `<section>资料段落 ${i + 1}：用户和 Agent 共享当前可见网页，切换文件预览后保留浏览器状态。</section>`).join('')}
        <p id="bottom">底部核对标记：灯塔-731</p>
        <script>let count=0;document.querySelector('#count').onclick=()=>document.querySelector('#count-value').textContent=String(++count);
        document.querySelector('#save').onclick=async()=>{const text=document.querySelector('#note').value;const r=await fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const data=await r.json();document.querySelector('#result').textContent='已保存：'+data.saved;};</script>`));
    } catch { response.writeHead(500); response.end('验证站点请求失败'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`, evidence,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
