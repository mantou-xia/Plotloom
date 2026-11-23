/* 用 playwright-cli run-code --filename 执行，使用公开协议的模拟响应。 */
async (page) => {
  const workspace = { id: 'quote-book', title: '潮声', root: 'D:\\novels\\潮声' };
  const model = { provider: 'test', id: 'writer', name: 'Writer', configured: true, thinkingLevels: ['off'], input: ['text'], contextWindow: 100000 };
  const session = { id: 'quote-chat', name: '修改章节', workspaceId: workspace.id, provider: model.provider,
    model: model.id, status: 'idle', activity: 'idle', thinkingLevel: 'off', updatedAt: '2026-11-23T00:00:00Z', messages: [] };
  const path = '正文章节/第一章.md';
  const content = '潮水淹过石阶。\r\n港口亮起灯。\r\n船在雾中靠岸。';
  const submissions = [];
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  await page.unroute('**/api/**');
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    if (pathname === '/api/chats') return json({ sessions: [session] });
    if (pathname === '/api/workspaces') return json({ workspaces: [workspace] });
    if (pathname === '/api/projects') return json({ projects: [] });
    if (pathname === '/api/models') return json({ models: [model] });
    if (pathname === '/api/model-config') return json({ provider: model.provider, model: model.id, thinkingLevel: 'off' });
    if (pathname === '/api/skills') return json({ skills: [] });
    if (pathname.endsWith('/documents')) return json({ paths: [path, '世界观.md'] });
    if (pathname.endsWith('/document-entries')) return json({ entries: [{ path, modifiedAt: session.updatedAt, excerpt: content }] });
    if (pathname.endsWith('/document/read')) return json({ path, content, version: 'a'.repeat(64) });
    if (pathname.endsWith('/config')) return json({ ...session, capabilities: model });
    if (pathname.endsWith('/context')) return json({ tokens: 0, contextWindow: 100000 });
    if (pathname.endsWith('/skills')) return json({ skills: [], skillIds: [] });
    if (pathname.endsWith('/sessions') && request.method() === 'POST') return json(session, 201);
    if (pathname.endsWith('/messages')) {
      submissions.push(request.postDataJSON());
      if (submissions.length === 1) return json({ error: { code: 'TEST_FAILURE', message: '发送失败测试' } }, 503);
      const { text, references } = submissions.at(-1);
      session.messages = [{ id: 'user-1', role: 'user', content: text ? [{ type: 'text', text }] : [], references: references.map(reference => {
        const line = content.slice(0, reference.selection.start).split('\r\n').length;
        return { ...reference, content: reference.selection.text, lineRange: { firstLine: line, lastLine: line } };
      }) }];
      return route.fulfill({ contentType: 'text/event-stream', body: 'event: accepted\ndata: ' +
        JSON.stringify({ sessionId: session.id, messageId: 'user-1' }) + '\n\nevent: completed\ndata: ' + JSON.stringify({ sessionId: session.id }) + '\n\n' });
    }
    if (pathname === `/api/sessions/${session.id}`) return json(session);
    return json({}, 404);
  });

  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto(new URL('/?chapter-quote-check=1#workspace=' + workspace.id, page.url()).href);
  await page.reload();
  await page.getByRole('heading', { name: '继续创作《潮声》' }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('收起工作区').isVisible()) await button('收起工作区').click();
  await button('打开工作区').click();
  const editor = page.getByRole('textbox', { name: '文稿正文' });
  await editor.waitFor();
  const list = page.getByRole('list', { name: '文稿引用', exact: true });
  const send = button('发送');
  await send.waitFor();
  const y = (await send.boundingBox()).y;
  require(await list.count() === 0 && await page.locator('[slot="draft-context"]').count() === 0, '空草稿不渲染引用槽位');
  const confirm = async note => {
    const comment = page.getByRole('textbox', { name: '备注或修改要求' });
    await comment.fill(note);
    require(await comment.evaluate(node => {
      const style = getComputedStyle(node);
      return document.activeElement === node && style.outlineStyle === 'none' && style.boxShadow === 'none';
    }), '备注输入框聚焦时不显示框线');
    await button('确认引用').click();
  };
  const add = async (line, note) => {
    await editor.focus();
    await page.keyboard.press('Control+Home');
    for (let index = 1; index < line; index++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+End');
    await confirm(note);
  };
  const line = await editor.getByText('潮水淹过石阶。', { exact: true }).evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().toJSON();
  });
  await page.mouse.move(line.left - 3, line.top + line.height / 2);
  await page.mouse.down();
  await page.mouse.move(line.right + 3, line.top + line.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('textbox', { name: '备注或修改要求' }).waitFor();
  await page.keyboard.press('Escape');
  await add(1, '加强氛围');
  await add(2, '保留光线变化。'.repeat(140));
  await add(3, '改为远景');
  require(await list.getByRole('listitem').count() === 3, '同一章节的多条选区应独立加入');
  require(Math.abs((await send.boundingBox()).y - y) < 1, '增加引用后发送按钮保持原位');
  require(await list.evaluate(node => !!node.closest('[slot="draft-context"]').assignedSlot.closest('[data-message-composer-surface]')),
    '引用位于输入框表面内');
  await list.getByRole('button', { name: '第一章.md · 第 1 行', exact: true }).hover();
  const tooltip = page.getByRole('tooltip').filter({ hasText: '潮水淹过石阶。' });
  await tooltip.waitFor();
  await tooltip.locator('.plotloom-chapter-quote-comment').getByText('加强氛围', { exact: true }).waitFor();
  await tooltip.locator('.plotloom-chapter-quote-original').getByText('潮水淹过石阶。', { exact: true }).waitFor();
  await tooltip.locator('.plotloom-scroll-box').waitFor();
  await list.getByRole('button', { name: '第一章.md · 第 2 行', exact: true }).hover();
  const previewScroll = page.getByRole('tooltip').filter({ hasText: '保留光线变化。' }).locator('.plotloom-scroll-box');
  await previewScroll.hover();
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(() => document.querySelector('.plotloom-chapter-quote-preview')?.scrollTop > 0);
  await button('移除引用 第一章.md · 第 2 行').click();
  require(await list.getByRole('listitem').count() === 2, '移除仅影响所选引用');
  require(await send.isEnabled(), '没有输入正文时仍可发送引用');
  await send.click();
  await page.getByText('发送失败测试', { exact: true }).waitFor();
  require(await list.getByRole('listitem').count() === 2, '失败应保留引用');
  await send.click();
  await page.getByRole('heading', { name: session.name }).waitFor();
  require(await list.getByRole('listitem').count() === 0, '接收后应清空已发送的引用');
  const { text, references } = submissions.at(-1);
  require(!text && references.length === 2 && references[0].path === path && references[0].editComment === '加强氛围' &&
    references[0].selection.text === '潮水淹过石阶。' && references[1].editComment === '改为远景' &&
    references[1].selection.start === content.indexOf('船在雾中靠岸。'), '引用独立提交并使用磁盘原始偏移');
  await add(2, '删掉这里');
  await button('移除引用 第一章.md · 第 2 行').click();
  await page.locator('[slot="draft-context"]').waitFor({ state: 'detached' });
  await add(2, '删掉这里');
  await send.click();
  await list.waitFor({ state: 'detached' });
  require(submissions.at(-1).references[0].selection.text === '港口亮起灯。', '已有对话也应能单独发送引用');
  await page.getByRole('list', { name: '已发送的文稿引用', exact: true }).getByRole('button', { name: '第一章.md · 第 2 行', exact: true }).hover();
  await page.getByRole('tooltip').filter({ hasText: '删掉这里' }).waitFor();
  await page.unroute('**/api/**');
}
