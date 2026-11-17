import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createRuntime, openExperimentSession } from './session.ts';

/** 每个阶段独立启动进程；resume 从磁盘重开，不能用内存历史冒充重启验收。 */
async function main() {
  const mode = process.argv[2];
  if (!['generate', 'resume', 'abort', 'list'].includes(mode ?? '')) {
    throw new Error('用法：pnpm verify <generate|resume|abort|list>');
  }
  const dataDir = resolve('.p0-data');
  if (mode === 'list') {
    const sessions = await SessionManager.list(resolve(dataDir, 'workspace'), resolve(dataDir, 'sessions'));
    console.log(JSON.stringify(sessions.map(({ id, path, messageCount }) => ({ id, path, messageCount })), null, 2));
    return;
  }
  const provider = process.env.P0_PROVIDER;
  const model = process.env.P0_MODEL;
  if (!provider || !model) throw new Error('缺少 P0_PROVIDER / P0_MODEL；真实模型验证未执行。');
  const apiKey = process.env.P0_API_KEY?.trim();
  if (!apiKey || apiKey === '你的API Key') {
    throw new Error('缺少有效 P0_API_KEY，请在本机 .env 填写真实密钥；尚未发送模型请求。');
  }
  const modelsPath = fileURLToPath(new URL('../models.json', import.meta.url));
  const runtime = await createRuntime(dataDir, modelsPath);
  if (runtime.getError()) throw new Error('models.json 加载失败，请检查 SDK 配置格式。');
  // 只使用调用方明确指定的凭据，不扫描或复制其他应用的登录数据。
  await runtime.setRuntimeApiKey(provider, apiKey);
  const auth = await runtime.getAuth(provider);
  if (!auth) throw new Error('未配置指定供应商的凭据；请在本机 .env 中配置 P0_API_KEY。');
  const pointerPath = resolve(dataDir, 'last-session.json');
  const previous = mode === 'resume' ? JSON.parse(await readFile(pointerPath, 'utf8')) : undefined;
  if (previous && (previous.provider !== provider || previous.model !== model)) {
    throw new Error('继续会话必须使用生成阶段的供应商和模型。');
  }
  const { session, manager } = await openExperimentSession({
    dataDir, runtime, provider, model, sessionFile: previous?.sessionFile,
  });
  const eventCounts: Record<string, number> = {};
  let textDeltas = 0;
  let toolSucceeded = false;
  let aborted = false;
  let abortRequested = false;
  let abortPromise: Promise<void> | undefined;
  const unsubscribe = session.subscribe((event) => {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      textDeltas++;
      process.stdout.write(event.assistantMessageEvent.delta);
      // 收到首个内容增量后停止，证明中断的是进行中的生成。
      if (mode === 'abort' && !abortRequested) {
        abortRequested = true;
        abortPromise = session.abort();
      }
    }
    if (event.type === 'tool_execution_end' && event.toolName === 'read_fixture' && !event.isError) {
      toolSucceeded = true;
    }
    if (event.type === 'agent_settled') aborted = event.aborted;
  });
  const prompt = mode === 'generate'
    ? '请调用 read_fixture 读取 scene，写出资料中的核对标记，并给出 A、B 两个简短行动候选，然后等待我的选择。'
    : mode === 'resume'
      ? '我选择 A。请根据之前资料和候选继续写约 150 字，先重复资料的核对标记，不要重新读取资料。'
      : '请直接写一段约 2000 字的灯塔暴雨描写，不调用工具。';
  try {
    const startedAt = performance.now();
    await session.prompt(prompt);
    await abortPromise;
    const last = session.messages.findLast((message) => message.role === 'assistant');
    assert(last?.role === 'assistant', '未收到 assistant 消息');
    assert.notEqual(last.stopReason, 'error', '模型请求失败；请检查本机配置');
    assert(textDeltas > 0, '未收到正文流式增量');
    assert(session.isIdle, '请求结束后会话未回到空闲');
    if (mode === 'abort') {
      assert(abortRequested && aborted, '未观察到停止完成事件');
      assert.equal(last.stopReason, 'aborted');
    } else {
      assert.equal(last.stopReason, 'stop');
      assert.match(session.getLastAssistantText() ?? '', /灯塔-731/, '未复述材料核对标记');
      if (mode === 'generate') assert(toolSucceeded, '未成功执行只读工具');
      if (mode === 'resume') assert(!eventCounts.tool_execution_start, '继续阶段重新调用了工具，不能据此证明历史资料已保留');
    }
    const report = {
      mode, passed: true, checkedAt: new Date().toISOString(), provider, model,
      thinkingLevel: session.thinkingLevel,
      sessionId: manager.getSessionId(), sessionFile: manager.getSessionFile(),
      textDeltas, toolSucceeded, aborted, eventCounts, usage: last.usage,
      durationMs: Math.round(performance.now() - startedAt),
    };
    if (mode === 'generate') await writeFile(pointerPath, JSON.stringify(report, null, 2), 'utf8');
    await writeFile(resolve(dataDir, `report-${mode}.json`), JSON.stringify(report, null, 2), 'utf8');
    console.log('\n' + JSON.stringify(report, null, 2));
  } finally {
    unsubscribe();
    session.dispose();
    await runtime.settleCredentialWrites();
  }
}

main().catch((error: unknown) => {
  // 不输出 SDK 原始响应/请求头；凭据和供应商错误正文留在本机排查。
  console.error(error instanceof Error ? error.message : '验证失败');
  process.exitCode = 1;
});
