// 接口试验台实际点击调用；不拦截网络响应。服务使用隔离模型协议替身。
async page => {
  const assert = (value, text) => { if (!value) throw new Error(text); };
  const origin = new URL(page.url()).origin;
  const { projects: [project] } = await (await page.request.get(`${origin}/api/projects`)).json();
  const select = async endpoint => { await page.goto(`${origin}/#${endpoint}`); };
  const run = async body => {
    if (body) await page.getByRole('textbox', { name: '请求体', exact: true }).fill(JSON.stringify(body));
    await page.getByRole('button', { name: '发送请求', exact: true }).click();
    await page.waitForFunction(() => ['success', 'error', 'stopped', 'disconnected'].includes(document.querySelector('#result-state').dataset.phase));
  };
  await select('sessions.create'); await run({});
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('INVALID_REQUEST'));
  await run({ projectPath: project.path });
  const id = await page.locator('#session-id').inputValue(); assert(id, '创建并自动使用会话');
  await select('generation.send'); await run({ text: 'TOOL' });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  await select('sessions.get'); await run();
  assert((await page.locator('#result-state').innerText()).includes('检查通过'), '会话详情契约');
  const snapshot = await (await page.request.get(`${origin}/api/sessions/${id}`)).json();
  await select('generation.retry'); await run({ messageId: snapshot.retryMessageId });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  const after = await (await page.request.get(`${origin}/api/sessions/${id}`)).json();
  assert(after.messages.filter(m => m.role === 'user').length === 2, '重试保留历史');
  await run({ messageId: snapshot.retryMessageId });
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('RETRY_UNAVAILABLE'));
  await select('generation.send');
  await page.getByRole('textbox', { name: '请求体', exact: true }).fill(JSON.stringify({ text: 'WAIT:demo' }));
  await page.getByRole('button', { name: '发送请求', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('部分回复'));
  await page.locator('#stop-active').click();
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('已停止'));
  await select('generation.send'); await run({ text: 'WRITE:' + JSON.stringify({
    steps: [{ name: 'web_fetch', args: { url: 'http://127.0.0.1:4435/' } }],
    finalText: '本地表单。[来源](#plotloom-source-{{source:0}}) [来源](#plotloom-source-unknown)',
  }) });
  await select('sessions.get'); await run();
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('citations'));
  const cited = await (await page.request.get(`${origin}/api/sessions/${id}`)).json();
  assert(cited.messages.at(-1)?.citations?.length === 1, '展示通过校验的来源');
  await page.screenshot({ path: 'output/playwright/basic-agent-demo.png' });
  await select('workspaces.create'); await run({ title: '试验台小说', root: project.path });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  await select('chats.create');
  await run({ projectPath: project.path });
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('INVALID_REQUEST'));
  await run({ name: '小说试验台聊天' });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  const novelId = await page.locator('#session-id').inputValue();
  assert(novelId && novelId !== id, '创建小说聊天并自动填入会话 ID');
  const workspaceId = await page.locator('#path-workspaceId').inputValue();
  const asset = path => origin + '/api/workspaces/' + workspaceId + '/' + path;
  const novel = origin + '/api/sessions/' + novelId;
  const path = '试验台改写.md';
  const original = '重复句。\n中段\n重复句。\n';
  await select('documents.save'); await run({ path, content: original, baseVersion: null });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  const { version } = await (await page.request.post(asset('document/read'), { data: { path } })).json();
  const start = original.lastIndexOf('重复句。');
  const body = { task: 'rewrite', instructions: 'WRITE:' + JSON.stringify({ steps: [
    { name: 'review_writing', args: { status: 'clear', issues: [] } },
    { name: 'propose_change', args: { path, content: '只改后句。', reason: '验收结构化重试。' } },
  ] }), target: { path, baseVersion: version, selection: { start, end: start + 4, text: '重复句。' } }, maxOutputChars: 300 };
  const latest = async () => (await (await page.request.get(novel)).json()).retryMessageId;
  await select('writing.send'); await run(body);
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  await select('generation.retry'); await run({ messageId: await latest() });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  await select('writing.results'); await run();
  const { requests: [retried, first] } = await (await page.request.get(novel + '/writing')).json();
  assert(retried.id !== first.id && retried.context.task === 'rewrite' && retried.context.maxOutputChars === 300, '重试保留原创作任务和预算');
  assert(retried.proposals[0].content === '重复句。\n中段\n只改后句。\n', '重试仍只改写原选区');

  // 运行中的请求由试验台同一个停止按钮结束，再用新消息 ID 验证重试也能停止。
  async function stopFromDemo(endpoint, payload) {
    await select(endpoint);
    await page.getByRole('textbox', { name: '请求体', exact: true }).fill(JSON.stringify(payload));
    await page.getByRole('button', { name: '发送请求', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('部分回复'));
    await page.locator('#stop-active').click();
    await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('已停止'));
  }
  await stopFromDemo('writing.send', { ...body, instructions: 'WAIT:writing-retry-demo' });
  await stopFromDemo('generation.retry', { messageId: await latest() });
  await select('documents.save'); await run({ path, baseVersion: version, content: original + '外部改动。' });
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('检查通过'));
  await select('generation.retry'); await run({ messageId: await latest() });
  await page.waitForFunction(() => document.querySelector('#result-content').textContent.includes('REVISION_CONFLICT'));
  return { sessionId: id, checks: ['创建项目与小说会话、无效归属', '发送与工具', '详情', '重试成功', '旧目标409', '停止',
    '有效与未知正文引用', '结构化创作重试与选区候选', '创作重试可停止', '旧正文版本409'] };
}
