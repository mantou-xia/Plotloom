// Playwright CLI：run-code --filename tests/ui/citation-browser.js
async (page) => {
  const passed = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (ok, name) => { if (!ok) throw new Error(name); passed.push(name); };
  const frame = page.frameLocator('iframe');
  const markers = frame.locator('.pl-citation-marker');
  const paragraph = frame.locator('[data-citation-paragraph]');
  const select = async value => { await page.locator('#example-state').selectOption(value); await page.waitForTimeout(160); };
  const sameBox = (a, b) => ['x', 'y', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) < .1);
  try {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.getByRole('button', { name: 'CitationMarker 5', exact: true }).click();
    await markers.waitFor();
    assert(await markers.textContent() === '1', '引用仅在正文显示编号');
    assert(await markers.getAttribute('aria-label') === '查看来源 1：人物关系与时间线核对记录.md', '可访问名称包含编号和对应来源');
    assert(await markers.getAttribute('type') === 'button', '引用不会意外提交表单');
    const initialParagraph = await paragraph.boundingBox(), initialMarker = await markers.boundingBox();
    await markers.focus();
    await frame.getByRole('tooltip').waitFor();
    assert(await frame.getByRole('tooltip').textContent() === '人物关系与时间线核对记录.md', '键盘聚焦显示完整来源名');
    assert(sameBox(initialParagraph, await paragraph.boundingBox()), '来源提示出现不挤动正文');
    assert(await markers.evaluate(el => getComputedStyle(el).boxShadow !== 'none'), '键盘聚焦有可见反馈');
    await page.keyboard.press('Escape');
    await frame.getByRole('tooltip').waitFor({ state: 'hidden' });
    assert(sameBox(initialParagraph, await paragraph.boundingBox()), '提示关闭不改变段落尺寸');
    await page.keyboard.press('Enter');
    await frame.getByRole('dialog', { name: '来源 1', exact: true }).waitFor();
    assert(true, 'Enter 触发对应来源回调');
    await page.keyboard.press('Escape');
    assert(await markers.evaluate(el => el === el.ownerDocument.activeElement), '关闭来源后焦点回到引用编号');
    await page.keyboard.press('Space');
    await frame.getByRole('dialog', { name: '来源 1', exact: true }).waitFor();
    assert(true, '空格触发对应来源回调');
    await page.keyboard.press('Escape');
    const active = page.getByRole('checkbox', { name: '当前来源', exact: true });
    for (let i = 0; i < 6; i++) {
      await active.setChecked(i % 2 === 0);
      assert(sameBox(initialParagraph, await paragraph.boundingBox()) && sameBox(initialMarker, await markers.boundingBox()), '切换当前来源不挤动正文 ' + i);
    }
    await select('multiple');
    assert(await markers.count() === 3, '连续引用为三个独立入口');
    await markers.nth(0).focus(); await page.keyboard.press('Tab');
    assert(await markers.nth(1).evaluate(el => el === el.ownerDocument.activeElement), 'Tab 按正文顺序导航引用');
    await markers.nth(1).click();
    await frame.getByRole('dialog', { name: '来源 2', exact: true }).waitFor();
    assert(true, '第二个引用打开第二个来源');
    await page.keyboard.press('Escape');
    await page.mouse.move(10, 10); await markers.nth(1).blur();
    await page.waitForTimeout(250);
    await paragraph.screenshot({ path: 'output/playwright/citation-inline.png' });
    await select('active');
    assert(await markers.getAttribute('aria-current') === 'true', '当前来源对辅助技术可识别');
    await select('disabled');
    assert(await markers.isDisabled(), '禁用引用保留编号但不可操作');
    await markers.evaluate(el => el.click());
    assert(await frame.getByRole('dialog').count() === 0, '禁用引用不触发来源回调');
    await select('long-title');
    assert(await markers.textContent() === '128', '多位编号完整显示');
    await page.getByRole('button', { name: '窄屏', exact: true }).click();
    await markers.focus();
    const tooltip = frame.getByRole('tooltip');
    await tooltip.waitFor(); await page.waitForTimeout(250);
    assert(await tooltip.textContent() === await page.getByRole('textbox', { name: '来源名称', exact: true }).inputValue(), '长来源名称不截断');
    assert(await tooltip.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '长提示在窄屏内换行');
    assert(await paragraph.evaluate(el => el.ownerDocument.documentElement.scrollWidth <= el.ownerDocument.documentElement.clientWidth + 1), '窄屏正文没有横向溢出');
    await page.screenshot({ path: 'output/playwright/citation-narrow.png' });
    await page.keyboard.press('Escape');
    const input = page.getByRole('spinbutton', { name: '引用编号', exact: true });
    await input.fill('42'); await input.press('Enter');
    assert(await markers.textContent() === '42', '公开编号参数可调整');
    await page.getByRole('textbox', { name: '来源名称', exact: true }).fill('<script>原始来源标题</script>');
    await markers.focus(); await tooltip.waitFor();
    assert(await tooltip.textContent() === '<script>原始来源标题</script>' && await tooltip.locator('script').count() === 0, '来源名作为纯文本显示');
    assert(errors.length === 0, '没有浏览器未捕获异常');
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); }
}
