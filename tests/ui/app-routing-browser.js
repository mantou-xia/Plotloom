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
  await page.getByRole('textbox', { name: '尽管问...' }).waitFor();

  const session = await (await page.request.post(`${origin}/api/sessions`, { data: { name: '路由验收会话', projectPath: (await (await page.request.get(`${origin}/api/projects`)).json()).projects[0].path } })).json();
  await page.goto(`${origin}/#chat=${encodeURIComponent(session.id)}`);
  await page.getByRole('heading', { name: '路由验收会话', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '路由验收会话', exact: true }).waitFor();

  const projectPath = 'D:\\项目 测试';
  await page.goto(`${origin}/#${new URLSearchParams({ project: projectPath })}`);
  await page.getByRole('button', { name: '切换项目：项目 测试', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '切换项目：项目 测试', exact: true }).waitFor();
  return { checks: ['技能与小说管理', '前进后退', '设置分类及返回', '旧聊天链接', '项目新聊天'] };
}
