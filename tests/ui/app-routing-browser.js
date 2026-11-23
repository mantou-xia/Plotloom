// 在正式 Web 前端和隔离测试后端上验证页面路由。
async page => {
  const origin = new URL(page.url()).origin;
  const params = () => new URLSearchParams(new URL(page.url()).hash.slice(1));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const nav = page.getByRole('navigation', { name: '应用导航' });
  const settingsNav = page.getByRole('navigation', { name: '设置导航' });
  await page.goto(`${origin}/`);
  await nav.getByRole('button', { name: '技能', exact: true }).click();
  assert(params().get('page') === 'skills', '技能有独立地址');
  await page.reload();
  await page.getByRole('heading', { name: '技能', exact: true }).waitFor();
  await nav.getByRole('button', { name: '小说管理', exact: true }).click();
  await page.getByRole('heading', { name: '小说管理', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '小说管理', exact: true }).waitFor();
  await page.goBack();
  await page.waitForURL(url => url.hash === '#page=skills');
  await page.getByRole('heading', { name: '技能', exact: true }).waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: '小说管理', exact: true }).waitFor();

  await nav.getByRole('button', { name: '设置', exact: true }).click();
  await settingsNav.getByRole('button', { name: '归档', exact: true }).click();
  assert(params().get('settings') === 'archive', '设置分类写入地址');
  await page.reload();
  await page.getByRole('heading', { name: '已归档的对话', exact: true }).waitFor();
  await settingsNav.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('heading', { name: '小说管理', exact: true }).waitFor();
  await page.goto(`${origin}/#settings=appearance`);
  await page.getByRole('heading', { name: '外观', exact: true }).waitFor();
  await settingsNav.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('textbox', { name: '输入消息，/ 调用技能，@ 引用文件' }).waitFor();

  const session = await (await page.request.post(`${origin}/api/sessions`, { data: { name: '路由验收会话', projectPath: (await (await page.request.get(`${origin}/api/projects`)).json()).projects[0].path } })).json();
  await page.goto(`${origin}/#chat=${encodeURIComponent(session.id)}`);
  await page.getByRole('heading', { name: '路由验收会话', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '路由验收会话', exact: true }).waitFor();

  // 用真实会话的多条工具记录，让两个执行过程按钮都在打开设置前可见。
  const generated = await page.request.post(`${origin}/api/sessions/${session.id}/messages`, { data: {
    text: 'WRITE:' + JSON.stringify({
      steps: Array.from({ length: 8 }, () => ({ name: 'read', args: { path: 'scene.md' } })),
      finalText: '路由验收已完成',
    }),
  } });
  assert((await generated.text()).includes('event: completed'), '未生成用于验收的工具记录');
  await page.reload();
  await page.getByRole('button', { name: '展开执行过程', exact: true }).click();
  const panel = page.locator('.pl-execution-timeline');
  const process = panel.locator('.pl-execution-timeline__viewport');
  await process.evaluate(node => { node.scrollTop = 0; });
  await panel.getByRole('button', { name: '回到最新过程', exact: true }).waitFor();
  const editor = page.getByPlaceholder('输入消息，/ 调用技能，@ 引用文件');
  await editor.fill('切换设置前的对话草稿');

  const actions = panel.locator('.pl-execution-timeline__actions button');
  // 隐藏页面仍保留 DOM，因此直接检查浏览器的绘制可见性（包括祖先透明度）。
  const visibleActions = () => actions.evaluateAll(nodes => nodes.filter(node =>
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true })).length);
  assert(await visibleActions() === 2, '切页前两个执行过程按钮应可见');
  await nav.getByRole('button', { name: '设置', exact: true }).click();
  await settingsNav.getByRole('button', { name: '工具', exact: true }).click();
  await page.getByRole('region', { name: 'ToolCall 工具清单' }).waitFor();
  assert(await visibleActions() === 0, '对话的执行过程按钮透出到了工具设置页');
  await settingsNav.getByRole('button', { name: '返回', exact: true }).click();
  assert(await editor.inputValue() === '切换设置前的对话草稿', '返回设置前的对话后草稿丢失');
  assert(await visibleActions() === 2, '返回对话后执行过程按钮未恢复');
  await nav.getByRole('button', { name: '技能', exact: true }).click();
  await page.getByRole('heading', { name: '技能', exact: true }).waitFor();
  assert(await actions.count() === 0, '离开对话后执行过程按钮未卸载');

  const projectPath = 'D:\\项目 测试';
  await page.goto(`${origin}/#${new URLSearchParams({ project: projectPath })}`);
  await page.getByRole('button', { name: '切换项目：项目 测试', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '切换项目：项目 测试', exact: true }).waitFor();
  return { checks: ['技能与小说管理', '前进后退', '设置分类及返回', '执行过程按钮与草稿', '旧聊天链接', '项目新聊天'] };
}
