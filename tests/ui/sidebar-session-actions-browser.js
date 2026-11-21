// 在独立 Playwright CLI 会话中运行，使用公开 API 的固定数据检查产品侧栏。
async page => {
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const project = { id: 'project', name: '项目验收', path: 'D:\\sidebar-fixture' };
  const chat = { id: 'session', name: '项目分组中的长会话名称', projectPath: project.path, workspaceId: null,
    activity: 'awaiting_approval', status: 'running', pinned: false, archived: false,
    updatedAt: new Date(Date.now() - 53 * 60_000).toISOString() };
  const changes = [];
  await page.route('**/api/chats', route => route.fulfill({ json: { sessions: [{ ...chat }, {
    ...chat, id: 'neighbor', name: '相邻会话', status: 'idle', activity: 'idle',
  }] } }));
  await page.route('**/api/projects', route => route.fulfill({ json: { projects: [project] } }));
  await page.route('**/api/workspaces', route => route.fulfill({ json: { workspaces: [] } }));
  await page.route('**/api/sessions/session/organization', route => {
    const update = route.request().postDataJSON();
    changes.push(update);
    Object.assign(chat, update);
    return route.fulfill({ json: chat });
  });
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.reload();
  const group = page.locator('.pl-sidebar-group').filter({ has: page.getByRole('button', { name: project.name, exact: true }) });
  const title = group.getByRole('button', { name: chat.name, exact: true });
  const row = title.locator('..');
  const neighbor = group.getByRole('button', { name: '相邻会话', exact: true });
  const toolbar = row.locator('.pl-session-metadata');
  const pin = row.getByRole('button', { name: '置顶会话', exact: true });
  const archive = row.getByRole('button', { name: '归档会话', exact: true });
  const handle = page.getByRole('separator', { name: '调整侧边栏宽度', exact: true });
  const hoverTitle = () => title.hover({ position: { x: 10, y: 19 } });
  await title.waitFor();
  const resting = (await neighbor.boundingBox()).y;
  const rowHeight = (await row.boundingBox()).height;
  const drag = async target => {
    const box = await handle.boundingBox();
    const current = Number(await handle.getAttribute('aria-valuenow'));
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x + target - current, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(width => document.querySelector('.plotloom-global-layout__handle').getAttribute('aria-valuenow') === String(width), target);
  };

  await drag(Number(await handle.getAttribute('aria-valuemin')));
  await hoverTitle();
  await pin.click({ trial: true });
  assert(await page.getByRole('navigation', { name: '应用导航' }).getByRole('button', { name: '重命名对话', exact: true }).count() === 0,
    '侧栏会话条目没有重命名入口');
  assert(await toolbar.getAttribute('data-compact') !== null, '最窄分组里时间和状态收起文字');
  for (const action of [pin, archive]) {
    assert(await action.evaluate(button => {
      const row = button.closest('.pl-sidebar-session-item').getBoundingClientRect();
      const box = button.getBoundingClientRect();
      // 从按钮左右内缘命中，检测按钮虽然有宽度却被父容器裁切的情况。
      return box.width === 28 && box.left >= row.left && box.right <= row.right &&
        [box.left + 2, box.right - 2].every(x => button.contains(document.elementFromPoint(x, box.top + box.height / 2)));
    }), '展开后的两个操作按钮完整可点');
    await action.hover();
    const label = await action.getAttribute('aria-label');
    await page.getByRole('tooltip', { name: label, exact: true }).and(page.locator('.pl-tooltip[data-open]')).waitFor();
  }
  await page.mouse.move(900, 50);
  await page.locator('.pl-tooltip').last().waitFor({ state: 'detached' });
  await hoverTitle();
  await page.mouse.move(900, 50);
  await hoverTitle();
  assert((await row.boundingBox()).height === rowHeight && (await neighbor.boundingBox()).y === resting, '快速切换保持行高和相邻位置');

  await pin.click();
  await row.getByRole('button', { name: '取消置顶', exact: true }).waitFor();
  await title.focus();
  for (const action of [row.getByRole('button', { name: '取消置顶', exact: true }), archive]) {
    await page.keyboard.press('Tab');
    assert(await action.evaluate(button => button === document.activeElement), '键盘按顺序进入置顶和归档');
    const label = await action.getAttribute('aria-label');
    await page.getByRole('tooltip', { name: label, exact: true }).and(page.locator('.pl-tooltip[data-open]')).waitFor();
  }

  await drag(Number(await handle.getAttribute('aria-valuemax')));
  await hoverTitle();
  assert(await toolbar.getAttribute('data-compact') === null, '拖宽后恢复时间和状态文字');
  await drag(Number(await handle.getAttribute('aria-valuemin')));
  await hoverTitle();
  await archive.click();
  await row.waitFor({ state: 'hidden' });
  assert(JSON.stringify(changes) === JSON.stringify([{ pinned: true }, { archived: true }]), '鼠标操作提交对应的置顶和归档');
  return { passed: ['侧栏没有重命名入口', '最窄项目分组', '置顶和归档完整命中', '鼠标和键盘提示', '快速切换位置稳定', '键盘焦点顺序', '拖宽恢复文字', '点击业务操作'] };
}
