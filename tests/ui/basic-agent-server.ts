import { access, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { buildServer } from '../../apps/server/src/bootstrap.ts';
import { createModelFixture, TEST_KEY } from '../api/fixture.ts';
/** 固定隔离端口配合 UI 验收；只替换模型协议，文件与浏览器均实际执行。 */
const directory = await mkdtemp(join(tmpdir(), 'plotloom-product-'));
const project = join(directory, 'project'); await mkdir(project);
await writeFile(join(project, 'scene.md'), '核对标记：灯塔-731。');
// 每个建书入口单独使用一个空目录，原项目目录用于验证非空拒绝。
for (const suffix of ['novel-page', 'novel-sidebar', 'novel-demo']) await mkdir(project + '-' + suffix);
const fixture = await createModelFixture();
const modelsPath = join(directory, 'models.json');
await writeFile(modelsPath, JSON.stringify({ providers: { 'p1-test': { api: 'openai-completions', baseUrl: fixture.baseUrl,
  models: [{ id: 'fixture', name: '验收模型', reasoning: true, input: ['text','image'], contextWindow: 128000, maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
const app = await buildServer({ dataDir: join(directory, 'data'), modelsPath, defaultModel: { provider: 'p1-test', model: 'fixture' }, apiKey: TEST_KEY },
  // 验证后端交给宿主的实际文件路径，避免自动验收弹出系统应用。
  { openDeliverable: path => access(path) });
await app.inject({ method: 'POST', url: '/api/projects', payload: { name: '验收项目', path: project } });
await app.listen({ host: '127.0.0.1', port: 4432 });
let submitted = '';
const site = createServer((req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  if (url.pathname === '/submit') submitted = url.searchParams.get('value') ?? '';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<title>Plotloom 浏览器验收</title><h1>${submitted || '本地表单'}</h1><form action="/submit"><label>验收内容<input name="value"></label><button>提交</button></form>`);
});
await new Promise<void>(resolve => site.listen(4435, '127.0.0.1', resolve));
await mkdir(resolve('output'), { recursive: true });
await writeFile(resolve('output/preview.txt'), 'preview-test');
await writeFile(resolve('output/basic-agent-harness.json'), JSON.stringify({ directory, project, address: 'http://127.0.0.1:4432', site: 'http://127.0.0.1:4435' }));
console.log(JSON.stringify({ directory, project, ready: true }));
process.on('SIGINT', async () => { await app.close(); await fixture.close(); site.close(); process.exit(); });
