// Playwright CLI：组件调试台 run-code --filename tests/ui/workspace-tabs-browser.js
async (page) => {
  const passed = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  await page.setViewportSize({ width: 1800, height: 1100 });
  await page.getByRole('button', { name: 'WorkspaceTabs 5', exact: true }).click();
  const frame = page.frameLocator('iframe');
  const root = frame.locator('.pl-workspace-tabs');
  await root.waitFor();
  await frame.getByRole('textbox', { name: '页面 1 草稿' }).fill('独立草稿一');
  const scroll = root.locator('.pl-workspace-tabs__page:visible .pl-workspace-tabs__content');
  await scroll.evaluate(el => { el.scrollTop = 260; });
  await frame.getByRole('tab', { name: '页面 2', exact: true }).click();
  await frame.getByRole('textbox', { name: '页面 2 草稿' }).fill('独立草稿二');
  await scroll.evaluate(el => { el.scrollTop = 150; });
  await frame.getByRole('tab', { name: '页面 1', exact: true }).click();
  assert(await frame.getByRole('textbox', { name: '页面 1 草稿' }).inputValue() === '独立草稿一', '各页输入独立保留');
  assert(await scroll.evaluate(el => el.scrollTop) === 260, '第一标签保留滚动位置');
  await frame.getByRole('tab', { name: '页面 2', exact: true }).click();
  assert(await scroll.evaluate(el => el.scrollTop) === 150, '第二标签保留独立滚动位置');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(60);
  assert(await frame.getByRole('tab', { name: '页面 1', exact: true }).evaluate(el => el === el.ownerDocument.activeElement), 'Delete关闭并恢复邻页焦点');
  await page.locator('#example-state').selectOption('fixed');
  await frame.getByRole('tab', { name: '页面 1', exact: true }).click();
  await page.keyboard.press('Delete');
  assert(await frame.getByRole('tab', { name: '页面 1', exact: true }).count() === 1 && await frame.getByRole('button', { name: '关闭标签：页面 1', exact: true }).count() === 0, '不可关闭标签同时约束键盘和按钮');
  await page.locator('#example-state').selectOption('overflow');
  await frame.getByRole('tab').first().click();
  await page.keyboard.press('End');
  assert(await frame.getByRole('tab').last().getAttribute('aria-selected') === 'true', '溢出标签可键盘选中');
  assert(await root.locator('.pl-workspace-tabs__list').evaluate(el => el.scrollLeft > 0), '选中末尾标签自动滚入可视区');
  await root.screenshot({ path: 'output/playwright/workspace-tabs-workbench.png' });
  await page.locator('#example-state').selectOption('empty');
  assert(await frame.getByRole('tab').count() === 0, '空态参数生效');
  await frame.getByRole('button', { name: '新建标签', exact: true }).click();
  assert(await frame.getByRole('tab').count() === 1, '新增回调创建内容页');
  return { total: passed.length, passed };
}
