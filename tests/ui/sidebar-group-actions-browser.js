// 在正式前端运行，分组和会话请求全部使用夹具，覆盖部分失败后的重试和单独移除分组。
async page => {
  const check = (value, label) => { if (!value) throw Error(label); };
  const project = { id: 'sample', name: '样例项目', path: 'D:/sample', createdAt: '2026-11-22T00:00:00Z' };
  const book = { id: 'book', title: '样例小说', root: 'D:/book', createdAt: project.createdAt };
  const chat = { workspaceId: null, projectPath: project.path, archived: false, pinned: true, updatedAt: project.createdAt, status: 'idle', activity: 'idle' };
  const chats = [{ ...chat, id: 'one', name: '项目一' }, { ...chat, id: 'two', name: '项目二' },
    { ...chat, id: 'three', name: '小说对话', pinned: false, workspaceId: book.id }];
  const archives = [];
  await page.route('**/api/projects', route => route.fulfill({ json: { projects: [project] } }));
  await page.route('**/api/workspaces', route => route.fulfill({ json: { workspaces: [book] } }));
  await page.route('**/api/chats', route => route.fulfill({ json: { sessions: chats } }));
  await page.route('**/api/workspaces/book/shelf', route => {
    Object.assign(book, route.request().postDataJSON());
    return route.fulfill({ json: book });
  });
  await page.route('**/api/sessions/*/organization', route => {
    const id = route.request().url().split('/').at(-2);
    archives.push(id);
    if (id === 'two' && archives.length === 2)
      return route.fulfill({ status: 409, json: { error: { code: 'SESSION_BUSY', message: '会话忙' } } });
    const target = chats.find(c => c.id === id);
    target.archived = true;
    return route.fulfill({ json: { archived: true, pinned: target.pinned } });
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const action = name => page.getByRole('menuitem', { name, exact: true });
  await page.setViewportSize({ width: 768, height: 900 });
  await page.reload();
  const bookHeader = page.locator('.pl-sidebar-group-header__toggle').filter({ hasText: book.title });
  await bookHeader.waitFor();
  for (let i = 0; i < 3; i++) {
    const before = await bookHeader.boundingBox();
    await bookHeader.click({ button: 'right' });
    const menu = await page.getByRole('menu').boundingBox();
    check(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= 768 && menu.y + menu.height <= 900, '浮层在视口内');
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    const after = await bookHeader.boundingBox();
    check(before.y === after.y && before.height === after.height, '快速打开关闭保持行位置');
  }
  await bookHeader.click({ button: 'right' }); await action('移除小说').click(); await button('确认移除').click();
  await bookHeader.waitFor({ state: 'hidden' });
  await button('小说对话').waitFor();
  check(!archives.length, '移除分组不发送归档请求');
  await button(project.name).click({ button: 'right' }); await action('归档所有聊天').click();
  await button('确认归档').click();
  await page.getByText(/已完成 1 项，1 项失败/).first().waitFor();
  await button('确认归档').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  check(JSON.stringify(archives) === JSON.stringify(['one','two','two']), '只重试失败聊天');
  await button(project.name).click({ button: 'right' });
  check(await action('归档所有聊天').isDisabled(), '空分组禁用归档');
  return '已验证隐藏保留聊天、部分归档重试、空分组和浮层位置';
}
