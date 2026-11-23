// 拦截删除请求，用临时数据验证界面，避免操作本机技能库。
async page => {
  const origin = new URL(page.url()).origin;
  const builtin = { id: 'builtin-test', name: '内置验收技能', source: 'builtin', description: '系统提供', enabled: true, missingTools: [] };
  const personal = { ...builtin, id: 'personal-test', name: '个人验收技能', source: 'custom' };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  let attempts = 0;
  let deleted = false;
  const refresh = Promise.withResolvers();
  await page.route('**/api/skills**', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (deleted) await refresh.promise;
      return route.fulfill({ json: { skills: deleted ? [builtin] : [builtin, personal] } });
    }
    assert(request.method() === 'DELETE' && new URL(request.url()).pathname === '/api/skills/' + personal.id, '仅允许删除指定个人技能');
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 500, json: { error: { message: '模拟删除失败' } } });
    deleted = true;
    return route.fulfill({ json: { deleted: true } });
  });
  await page.goto(origin + '/#page=skills');
  await page.getByRole('tab', { name: /个人安装/ }).click();
  await page.getByText(personal.name, { exact: true }).waitFor();
  await page.getByRole('navigation', { name: '应用导航' }).getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('navigation', { name: '设置导航' });
  await settings.getByRole('button', { name: '技能', exact: true }).click();
  const remove = page.getByRole('button', { name: '删除技能 ' + personal.name, exact: true });
  await remove.waitFor();
  assert(await page.getByRole('button', { name: '删除技能 ' + builtin.name, exact: true }).count() === 0, '内置技能应无删除入口');
  const dialog = page.getByRole('dialog', { name: '删除技能' });
  await remove.click();
  await dialog.getByRole('button', { name: '取消' }).click();
  assert(attempts === 0, '取消不得发送删除请求');
  await remove.click();
  const confirm = dialog.getByRole('button', { name: '确认删除' });
  await confirm.click();
  await page.getByText('模拟删除失败', { exact: true }).waitFor();
  assert(await dialog.isVisible() && attempts === 1, '失败后应保留弹窗和条目');
  await confirm.click();
  await remove.waitFor({ state: 'detached' });
  assert(attempts === 2 && await page.getByRole('switch', { name: builtin.name, exact: true }).isVisible(), '只删除选中的个人技能');
  await settings.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByText('还没有安装个人技能', { exact: true }).waitFor();
  refresh.resolve();
  return { checked: ['内置保护', '取消不请求', '失败保留及重试', '确认删除', '后台读取期间技能缓存已更新'] };
}
