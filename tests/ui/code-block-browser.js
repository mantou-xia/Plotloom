// 在组件调试台的 Playwright CLI 会话中运行：run-code --filename tests/ui/code-block-browser.js
async page => {
  const passed = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (value, label) => { if (!value) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const block = frame.locator('.pl-code-block');
  const code = block.locator('pre code');
  const editor = page.getByRole('textbox', { name: '代码内容', exact: true });
  const copy = frame.getByRole('button', { name: '复制代码', exact: true });
  const select = async state => { await page.locator('#example-state').selectOption(state); await block.waitFor(); };
  // 纯文本与未知语言也会完成分词，但不会生成颜色样式。
  const highlighted = () => block.locator('.pl-code-block__line').first().waitFor();
  try {
    await page.getByRole('button', { name: 'CodeBlock 8', exact: true }).click();
    for (const language of ['default', 'python', 'json']) {
      await select(language); await highlighted();
      assert(await frame.locator('.pl-markdown').count() === 0, `${language} 独立显示，不依赖 Markdown 容器`);
      assert(await block.locator('.pl-code-block__language').textContent() === (language === 'default' ? 'typescript' : language), `${language} 语言标识正确`);
      assert(await code.textContent() === await editor.inputValue(), `${language} 高亮保持原始空白与换行`);
      assert(await code.evaluate(el => new Set([...el.querySelectorAll('span[style]')].map(span => span.style.color)).size) > 1, `${language} 实际渲染多种语法颜色`);
    }
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await select('plain'); await highlighted();
    const original = await editor.inputValue();
    assert(await block.locator('.pl-code-block__language').textContent() === '纯文本', '空语言标识显示纯文本');
    const defaultColor = await copy.evaluate(el => getComputedStyle(el).color);
    assert(await copy.locator('svg').count() === 1 && await copy.textContent() === '', '复制按钮仅显示图标');
    await copy.click();
    assert((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === original, '复制保留缩进、制表符、空行及末尾换行');
    await block.locator('button[data-copied]').waitFor();
    assert(await copy.evaluate(el => getComputedStyle(el).color) !== defaultColor, '复制成功图标变色');
    assert(!(await block.textContent()).includes('已复制') && await block.locator('.pl-code-block__status').textContent() === '', '复制成功不显示文案');
    await page.waitForTimeout(1000);
    assert(await copy.getAttribute('data-copied') === 'true', '成功变色持续显示');
    await copy.click();
    await page.waitForTimeout(1400);
    assert(await copy.getAttribute('data-copied') === 'true', '重复复制重新计时');
    await block.locator('button[data-copied]').waitFor({ state: 'hidden', timeout: 3000 });
    assert(await copy.evaluate(el => getComputedStyle(el).color) === defaultColor, '计时结束图标恢复原色');
    await copy.focus(); await page.keyboard.press('Enter');
    assert((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === original, '键盘 Enter 可触发复制');
    await editor.fill('更新后的原始代码\n');
    assert(await block.locator('.pl-code-block__status').textContent() === '', '内容变化清除旧复制反馈');
    await select('unknown'); await highlighted();
    assert(await code.textContent() === await editor.inputValue(), '未知语言回退且不丢失内容');
    assert(await block.locator('.pl-code-block__language').textContent() === 'plotloom-script', '未知语言保留传入的标识');
    await editor.fill('<script>window.__executed = true</script>\n');
    assert(await code.locator('script').count() === 0 && (await code.textContent()).includes('<script>'), '源码 HTML 以文本显示，不执行');
    await select('empty');
    assert(await code.textContent() === '' && await copy.isDisabled(), '空代码不伪造内容且禁用复制');

    await select('default'); await highlighted();
    // 模拟浏览器拒绝剪贴板权限，随后恢复真实 API，检查失败可重试。
    await block.evaluate(() => {
      window.__originalWriteText = navigator.clipboard.writeText;
      navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    });
    await copy.click();
    assert((await block.getByRole('status').textContent()).includes('复制失败'), '权限拒绝展示失败说明');
    assert(await code.textContent() === await editor.inputValue(), '复制失败仍保留可手动选择的源码');
    await block.evaluate(() => { navigator.clipboard.writeText = window.__originalWriteText; });
    await copy.click();
    await block.locator('button[data-copied]').waitFor();
    assert(await block.locator('.pl-code-block__status').textContent() === '', '权限恢复后可重新复制并清除错误');
    // 延迟完成的旧复制请求不得把新内容标为已复制。
    await block.evaluate(() => { navigator.clipboard.writeText = () => new Promise(resolve => { window.__finishCopy = resolve; }); });
    await copy.click();
    await editor.fill('const current = "新代码";\n');
    await block.evaluate(() => { window.__finishCopy(); navigator.clipboard.writeText = window.__originalWriteText; });
    assert(await block.locator('.pl-code-block__status').textContent() === '', '过期复制请求不污染新内容状态');

    await select('long'); await highlighted();
    const scroll = block.locator('.pl-code-block__scroll');
    assert(await scroll.evaluate(el => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight), '长行与长代码形成双向滚动');
    assert(await scroll.evaluate(el => el.clientHeight <= 480), '长代码高度限制在 480px 内');
    const toolbarTop = await block.locator('.pl-code-block__toolbar').evaluate(el => el.getBoundingClientRect().top);
    await scroll.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
    assert(await scroll.evaluate(el => el.scrollLeft > 0), '聚焦滚动区后方向键横向滚动');
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert(await block.locator('.pl-code-block__toolbar').evaluate(el => el.getBoundingClientRect().top) === toolbarTop, '滚动源码时工具栏保持可见');
    await page.getByRole('button', { name: '窄屏', exact: true }).click();
    assert(await block.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏长行不撑破组件');
    await page.screenshot({ path: 'output/playwright/code-block-long.png' });

    await select('streaming');
    await frame.getByRole('button', { name: '停止', exact: true }).click();
    const stopped = await code.textContent();
    await page.waitForTimeout(150);
    assert(await code.textContent() === stopped && await block.getAttribute('aria-busy') === 'false', '停止保留代码并结束忙碌状态');
    await frame.getByRole('button', { name: '重新播放', exact: true }).click();
    await frame.getByText('已完成', { exact: true }).waitFor(); await highlighted();
    assert(await code.textContent() === await editor.inputValue(), '重播结束高亮内容完整且无过期结果覆盖');
    assert(await block.getAttribute('aria-busy') === 'false', '自然完成恢复非忙碌状态');
    await select('default'); await highlighted();
    await page.screenshot({ path: 'output/playwright/code-block-typescript.png' });
    assert(errors.length === 0, `浏览器无未捕获异常：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally {
    await block.evaluate(() => { if (window.__originalWriteText) navigator.clipboard.writeText = window.__originalWriteText; }).catch(() => {});
    page.off('pageerror', onError);
  }
}
