// Playwright CLI run-code --filename；隔离正式装配后端 4432，产品 4433，试验台 4434。
async (page) => {
  const passed = [];
  const assert = (value, label) => { if (!value) throw new Error(label); passed.push(label); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4433');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settingsNav = page.getByRole('navigation', { name: '设置导航' });
  const toolsButton = settingsNav.getByRole('button', { name: '工具', exact: true });
  const appearance = settingsNav.getByRole('button', { name: '外观', exact: true });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tools', async route => {
    await pending;
    await route.fulfill({ status: 500, json: { error: { message: '验收模拟失败' } } });
  });
  await toolsButton.click();
  const toolsPanel = page.getByRole('region', { name: 'ToolCall 工具清单' });
  const toolStatus = toolsPanel.getByRole('status');
  await toolStatus.getByText('正在加载工具…').waitFor();
  const statusBox = await toolStatus.boundingBox();
  release();
  await toolStatus.getByText('工具清单加载失败').waitFor();
  assert(JSON.stringify(await toolStatus.boundingBox()) === JSON.stringify(statusBox), '工具目录失败提示保持原位置');
  await page.unroute('**/api/tools');
  await appearance.click();
  await toolsButton.click();
  await appearance.click();
  await toolsButton.click();
  const browserTool = toolsPanel.getByRole('group', { name: 'browser', exact: true });
  const writeTool = toolsPanel.getByRole('group', { name: 'write', exact: true });
  await browserTool.waitFor();
  assert(await browserTool.getByText('Plotloom 浏览器（Playwright）', { exact: true }).isVisible(), '工具目录显示实际提供方');
  for (const name of ['browser', 'web_fetch']) {
    const tool = toolsPanel.getByRole('group', { name, exact: true });
    assert(await tool.getByText('项目聊天、小说聊天', { exact: true }).isVisible(), `${name} 显示适用于全部会话`);
  }
  assert(await writeTool.getByText('项目聊天、小说聊天', { exact: true }).isVisible(), '文件写入工具显示实际会话范围');
  assert(await writeTool.getByText(/按会话审批模式决定/).isVisible(), '文件写入工具显示批准限制');
  const details = toolsPanel.locator('.plotloom-tool-row dl');
  assert(await details.evaluateAll(nodes => nodes.length > 1 && nodes.every(node =>
    Math.abs(node.getBoundingClientRect().left - nodes[0].getBoundingClientRect().left) < 1
    && Math.abs(node.querySelector('dd').getBoundingClientRect().left - nodes[0].querySelector('dd').getBoundingClientRect().left) < 1
  )), '工具清单右栏标签和值逐行对齐');
  assert(JSON.stringify(await toolStatus.boundingBox()) === JSON.stringify(statusBox), '成功加载后状态位置稳定');
  await page.reload();
  await browserTool.waitFor();
  assert(new URL(page.url()).hash === '#settings=tools', '工具设置支持直接访问及刷新');
  await page.screenshot({ path: 'output/playwright/tools-settings.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await toolsPanel.evaluate(node => node.scrollWidth <= node.clientWidth), '工具清单窄屏无横向溢出');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settingsNav.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '技能', exact: true }).click();
  const trigger = page.getByRole('button', { name: '查看 novel-writing 详情' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'novel-writing' });
  await dialog.waitFor();
  assert(await dialog.getByText(/参照作者样文与作品声音写章/).isVisible(), '技能详情展示实际用途');
  assert(await dialog.getByText(/适用聊天：小说聊天/).isVisible(), '技能详情展示用户可识别的适用范围');
  assert(await dialog.getByRole('heading', { name: '技能专用 ToolCall' }).isVisible(), '技能详情展示专用工具');
  for (const name of ['propose_change', 'write_chapter_part', 'deliver_chapter', 'manuscript_workspace']) {
    assert(await dialog.getByText(name, { exact: true }).isVisible(), `技能详情含 ${name}`);
  }
  assert(await dialog.getByText(/聊天基础工具|环境要求|^read$|^read_skill$|^browser$|^web_fetch$|^import_chapters$/).count() === 0, '技能详情略去通用工具及无关工具');
  assert(await dialog.getByRole('switch').count() === 0, '一级技能详情只读');
  await page.keyboard.press('Escape');
  assert(await trigger.evaluate(node => node === document.activeElement), 'Escape 关闭并恢复焦点');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('navigation', { name: '设置导航' }).getByRole('button', { name: '技能', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'novel-writing', exact: true });
  const row = page.getByRole('group', { name: 'novel-writing', exact: true });
  const baseline = await row.boundingBox();
  const switchBox = await toggle.boundingBox();
  for (let i = 0; i < 4; i++) {
    const saved = page.waitForResponse(response => response.url().endsWith('/builtin-novel-writing/enabled') && response.request().method() === 'PUT');
    await toggle.click(); await saved;
    await page.waitForFunction(() => !document.querySelector('[role="switch"]')?.hasAttribute('disabled'));
    const box = await row.boundingBox(); const control = await toggle.boundingBox();
    assert(JSON.stringify(box) === JSON.stringify(baseline) && JSON.stringify(control) === JSON.stringify(switchBox), `切换 ${i + 1} 后设置行和控件位置稳定`);
  }
  assert(await toggle.getAttribute('aria-checked') === 'true', '全局开关保存并回显');
  // 延迟响应覆盖保存中状态；快速点击不能发出重复写请求。
  let requests = 0;
  await page.route('**/api/skills/builtin-novel-writing/enabled', async route => {
    requests++; await new Promise(resolve => setTimeout(resolve, 350)); await route.continue();
  });
  await toggle.click();
  assert(await toggle.isDisabled(), '保存中禁用重复提交');
  await toggle.evaluate(node => { node.click(); node.click(); });
  assert(JSON.stringify(await row.boundingBox()) === JSON.stringify(baseline), '保存中不改变设置行位置');
  await page.waitForResponse(response => response.url().endsWith('/builtin-novel-writing/enabled'));
  await page.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'false');
  assert(requests === 1, '快速点击只发送一次保存');
  await page.unroute('**/api/skills/builtin-novel-writing/enabled');
  await page.route('**/api/skills/builtin-novel-writing/enabled', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_FAILED', message: '保存失败验收' } }) }));
  await toggle.click();
  await page.getByText('保存失败验收', { exact: true }).waitFor();
  assert(await toggle.getAttribute('aria-checked') === 'false', '保存失败保留服务端开关值');
  assert(JSON.stringify(await row.boundingBox()) === JSON.stringify(baseline), '错误 toast 不挤动设置行');
  await page.unroute('**/api/skills/builtin-novel-writing/enabled');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await trigger.click();
  await dialog.getByText(/全局状态：已停用/).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '技能', exact: true }).click();
  await trigger.click();
  assert(await dialog.getByText(/全局状态：已停用/).isVisible(), '刷新页面保留全局关闭状态');
  await page.screenshot({ path: 'output/skill-tools-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await dialog.evaluate(node => node.getBoundingClientRect().right <= innerWidth && node.getBoundingClientRect().left >= 0), '窄屏弹窗不横向溢出');
  await page.screenshot({ path: 'output/skill-tools-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4434/#tools.list');
  await page.locator('#send-request').click();
  await page.waitForFunction(() => document.querySelector('#result-state')?.getAttribute('data-phase') === 'success');
  assert((await page.locator('#result-content').innerText()).includes('通过'), '试验台工具目录实际请求通过字段检查');
  assert((await page.locator('#result-content').innerText()).includes('Plotloom 浏览器（Playwright）'), '试验台响应展示工具提供方');
  await page.goto('http://127.0.0.1:4434/#skills.enabled');
  await page.locator('[data-path-parameter="skillId"]').fill('builtin-novel-writing');
  await page.locator('#request-body').fill(JSON.stringify({ enabled: false }));
  await page.locator('#send-request').click();
  await page.waitForFunction(() => document.querySelector('#result-state')?.getAttribute('data-phase') === 'success');
  assert((await page.locator('#result-meta').innerText()).includes('200'), '试验台实际关闭技能成功');
  await page.locator('#request-body').fill(JSON.stringify({ enabled: 'false' }));
  await page.locator('#send-request').click();
  await page.waitForFunction(() => document.querySelector('#result-meta')?.textContent?.includes('400'));
  passed.push('试验台非法开关参数返回 400');
  await page.locator('#request-body').fill(JSON.stringify({ enabled: true }));
  await page.locator('#send-request').click();
  await page.waitForFunction(() => document.querySelector('#result-meta')?.textContent?.includes('200'));
  await page.screenshot({ path: 'output/skill-tools-demo.png' });
  return passed;
}
