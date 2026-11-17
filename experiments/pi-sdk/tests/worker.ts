import assert from 'node:assert/strict';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createRuntime, openExperimentSession, SYSTEM_PROMPT } from '../src/session.ts';

const [dataDir, baseUrl, mode, sessionFile] = process.argv.slice(2);
const runtime = await createRuntime(dataDir);
// 测试专用本机协议替身，只验证接入行为，不作为真实模型能力证明。
runtime.registerProvider('p0-local-test', {
  baseUrl, api: 'openai-completions', apiKey: 'local-test-placeholder',
  models: [{ id: 'fixture', name: 'Fixture', input: ['text'], reasoning: false,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000, maxTokens: 2048 }],
});
const { session, manager, settings, resources, cwd, sessionDir } = await openExperimentSession({
  dataDir, runtime, provider: 'p0-local-test', model: 'fixture', sessionFile,
});
try {
  assert.deepEqual(session.getActiveToolNames(), ['read_fixture']);
  assert(session.systemPrompt.includes(SYSTEM_PROMPT));
  assert.deepEqual(resources.getAgentsFiles().agentsFiles, []);
  assert.deepEqual(resources.getSkills().skills, []);
  assert.deepEqual(resources.getExtensions().extensions, []);
  assert.equal(settings.getCompactionSettings().enabled, true);
  assert.equal(settings.getRetrySettings().maxRetries, 2);
  const events: string[] = [];
  let deltas = 0;
  let aborted = false;
  let abortPromise: Promise<void> | undefined;
  session.subscribe((event) => {
    events.push(event.type);
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      deltas++;
      if (mode === 'abort' && !abortPromise) abortPromise = session.abort();
    }
    if (event.type === 'agent_settled') aborted = event.aborted;
  });
  await session.prompt(mode === 'resume' ? '我选择 A，请继续。' : mode === 'abort' ? 'STOP_TEST' : '读取 scene 后给出 A、B 候选。');
  await abortPromise;
  assert(session.isIdle);
  const last = session.messages.findLast((message) => message.role === 'assistant');
  assert(last?.role === 'assistant');
  assert.equal(last.stopReason, mode === 'abort' ? 'aborted' : 'stop', last.errorMessage);
  const listed = await SessionManager.list(cwd, sessionDir);
  assert(listed.some((item) => item.id === manager.getSessionId()));
  console.log(JSON.stringify({
    id: manager.getSessionId(), file: manager.getSessionFile(), events, deltas, aborted,
    text: session.getLastAssistantText(), messageCount: session.messages.length,
  }));
} finally {
  session.dispose();
  await runtime.settleCredentialWrites();
}
