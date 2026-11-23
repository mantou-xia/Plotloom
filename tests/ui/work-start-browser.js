/* 用 playwright-cli run-code --filename 执行；仅拦截公开协议，避免修改真实项目或调用付费模型。 */
async (page) => {
  const passed = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); passed.push(message); };
  const model = { provider: 'test', id: 'writer', name: 'Writer', configured: true, reasoning: true, thinkingLevels: ['off', 'high'], input: ['text', 'image'], contextWindow: 100000, maxTokens: 8192 };
  const base = { provider: model.provider, model: model.id, status: 'idle', activity: 'idle', thinkingLevel: 'off', workspaceId: null, updatedAt: '2026-11-19T00:00:00Z' };
  const project = { id: 'plotloom', name: 'Plotloom', path: 'D:\\projects\\Plotloom' };
  const workspace = { id: 'story', title: '灯塔', root: 'D:\\novels\\灯塔' };
  const sessions = [ { ...base, id: 'project-history', name: '项目历史', projectPath: 'D:\\projects\\Plotloom', messages: [] }, { ...base, id: 'novel-history', name: '小说历史', workspaceId: workspace.id, messages: [] } ];
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
    if (path === '/api/projects') return json({ projects: [project] });
    if (path === '/api/workspaces') return json({ workspaces: [workspace] });
    if (path === '/api/chats') return json({ sessions });
    if (path === '/api/skills') return json({ skills: [
      { id: 'skill-one', name: 'novel-draft', description: '起草小说', enabled: true, availableIn: ['novel'] },
      { id: 'skill-two', name: 'other-writing', description: '其他写作技能', enabled: true, availableIn: ['novel'] },
    ] });
    if (path === `/api/workspaces/${workspace.id}/skills`) return json({ skillIds: ['skill-one'] });
    if ((path === '/api/sessions' || path === `/api/workspaces/${workspace.id}/sessions`) && req.method() === 'POST') {
      const input = req.postDataJSON();
      if (failCreate) return json({ error: { code: 'INVALID_PROJECT', message: '项目目录不存在' } }, 400);
      creations.push(input);
      const session = { ...base, ...input, id: 'created-' + creations.length, workspaceId: path === '/api/sessions' ? null : workspace.id,
        name: path === '/api/sessions' ? '项目新聊天' : '小说新聊天', messages: [] };
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
  await page.goto(new URL('/', page.url()).href);
  const recent = page.locator('.pl-sidebar-section').filter({ has: page.getByRole('button', { name: '最近', exact: true }) });
  const projectHistory = recent.getByRole('button', { name: '项目历史', exact: true });
  await projectHistory.waitFor();
  assert(await recent.getByRole('button', { name: '小说历史', exact: true }).isVisible(), '最近同时汇总项目和小说聊天');
  await page.locator('.plotloom-work-start .plotloom-task-composer [data-motion-surface][inert]').waitFor();
  assert(creations.length === 0, '未选项目时输入区不可操作');
  assert(creations.length === 0, '打开初始页不创建空会话');
  await projectHistory.click();
  await page.getByRole('heading', { name: '项目历史' }).waitFor();
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('heading', { name: '你想在 切换项目：Plotloom 中完成什么？' }).waitFor();
  assert(await page.getByRole('img', { name: /ASCII 鲨鱼/ }).count() === 1, '工作初始页复用鲨鱼鱼群背景');
  assert(creations.length === 0, '新聊天继承 Windows 项目目录且不提前创建会话');
  assert(await page.locator('.plotloom-work-start__bottom .plotloom-task-composer').count() === 1
    && await page.locator('.plotloom-work-start__bottom details').count() === 0
    && await page.getByRole('textbox', { name: '项目目录', exact: true }).count() === 0, '底部仅保留现有对话框，无项目选择控件');
  await page.screenshot({ path: 'output/playwright/work-start-project.png' });
  const editor = page.getByRole('textbox', { name: '输入消息，/ 调用技能，@ 引用文件' });
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
  await page.getByRole('heading', { name: '你想在 切换项目：Plotloom 中完成什么？' }).waitFor();
  assert(await editor.inputValue() === '', '再次新聊天清空草稿并保留项目');
  await page.getByRole('button', { name: '灯塔', exact: true }).hover();
  await page.getByRole('button', { name: '在 灯塔 中新建聊天', exact: true }).click();
  await page.getByRole('heading', { name: '继续创作《灯塔》' }).waitFor();
  await editor.fill('/');
  await page.getByRole('option', { name: /novel-draft/ }).waitFor();
  assert(await page.getByRole('option', { name: /other-writing/ }).count() === 0, '小说首条消息只提供工作区启用的技能');
  await page.getByRole('option', { name: /novel-draft/ }).click();
  await editor.pressSequentially('讨论灯塔故事');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await recent.getByRole('button', { name: '小说新聊天', exact: true }).waitFor();
  assert(creations.length === 2 && !('projectPath' in creations[1]), '小说使用工作区入口创建，发送后出现在最近');
  assert(submissions.at(-1).skillIds.join() === 'skill-one', '首条小说消息提交所选技能 ID');
  await projectHistory.click();
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
  await page.locator('.plotloom-work-start .plotloom-task-composer [data-motion-surface][inert]').waitFor();
  assert(creations.length === 2, '无模型时显示提示且输入区不可操作');
  await page.unroute('**/api/**');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  return { passed: passed.length, results: passed };
}
