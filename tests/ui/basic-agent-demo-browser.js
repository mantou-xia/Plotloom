// 接口试验台实际点击调用；不拦截网络响应。服务使用隔离模型协议替身。
async page => {
  const assert = (value, text) => { if (!value) throw new Error(text); };
  const origin = new URL(page.url()).origin;
  const select = async endpoint => { await page.goto(`${origin}/#${endpoint}`); };
  const run = async body => {
    if (body) await page.getByRole('textbox', { name: '请求体', exact: true }).fill(JSON.stringify(body));
    await page.getByRole('button', { name: '发送请求', exact: true }).click();
    await page.waitForFunction(() => ['success', 'error', 'stopped', 'disconnected'].includes(document.querySelector('#result-state').dataset.phase));
  };
  await select('sessions.create'); await run({});
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
  return { sessionId: id, checks: ['创建', '发送与工具', '详情', '重试成功', '旧目标409', '停止', '有效与未知正文引用'] };
}
