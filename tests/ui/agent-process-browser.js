// Playwright CLI：run-code --filename tests/ui/agent-process-browser.js
async page => {
  const passed = [], errors = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const frame = page.frameLocator('iframe');
  const choose = async (name, state = 'default') => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.locator('#example-state').selectOption(state);
    await page.waitForTimeout(350);
  };
  try {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await choose('ThinkingContent 4');
    const thinking = frame.locator('.pl-thinking-content');
    await thinking.waitFor();
    assert(await thinking.locator('.pl-markdown').count() === 1, 'C04 复用 Markdown 排版');
    assert(await thinking.locator('button, .plotloom-scroll-box').count() === 0, 'C04 不包含独立阅读控制');
    await page.locator('#example-state').selectOption('long'); await page.waitForTimeout(250);
    assert(await thinking.evaluate(el => el.clientHeight >= el.scrollHeight - 1), 'C04 长文本自然撑高');
    await page.locator('#example-state').selectOption('empty'); await page.waitForTimeout(250);
    assert(await thinking.count() === 0, 'C04 空文本不占位');
    await page.getByRole('textbox', { name: '公开思考文本', exact: true }).fill('   '); await page.waitForTimeout(120);
    assert(await thinking.count() === 0, 'C04 空白文本不补造内容');
    await page.locator('#example-state').selectOption('streaming'); await thinking.waitFor();
    const before = await thinking.innerText(); await page.waitForTimeout(350);
    assert(await thinking.innerText() !== before, 'C04 同一段思考接收文本增量');

    await choose('ToolCallItem 7', 'running');
    const tool = frame.locator('.pl-tool-call');
    await tool.waitFor();
    const details = tool.locator('.pl-process-node__details');
    assert(!await details.isVisible(), 'C06 工具详情默认收起');
    const closedHeight = (await tool.boundingBox()).height;
    const titleBox = await tool.locator('.pl-process-node__title').boundingBox();
    for (const status of ['completed', 'failed', 'stopped', 'running']) {
      await page.getByRole('combobox', { name: '执行状态', exact: true }).selectOption(status);
      await page.waitForTimeout(80);
      assert(!await details.isVisible() && (await tool.boundingBox()).height === closedHeight, `C06 ${status} 不自动展开、不改变行高度`);
    }
    assert(JSON.stringify(titleBox) === JSON.stringify(await tool.locator('.pl-process-node__title').boundingBox()), 'C06 状态快速切换不挤动标题');
    await tool.getByRole('button').focus(); await page.keyboard.press('Enter');
    assert(await details.isVisible(), 'C06 键盘展开输入和结果');
    await page.getByRole('textbox', { name: '工具结果', exact: true }).fill('<script>window.processInjected = true</script>\n  原始缩进');
    assert((await tool.locator('pre[aria-label="工具结果"]').innerText()).includes('<script>'), 'C06 HTML 按字面文本显示');
    assert(await tool.locator('script').count() === 0, 'C06 不生成脚本元素');
    await page.getByRole('combobox', { name: '执行状态', exact: true }).selectOption('completed');
    assert(await details.isVisible(), 'C06 完成后保留用户展开选择');
    await tool.getByRole('button').focus(); await page.keyboard.press('Space');
    assert(!await details.isVisible(), 'C06 键盘收起详情');
    await page.locator('#example-state').selectOption('no-details'); await page.waitForTimeout(250);
    assert(await tool.getByRole('button').count() === 0, 'C06 无输入结果不提供空展开入口');
    await page.locator('#example-state').selectOption('empty'); await page.waitForTimeout(250);
    await tool.getByRole('button').click();
    assert(await tool.getByText('（空结果）', { exact: true }).isVisible(), 'C06 区分空结果与缺失结果');
    await page.locator('#example-state').selectOption('long'); await page.waitForTimeout(250);
    await tool.getByRole('button').click();
    assert(await tool.locator('pre').evaluateAll(els => els.every(el => el.clientHeight >= el.scrollHeight - 1)), 'C06 长输入结果不设置嵌套纵向滚动');
    await page.getByRole('button', { name: '窄屏', exact: true }).click(); await page.waitForTimeout(180);
    assert(await tool.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'C06 窄屏原文软换行无横向溢出');
    await tool.screenshot({ path: 'output/playwright/tool-call-long.png' });

    await choose('ExecutionTimeline 10');
    const timeline = frame.locator('.pl-execution-timeline');
    const scroll = timeline.locator('.pl-execution-timeline__viewport');
    const ids = () => timeline.locator('li[data-entry-id]').evaluateAll(els => els.map(el => el.dataset.entryId));
    assert(JSON.stringify(await ids()) === JSON.stringify(['think-1', 'message-1', 'read-1', 'think-2', 'edit-1', 'message-2', 'test-1']), 'C05 思考说明工具按输入顺序穿插');
    assert(await timeline.locator('.plotloom-scroll-box').count() === 1, 'C05 整体只有一个过程滚动视口');
    const read = timeline.locator('[data-entry-id="read-1"]');
    await read.getByRole('button').click();
    const retained = await read.elementHandle();
    await page.getByRole('combobox', { name: '编辑过程节点', exact: true }).selectOption('2');
    await page.getByRole('combobox', { name: '执行状态', exact: true }).selectOption('failed');
    await page.getByRole('textbox', { name: '工具结果', exact: true }).fill('同一个工具调用的后续结果');
    assert(await retained.evaluate(el => el.isConnected) && await read.locator('.pl-process-node__details').isVisible(), 'C05 原位状态与结果更新保留节点和展开选择');
    assert((await ids())[2] === 'read-1', 'C05 更新工具不移动原位置');
    await page.getByRole('checkbox', { name: '模拟过程流式输入', exact: true }).check();
    await scroll.evaluate(el => { el.scrollTop = 0; }); await page.waitForTimeout(150);
    await read.getByRole('button').click(); await read.getByRole('button').click();
    await page.waitForTimeout(1100);
    assert(await scroll.evaluate(el => el.scrollTop < 5), 'C05 检查历史详情期间新事件不拉走阅读位置');
    await frame.getByRole('button', { name: '暂停流式', exact: true }).click();
    const count = (await ids()).length;
    await page.waitForTimeout(1100);
    assert((await ids()).length === count, 'C05 暂停流式不继续追加');
    await page.locator('#example-state').selectOption('no-thinking'); await page.waitForTimeout(250);
    assert(await timeline.locator('[data-entry-type="thinking"]').count() === 0 && await timeline.locator('[data-entry-type="tool"]').count() === 3, 'C05 无思考模型仍展示工具和过程说明');
    await page.locator('#example-state').selectOption('events'); await page.waitForTimeout(250);
    assert(await timeline.locator('[data-entry-type="event"]').count() === 2, 'C05 支持重试和上下文整理事件');
    await timeline.getByRole('button', { name: '展开全部', exact: true }).click();
    await timeline.getByRole('button', { name: '展开上下文整理详情', exact: true }).click();
    assert(await timeline.getByText('保留摘要，继续当前任务。', { exact: true }).isVisible(), 'C05 事件详情可展开追溯');
    await timeline.screenshot({ path: 'output/playwright/execution-timeline-events.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await timeline.locator('.pl-process-node__icon[data-status="running"] svg').evaluateAll(els => els.every(el => getComputedStyle(el).animationName === 'none')), '系统减少动态效果停止过程状态动画');
    assert(errors.length === 0, `无未捕获浏览器异常：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); await page.emulateMedia({ reducedMotion: 'no-preference' }); }
}
