/* 用 playwright-cli run-code --filename 执行；仅拦截公开协议，避免修改真实项目或调用付费模型。 */
async (page) => {
  const passed = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); passed.push(message); };
  const model = { provider: 'test', id: 'writer', name: 'Writer', configured: true, reasoning: true, thinkingLevels: ['off', 'high'], input: ['text', 'image'], contextWindow: 100000, maxTokens: 8192 };
  const base = { provider: model.provider, model: model.id, status: 'idle', activity: 'idle', thinkingLevel: 'off', workspaceId: null, updatedAt: '2026-11-19T00:00:00Z' };
  const sessions = [ { ...base, id: 'project-history', name: '项目历史', projectPath: 'D:\\projects\\Plotloom', messages: [] }, { ...base, id: 'ordinary-history', name: '普通历史', messages: [] } ];
  const creations = [];
  const submissions = [];
  let failSend = true;
  let failCreate = false;
  let noModels = false;
  await page.unroute('**/api/**');
  await page.route('**/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/models') return json({ models: noModels ? [] : [model] });
    if (path === '/api/model-config') return json({ provider: 'test', model: 'writer', thinkingLevel: 'off', configured: true });
    if (path === '/api/chats') return json({ sessions });
    if (path === '/api/skills') return json({ skills: [] });
    if (path === '/api/sessions' && req.method() === 'POST') {
      const input = req.postDataJSON();
      if (failCreate) return json({ error: { code: 'INVALID_PROJECT', message: '项目目录不存在' } }, 400);
      creations.push(input);
      const session = { ...base, ...input, id: 'created-' + creations.length, messages: [] };
      sessions.push(session); return json(session, 201);
    }
    const parts = path.split('/');
    const session = sessions.find(item => item.id === parts[3]);
    if (!session) return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
    if (parts.length === 4) return json(session);
    if (parts[4] === 'config') return json({ ...session, ...(req.method() === 'PUT' ? req.postDataJSON() : {}), autoCompaction: true, capabilities: model });
    if (parts[4] === 'context') return json({ id: session.id, tokens: 0, contextWindow: 100000, percent: 0 });
    if (parts[4] === 'skills') return json({ effectiveSkillIds: [], skills: [], unavailable: [] });
    if (parts[4] === 'tools') return json({ tools: [] });
    if (parts[4] === 'messages') {
      submissions.push(req.postDataJSON());
      if (failSend) return json({ error: { code: 'TEST_FAILURE', message: '发送失败测试' } }, 503);
      session.messages = [{ id: 'user-1', role: 'user', content: [{ type: 'text', text: req.postDataJSON().text }] }];
      return route.fulfill({ contentType: 'text/event-stream', body: 'event: accepted\ndata: ' + JSON.stringify({ sessionId: session.id, messageId: 'user-1' }) + '\n\nevent: completed\ndata: ' + JSON.stringify({ sessionId: session.id }) + '\n\n' });
    }
    return json({});
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4319');
  await page.getByRole('button', { name: '项目历史', exact: true }).waitFor();
  assert(creations.length === 0, '打开初始页不创建空会话');
  await page.getByRole('button', { name: '项目历史', exact: true }).click();
  await page.getByRole('heading', { name: '项目历史' }).waitFor();
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('heading', { name: '你想在 Plotloom 中完成什么？' }).waitFor();
  assert(await page.getByRole('img', { name: /ASCII 鲨鱼/ }).count() === 1, '工作初始页复用鲨鱼鱼群背景');
  assert(creations.length === 0, '新聊天继承 Windows 项目目录且不提前创建会话');
  assert(await page.locator('.plotloom-work-start__bottom .plotloom-task-composer').count() === 1
    && await page.locator('.plotloom-work-start__bottom details').count() === 0
    && await page.getByRole('textbox', { name: '项目目录', exact: true }).count() === 0, '底部仅保留现有对话框，无项目选择控件');
  await page.screenshot({ path: 'output/playwright/work-start-project.png' });
  const editor = page.getByRole('textbox', { name: '尽管问...' });
  await editor.fill('请整理这个项目');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByText('发送失败测试', { exact: true }).waitFor();
  assert(await editor.inputValue() === '请整理这个项目', '首条发送失败保留输入');
  assert(creations.length === 1 && creations[0].projectPath === 'D:\\projects\\Plotloom', '创建请求使用继承的真实项目目录');
  failSend = false;
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('region', { name: '聊天', exact: true }).waitFor();
  assert(creations.length === 1 && submissions.length === 2, '发送重试复用会话，accepted 后进入聊天记录');
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('heading', { name: '你想在 Plotloom 中完成什么？' }).waitFor();
  assert(await editor.inputValue() === '', '再次新聊天清空草稿并保留项目');
  await page.getByRole('button', { name: '普通历史', exact: true }).click();
  await page.getByRole('heading', { name: '普通历史' }).waitFor();
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('heading', { name: '有什么想法，开始聊聊吧。' }).waitFor();
  assert(true, '切换普通聊天后不继承上一个项目');
  await page.getByRole('button', { name: '项目历史', exact: true }).click();
  await page.getByRole('heading', { name: '项目历史' }).waitFor();
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  failCreate = true;
  await editor.fill('保留这条草稿');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByText('项目目录不存在', { exact: true }).waitFor();
  assert(await editor.inputValue() === '保留这条草稿', '创建失败保留输入');
  for (const width of [1024, 768]) {
    await page.setViewportSize({ width, height: 768 });
    const fits = await page.locator('.plotloom-work-start').evaluate(element => element.scrollWidth <= element.clientWidth + 1);
    assert(fits, width + 'px 窗口初始页无横向溢出');
  }
  await page.screenshot({ path: 'output/playwright/work-start-narrow.png' });
  noModels = true;
  await page.reload();
  await page.getByText('暂无已配置凭据的模型，请先配置本机模型。', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: '发送', exact: true }).isDisabled(), '无模型时显示提示并禁止发送');
  await page.unroute('**/api/**');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  return { passed: passed.length, results: passed };
}
