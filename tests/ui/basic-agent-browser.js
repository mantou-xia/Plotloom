// 通过正式产品页面和真实公开接口运行；模型协议替身由 tests/ui/basic-agent-server.ts 提供。
async page => {
  const assert = (value, label) => { if (!value) throw new Error(label); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  const origin = new URL(page.url()).origin;
  const id = () => new URLSearchParams(new URL(page.url()).hash.slice(1)).get('chat');
  const detail = async () => (await page.request.get(`${origin}/api/sessions/${id()}`)).json();
  // API 条件在宿主显式 await，不把 Promise 当成浏览器同步轮询的真值。
  const waitDetail = async predicate => {
    for (let attempt = 0; attempt < 150; attempt++) {
      const value = await detail(); if (predicate(value)) return value;
      await page.waitForTimeout(100);
    }
    throw new Error('会话未达到预期状态');
  };
  const idle = async () => {
    await waitDetail(value => value.status === 'idle');
    await page.waitForTimeout(600);
  };
  const send = async text => {
    const previous = (await detail()).messages.filter(m => m.role === 'user').length;
    await page.getByRole('textbox', { name: '尽管问...' }).fill(text); await page.getByRole('button', { name: '发送', exact: true }).click();
    await waitDetail(value => value.messages.filter(m => m.role === 'user').length > previous);
  };
  const results = [];
  const created = await (await page.request.post(`${origin}/api/sessions`, { data: { name: '新聊天' } })).json();
  await page.goto(`${origin}/#chat=${created.id}`); await page.reload();
  const collapseWorkspace = page.getByRole('button', { name: '收起工作区', exact: true });
  if (await collapseWorkspace.isVisible()) await collapseWorkspace.click();
  await send('正式产品简单对话验收'); await idle();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const copy = page.getByRole('button', { name: '复制回答', exact: true }).last();
  await copy.scrollIntoViewIfNeeded(); const beforeCopy = await copy.boundingBox(); await copy.click();
  const copied = page.getByRole('button', { name: '已复制回答', exact: true });
  await copied.waitFor(); const afterCopy = await copied.boundingBox();
  assert(beforeCopy.x === afterCopy.x && beforeCopy.y === afterCopy.y, '复制反馈不得移动按钮');
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes('正式产品简单对话验收'), '复制原文');
  const before = await detail();
  await page.getByRole('button', { name: '重新生成', exact: true }).last().click(); await idle();
  assert((await detail()).messages.filter(m => m.role === 'user').length === before.messages.filter(m => m.role === 'user').length + 1, '重试保留旧历史');
  const savedUrl = page.url(); await page.reload(); await page.getByRole('heading', { name: '新聊天', exact: true }).waitFor();
  assert(page.url() === savedUrl, '刷新保留当前聊天');
  if (await collapseWorkspace.isVisible()) await collapseWorkspace.click();
  results.push('简单对话、复制反馈、重试和刷新');

  await send('THINK'); await idle();
  const finishedTurn = page.locator('.plotloom-chat__turn').last();
  const duration = finishedTurn.getByRole('button', { name: '展开执行过程', exact: true });
  assert(await duration.getAttribute('aria-expanded') === 'false' && (await duration.innerText()).includes('用时'), '完成后默认收起并显示耗时');
  assert(!(await finishedTurn.locator('.pl-agent-activity__header').isVisible()), '完成后隐藏运行状态栏');
  await duration.click();
  assert((await page.getByRole('region', { name: '过程记录', exact: true }).last().innerText()).includes('思考'), '可见思考进入过程');
  await send('TOOL'); await idle();
  await page.getByRole('button', { name: '展开执行过程', exact: true }).last().click();
  assert(await page.locator('.plotloom-chat__turn').last().locator('[data-entry-type="tool"]').count() === 1, '工具输入输出合并一个节点');
  results.push('思考与工具过程');

  const long = '# 长内容\n\n' + '阅读位置测试。\n\n'.repeat(55);
  await send('WRITE:' + JSON.stringify({ steps: [], finalText: long })); await idle();
  await send('WAIT:ui-scroll');
  await page.getByRole('button', { name: '停止', exact: true }).waitFor();
  const activeTurn = page.locator('.plotloom-chat__turn').last();
  await activeTurn.getByRole('region', { name: '过程记录', exact: true }).waitFor();
  const header = activeTurn.locator('.pl-agent-activity__header');
  assert(await header.locator('.pl-agent-activity__thinking-icon').isVisible(), '运行中显示活动图标');
  const activity = header.getByRole('status');
  assert(await activity.isVisible() && (await activity.innerText()).trim(), '运行中显示当前活动文字');
  assert(!(await activeTurn.getByLabel('回答操作', { exact: true }).isVisible()), '生成中隐藏当前回答工具条');
  assert(await page.getByRole('button', { name: '复制回答', exact: true }).first().isVisible(), '历史回答仍可复制');
  await page.waitForTimeout(700);
  await page.getByLabel('聊天记录', { exact: true }).evaluate(element => { element.scrollTop = 60; });
  await page.waitForTimeout(500);
  const top = await page.getByLabel('聊天记录', { exact: true }).evaluate(element => element.scrollTop);
  await page.waitForTimeout(800);
  assert(Math.abs((await page.getByLabel('聊天记录', { exact: true }).evaluate(element => element.scrollTop)) - top) < 2, '生成中向上阅读不被抢走');
  await page.getByRole('button', { name: '回到最新消息', exact: true }).click();
  const composerBefore = await page.locator('.plotloom-chat__bottom').boundingBox();
  await page.getByRole('button', { name: '停止', exact: true }).click(); await idle();
  assert((await detail()).messages.findLast(m => m.role === 'user').outcome === 'aborted', '停止落盘');
  assert(!(await activeTurn.getByLabel('回答操作', { exact: true }).isVisible()), '停止后只显示状态行的恢复操作');
  const composerAfter = await page.locator('.plotloom-chat__bottom').boundingBox();
  assert(Math.abs(composerBefore.y - composerAfter.y) < 2, '停止反馈不挤动输入区');
  await page.getByRole('button', { name: '重试生成', exact: true }).last().click();
  await page.getByRole('button', { name: '停止', exact: true }).waitFor();
  await page.getByRole('button', { name: '停止', exact: true }).click(); await idle();
  await send('FAIL'); await idle();
  await waitDetail(value => value.status === 'idle' && value.messages.findLast(m => m.role === 'user').outcome === 'failed');
  results.push('阅读跟随、停止、停止后重试、失败');

  await page.locator('input[type="file"]').setInputFiles('output/preview.txt');
  await page.getByRole('button', { name: '移除附件 preview.txt', exact: true }).waitFor();
  await send('查看附件'); await idle();
  await page.reload();
  if (await collapseWorkspace.isVisible()) await collapseWorkspace.click();
  await page.getByRole('button', { name: '打开 preview.txt', exact: true }).click();
  await page.getByRole('dialog', { name: 'preview.txt', exact: true }).getByText('preview-test', { exact: true }).waitFor();
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  results.push('附件卡片和真实内容弹窗');

  const site = 'http://127.0.0.1:4435/';
  const navigate = { name: 'browser', args: { action: 'navigate', url: site } };
  await send('WRITE:' + JSON.stringify({ steps: [
    navigate,
    { name: 'browser', args: { action: 'fill', selector: 'input[name=value]', text: '产品页面真实提交' } },
    { name: 'browser', args: { action: 'click', selector: 'button' } }
  ], finalText: `浏览器操作已完成。[来源](#plotloom-source-{{source:0}}) [表单链接](${site}) [未知来源](#plotloom-source-unknown)` })); await idle();
  const browserDetail = await detail();
  assert(browserDetail.messages.some(m => m.role === 'tool' && m.content.some(b => b.text?.includes('产品页面真实提交'))), '真实浏览器填写点击');
  const browserTurn = page.locator('.plotloom-chat__turn').last();
  const siteTitle = 'Plotloom 浏览器验收';
  const marker = browserTurn.getByRole('button', { name: `查看来源 1：${siteTitle}`, exact: true });
  await marker.click();
  const citationDetail = page.getByRole('dialog', { name: '来源详情', exact: true });
  assert(await citationDetail.getByRole('link', { name: '打开网页' }).getAttribute('href') === site, '正文引用打开实际访问过的网页');
  await citationDetail.getByRole('button', { name: '关闭弹窗' }).click();
  await browserTurn.getByRole('button', { name: '引用来源 · 1', exact: true }).click();
  const citationList = page.getByRole('dialog', { name: '引用来源', exact: true });
  await citationList.getByRole('button', { name: `查看来源 1：${siteTitle}`, exact: true }).click();
  assert(await citationList.getByRole('link', { name: '打开网页' }).getAttribute('href') === site, '来源列表与正文标记打开同一网页');
  await citationList.getByRole('button', { name: '关闭弹窗' }).click();
  assert(!(await browserTurn.getByText('未知来源', { exact: true }).isVisible()), '未知来源不产生标记');
  assert(await browserTurn.getByRole('link', { name: '表单链接', exact: true }).getAttribute('href') === site, '回答中的链接仍可访问');
  assert(!(await browserTurn.getByText('本轮资料', { exact: true }).isVisible()), '回答末尾没有单独的资料清单');
  const expandProcess = browserTurn.getByRole('button', { name: '展开执行过程', exact: true });
  await expandProcess.waitFor();
  assert(!(await browserTurn.getByRole('link', { name: siteTitle, exact: true }).first().isVisible()), '完成后默认收起执行过程');
  await expandProcess.click();
  const firstStep = browserTurn.locator('[data-entry-type="tool"]').first();
  await firstStep.getByRole('button', { name: '展开browser详情', exact: true }).click();
  assert(await firstStep.getByRole('link', { name: siteTitle, exact: true }).getAttribute('href') === site, '页面链接属于对应的访问步骤');
  await page.screenshot({ path: 'output/playwright/basic-agent-browser.png' });
  await page.reload();
  if (await collapseWorkspace.isVisible()) await collapseWorkspace.click();
  await marker.waitFor();
  results.push('浏览器访问记录、正文引用、来源入口、刷新恢复');
  await send('WRITE:' + JSON.stringify({ steps: [navigate], waitBefore: 1 }));
  const runningDetail = await waitDetail(value => value.status === 'running' && value.messages.at(-1)?.streaming);
  const request = runningDetail.messages.findLast(message => message.role === 'user');
  // 接口快照可能先于页面轮询更新，以本轮 ID 等待对应节点。
  const runningTurn = page.locator(`[data-turn-id="${request.turnId ?? request.id}"]`);
  await runningTurn.getByRole('button', { name: '展开browser详情', exact: true }).click();
  const visited = runningTurn.getByRole('link', { name: siteTitle, exact: true });
  assert(await visited.getAttribute('href') === site, '生成中可以从工具详情查看访问页面');
  assert(!(await runningTurn.getByText('本轮资料', { exact: true }).isVisible()), '生成中没有外部资料清单');
  assert(!(await runningTurn.getByRole('button', { name: /引用来源/ }).isVisible()), '仅访问网页不产生引用入口');
  await page.getByRole('button', { name: '停止', exact: true }).click(); await idle();
  assert((await detail()).messages.findLast(m => m.role === 'user').outcome === 'aborted', '网页访问后可停止');
  assert(await visited.isVisible(), '停止后仍可查看已访问页面');
  results.push('生成和停止期间网页留在执行过程');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/basic-agent-mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '窄屏不横向溢出');
  return { results, sessionId: id(), turnCount: (await detail()).messages.filter(m => m.role === 'user').length };
}
