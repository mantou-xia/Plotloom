import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { WRITING_SAMPLES } from '../evals/writing-samples.ts';
import { startServer, collect } from '../tests/api/client.ts';
import type { WritingRequest } from '../packages/contracts/src/writing.ts';

/** 真实 HTTP 对照验收；独立数据保留产物，不读取作者作品、不把密钥写入报告。 */
async function main() {
  if (!process.env.PLOTLOOM_API_KEY?.trim()) throw new Error('缺少本机模型凭据。');
  await mkdir(resolve('output'), { recursive: true });
  const directory = await mkdtemp(resolve('output/p3-real-'));
  const book = join(directory, 'book'); await mkdir(book);
  const server = await startServer({ ...process.env, PLOTLOOM_DATA_DIR: join(directory, 'data') }, 240000);
  const report: any = { date: new Date().toISOString(), directory, samples: [], passed: false,
    method: '同模型、同原文、相同用户要求；项目聊天直接粘贴资料，结构化方案调用公开创作接口。机械断言检验流程，质量由逐份阅读另行记录。' };
  const saveReport = () => writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  try {
    report.model = await server.json('/api/model-config');
    const hash = createHash('sha256');
    for (const path of ['packages/application/src/writing.ts', 'packages/agent-pi/src/index.ts', 'packages/agent-pi/src/resources.ts', 'packages/storage/builtin/novel-writing/SKILL.md', 'evals/writing-samples.ts']) hash.update(await readFile(path));
    report.promptHash = hash.digest('hex');
    const workspace = await server.json('/api/workspaces', 'POST', { title: 'P3 合成验收小说', root: book }, 201);
    report.workspaceId = workspace.id;
    for (const sample of WRITING_SAMPLES) {
      const materials: any[] = [];
      const persist = async (path: string, content: string, outline = false) => {
        const full = `${sample.id}/${path}`;
        return server.json(`/api/workspaces/${workspace.id}/${outline ? 'outlines' : 'document'}`, outline ? 'POST' : 'PUT', { path: full, content, baseVersion: null });
      };
      const body: WritingRequest = { task: sample.task, instructions: sample.instructions, maxOutputChars: 1200, references: [] };
      if (sample.target) {
        const doc = sample.target.content === undefined ? { path: `${sample.id}/${sample.target.path}`, content: '', version: null } : await persist(sample.target.path, sample.target.content, sample.task === 'enrich_outline');
        body.target = { path: doc.path, baseVersion: doc.version };
        if (sample.target.selected) {
          const start = sample.target.last ? doc.content.lastIndexOf(sample.target.selected) : doc.content.indexOf(sample.target.selected);
          body.target.selection = { start, end: start + sample.target.selected.length, text: sample.target.selected };
        }
        materials.push({ ...doc, role: 'target' });
      }
      if (sample.outline) { const doc = await persist('大纲/正式.md', sample.outline, true); body.outline = { path: doc.path, version: doc.version }; materials.push({ ...doc, role: 'outline' }); }
      for (const item of sample.materials) {
        const doc = await persist(item.path, item.content); body.references!.push({ path: doc.path, version: doc.version, role: item.role as any }); materials.push({ ...doc, role: item.role });
      }
      // 样本内提到的相对路径加上隔离前缀，与实际工作区一致。
      if (sample.id === 'history') body.instructions = body.instructions.replace('历史/第三章.md', 'history/历史/第三章.md');
      const row: any = { id: sample.id, label: sample.label, expected: sample.expected, criteria: sample.criteria, request: body, materials };
      report.samples.push(row);
      for (const mode of ['baseline', 'structured']) {
        const chat = await server.json(mode === 'baseline' ? '/api/sessions' : `/api/workspaces/${workspace.id}/sessions`, 'POST', { name: `${sample.id}-${mode}`, thinkingLevel: 'off', ...(mode === 'baseline' ? { projectPath: book } : {}) }, 201);
        const start = performance.now();
        const response = await server.request(`/api/sessions/${chat.id}/${mode === 'baseline' ? 'messages' : 'writing/messages'}`, 'POST', mode === 'baseline'
          ? { text: `任务：${body.task}。${body.instructions}\n以下是正式资料、目标和修改范围。不要调用工具；直接给出所需文本或冲突问题，不声称已保存。\n目标：${JSON.stringify(body.target)}\n资料：${JSON.stringify(materials)}` } : body);
        const events = await collect(response); const final = events.at(-1);
        row[mode] = { sessionId: chat.id, durationMs: Math.round(performance.now() - start), outcome: final?.type,
          usage: final?.type === 'completed' ? final.usage : undefined, text: events.filter(e => e.type === 'text_delta').map(e => e.delta).join(''),
          tools: events.filter(e => e.type === 'tool_end') };
        if (mode === 'structured') {
          row.structured.result = (await server.json(`/api/sessions/${chat.id}/writing`)).requests[0];
          row.structured.formalUnchanged = !body.target || (await server.json(`/api/workspaces/${workspace.id}/document/read`, 'POST', { path: body.target.path })).version === body.target.baseVersion;
        }
        await saveReport(); console.log(JSON.stringify({ sample: sample.id, mode, outcome: final?.type, ms: row[mode].durationMs, proposals: row.structured?.result?.proposals.length, review: row.structured?.result?.review?.status }));
      }
      const result = row.structured.result;
      row.flowPassed = row.baseline.outcome === 'completed' && row.structured.outcome === 'completed' && row.structured.formalUnchanged
        && (sample.expected === 'proposal' ? result.proposals.length > 0 && result.review?.status === 'clear'
          : sample.expected === 'needs_input' ? result.proposals.length === 0 && result.review?.status === 'needs_input' : result.proposals.length === 0);
      await saveReport();
    }
    report.passed = report.samples.every((s: any) => s.flowPassed); await saveReport();
    console.log(JSON.stringify({ report: join(directory, 'report.json'), flowPassed: report.passed, samples: report.samples.length }));
    assert(report.passed, '真实模型存在未通过的流程样本，详见报告。');
  } finally { await saveReport(); await server.close(); }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : '真实创作验收未完成，请检查本机配置、模型响应和保留的报告。'); process.exitCode = 1; });
