// 通过 Playwright CLI 运行。先将隔离服务的测试项目登记到 /api/projects。
async page => {
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const origin = new URL(page.url()).origin;
  const initialName = '标题失焦验收';
  const { projects } = await (await page.request.get(`${origin}/api/projects`)).json();
  assert(projects?.length, '隔离服务需要预先登记测试项目');
  const response = await page.request.post(`${origin}/api/sessions`, { data: { name: initialName, projectPath: projects[0].path } });
  assert(response.ok(), `创建验收会话失败：${response.status()}`);
  const { id } = await response.json();
  const renameUrl = `${origin}/api/sessions/${id}/name`;
  const submissions = [];
  page.on('request', request => {
    if (request.url() === renameUrl && request.method() === 'PUT') submissions.push(request.postDataJSON().name);
  });
  await page.goto(`${origin}/#chat=${id}`);
  const heading = name => page.getByRole('heading', { name, exact: true });
  const edit = page.getByRole('button', { name: '重命名对话', exact: true });
  const input = page.getByRole('textbox', { name: '对话名称', exact: true });
  const composer = page.getByRole('textbox', { name: '输入消息，/ 调用技能，@ 引用文件' });
  await heading(initialName).waitFor();
  await edit.click();
  assert(await page.getByRole('button', { name: /^(保存名称|取消重命名)$/ }).count() === 0, '编辑时只显示输入框');
  await input.fill('  点击保存名称  ');
  await composer.click();
  await heading('点击保存名称').waitFor();
  assert(await composer.evaluate(element => element.getRootNode().activeElement === element), '保存后焦点保留在点击位置');
  await page.getByRole('navigation', { name: '应用导航' }).getByRole('button', { name: '点击保存名称', exact: true }).first().waitFor();

  await edit.click();
  await input.fill('   ');
  await composer.click();
  await heading('点击保存名称').waitFor();
  await edit.click();
  await input.press('Tab');
  await heading('点击保存名称').waitFor();
  await edit.click();
  await input.fill('丢弃这个草稿');
  await input.press('Escape');
  await heading('点击保存名称').waitFor();
  assert(submissions.length === 1, '空白、不变和 Esc 均不发送请求');

  await page.route(renameUrl, route => route.fulfill({
    status: 500, json: { error: { code: 'TEST_FAILURE', message: '重命名验收失败' } },
  }), { times: 1 });
  await edit.click();
  await input.fill('保留并重试');
  await input.press('Tab');
  await page.getByText('重命名验收失败', { exact: true }).waitFor();
  assert(await input.inputValue() === '保留并重试', '保存失败保留原草稿');
  await input.focus();
  await input.press('Tab');
  await heading('保留并重试').waitFor();
  assert(JSON.stringify(submissions) === JSON.stringify(['点击保存名称', '保留并重试', '保留并重试']), '每次失焦只提交一次');
  return { passed: ['点击失焦保存', '焦点保留', '侧栏同步', '空白与未改名处理', 'Esc 取消', 'Tab 保存与失败重试'] };
}
