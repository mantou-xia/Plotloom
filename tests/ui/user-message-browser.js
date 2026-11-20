// Playwright CLI：run-code --filename tests/ui/user-message-browser.js
async (page) => {
  const passed = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const root = frame.getByRole('article', { name: '用户消息', exact: true });
  const text = root.locator('.pl-user-message__text');
  const input = page.getByRole('textbox', { name: '用户原文', exact: true });
  const select = async state => {
    await page.locator('#example-state').selectOption(state);
    await page.waitForTimeout(200);
  };
  try {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.getByRole('button', { name: 'UserMessageBubble 7', exact: true }).click();
    await root.waitFor();
    assert(await text.textContent() === await input.inputValue(), '短文本完整显示');
    const parent = frame.locator('.pl-example-target');
    const parentBox = await parent.boundingBox(), shortBox = await root.boundingBox();
    assert(Math.abs(shortBox.x + shortBox.width - parentBox.x - parentBox.width) < 1, '消息靠右对齐');
    assert(shortBox.width < parentBox.width * .85, '短文本宽度随内容收缩');
    assert(await root.getByRole('group', { name: '消息附件' }).count() === 0, '无附件时不渲染附件区域');
    assert(await text.evaluate(el => { const s = getComputedStyle(el); return s.borderTopWidth === '0px' && s.boxShadow === 'none'; }), '文本气泡不叠加边框与阴影');
    await root.screenshot({ path: 'output/playwright/user-message-short.png' });

    await select('multiline');
    assert(await text.textContent() === await input.inputValue(), '多行与缩进逐字保留');
    assert(await text.evaluate(el => getComputedStyle(el).whiteSpace) === 'pre-wrap', '排版保留换行和连续空白');
    const original = '  前导空格\n\n\t缩进与中文  空格\n末尾空格  ';
    await input.fill(original); await page.waitForTimeout(100);
    assert(await text.textContent() === original, '不 trim 原文或删除空行与制表符');
    await root.screenshot({ path: 'output/playwright/user-message-multiline.png' });

    await select('literal');
    assert(await text.textContent() === await input.inputValue(), 'Markdown 和 HTML 字面内容完整显示');
    assert(await text.locator('script, h1, strong, a').count() === 0, '不解析 HTML、标题、加粗或链接');

    await select('long');
    assert(await text.textContent() === await input.inputValue(), '长文本不截断');
    assert(await text.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '无空格长路径在气泡内换行');
    assert(await text.evaluate(el => el.scrollHeight <= el.clientHeight + 1), '默认自然撑高，无内部裁切');
    await page.getByRole('button', { name: '窄屏', exact: true }).click(); await page.waitForTimeout(150);
    assert(await text.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏长文本不横向溢出');
    assert(await root.evaluate(el => el.ownerDocument.documentElement.scrollWidth <= el.ownerDocument.documentElement.clientWidth + 1), '窄屏页面不产生横向滚动');
    await page.screenshot({ path: 'output/playwright/user-message-narrow.png' });

    await select('attachments');
    const attachments = root.getByRole('group', { name: '消息附件' });
    assert(await attachments.locator('.pl-attachment-card').count() === 8 && await text.isVisible(), '正文与八个共享文件卡片组合');
    const before = await root.boundingBox();
    await attachments.getByRole('button', { name: '打开 章节草稿.md', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: '打开附件：章节草稿.md' }).waitFor();
    assert(true, '附件插槽保留键盘与调用方回调');
    const after = await root.boundingBox();
    assert(before.x === after.x && before.y === after.y && before.width === after.width && before.height === after.height, '附件点击反馈不挤动气泡');
    assert(await attachments.locator('.pl-attachment-card__remove').count() === 0, '已发送文件没有草稿删除按钮');
    const image = attachments.locator('.pl-attachment-thumbnail img');
    await image.evaluate(img => img.decode());
    assert(await image.evaluate(img => img.naturalWidth > 0), '图片加载真实像素而非文件名占位');
    await attachments.getByRole('button', { name: '预览图片 架构参考.png' }).click();
    await frame.getByRole('dialog', { name: '架构参考.png', exact: true }).waitFor();
    assert(true, '图片点击可打开实际预览');
    await page.keyboard.press('Escape');
    assert(await frame.getByRole('dialog').count() === 0, 'Esc 关闭图片预览');
    await root.screenshot({ path: 'output/playwright/user-message-attachments.png' });

    await select('attachment-only');
    assert(await text.count() === 0 && await attachments.isVisible(), '仅附件没有空文本气泡或补造正文');
    await select('empty');
    assert(await root.count() === 0, '完全空消息不占位');
    await input.fill('   '); await page.waitForTimeout(100);
    assert(await text.textContent() === '   ', '空格原文不被当作空消息裁掉');
    await select('default');
    await page.getByRole('combobox', { name: '组件宽度模式', exact: true }).selectOption('fill');
    await page.waitForTimeout(100);
    assert(Math.abs((await root.boundingBox()).width - (await parent.boundingBox()).width) < 1, '公开 style 可以控制组件宽度');
    assert(errors.length === 0, '无浏览器未捕获异常');
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); }
}
