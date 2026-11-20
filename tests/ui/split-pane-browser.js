// Playwright CLI：run-code --filename tests/ui/split-pane-browser.js
async (page) => {
  const passed = [], errors = [];
  const assert = (ok, name) => { if (!ok) throw new Error(name); passed.push(name); };
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const frame = page.frameLocator('iframe');
  const root = frame.locator('.pl-split-pane');
  const panel = frame.locator('.pl-split-pane__panel');
  const main = frame.getByRole('region', { name: '主内容', exact: true });
  const body = frame.getByRole('region', { name: '右侧面板内容', exact: true });
  const separator = frame.getByRole('separator', { name: '调整右侧面板宽度' });
  const toggle = frame.getByRole('button', { name: '切换右侧面板', exact: true });
  const select = async value => { await page.locator('#example-state').selectOption(value); await page.waitForTimeout(250); };
  // 记录开合期间的真实几何，最终尺寸断言等到布局动画结束后再执行。
  const sampleMotion = () => panel.evaluate(async node => {
    const layout = node.closest('.pl-split-pane');
    const main = layout.querySelector('.pl-split-pane__main');
    const animations = layout.getAnimations({ subtree: true }).filter(animation =>
      animation.id === 'pl-split-pane-motion');
    const measure = () => {
      const { x, width } = node.getBoundingClientRect();
      return { x, width, mainWidth: main.getBoundingClientRect().width,
        backdrop: Number(getComputedStyle(node, '::backdrop').opacity) };
    };
    const samples = [measure()];
    while (animations.some(animation => animation.pending || animation.playState === 'running')) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      samples.push(measure());
    }
    return samples;
  });
  try {
    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.getByRole('button', { name: 'SplitPaneLayout 5', exact: true }).click();
    await root.waitFor(); await sampleMotion();
    assert(await root.getAttribute('data-mode') === 'split', '宽容器使用分屏');
    assert(Math.abs((await panel.boundingBox()).width - 400) < 2, '默认右侧宽400px');
    const handle = await separator.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 80); await page.mouse.down();
    await page.mouse.move(handle.x - 80, handle.y + 80, { steps: 8 }); await page.mouse.up();
    const draggedWidth = (await panel.boundingBox()).width;
    assert(draggedWidth > 470, '真实拖拽可调宽');
    await separator.focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(80);
    assert((await panel.boundingBox()).width > draggedWidth, '键盘方向键可调宽');
    const retainedWidth = (await panel.boundingBox()).width;
    await toggle.click();
    const desktopClosing = await sampleMotion();
    assert(desktopClosing.some(sample => sample.width > 0 && sample.width < retainedWidth - 10
      && sample.mainWidth > desktopClosing[0].mainWidth + 10), '宽屏退场逐帧缩小右栏并恢复主区');
    await panel.waitFor({ state: 'hidden' });
    assert(Math.abs((await main.boundingBox()).width - (await root.boundingBox()).width) < 2, '收起后主区占满');
    assert(await separator.count() === 0, '隐藏分隔条退出键盘操作');
    await toggle.click(); await panel.waitFor({ state: 'visible' });
    const desktopOpening = await sampleMotion();
    const desktopEnd = desktopOpening.at(-1);
    assert(desktopOpening.some(sample => sample.width > 0 && sample.width < desktopEnd.width - 10
      && sample.mainWidth > desktopEnd.mainWidth + 10), '宽屏展开逐帧展开右栏并同步调整主区');
    assert(Math.abs((await panel.boundingBox()).width - retainedWidth) < 2, '重开恢复调节宽度');
    await frame.getByRole('button', { name: '关闭右侧面板' }).click();
    await panel.waitFor({ state: 'hidden' });
    assert(await toggle.evaluate(el => el === el.ownerDocument.activeElement), '面板关闭焦点回到触发按钮');
    await toggle.click();
    await page.getByRole('textbox', { name: '面板标题', exact: true }).fill('自定义面板');
    assert(await panel.getByRole('heading', { name: '自定义面板' }).count() === 1, '标题参数真实生效');
    await sampleMotion();
    await root.screenshot({ path: 'output/playwright/split-pane-desktop.png' });

    await select('overflow');
    const mainNode = await main.elementHandle();
    const panelNode = await body.elementHandle();
    await frame.getByRole('textbox', { name: '面板草稿' }).fill('保留这份草稿');
    await main.evaluate(el => { el.scrollTop = 300; });
    await body.evaluate(el => { el.scrollTop = 240; });
    assert(await main.evaluate(el => el.scrollTop) === 300 && await body.evaluate(el => el.scrollTop) === 240, '两侧独立滚动');
    await toggle.click(); await toggle.click(); await panel.waitFor({ state: 'visible' });
    await sampleMotion();
    assert(await panel.evaluate(el => el.open), '收起途中重开后，旧退场动画不会关闭面板');
    assert(await mainNode.evaluate(el => el.isConnected) && await panelNode.evaluate(el => el.isConnected), '关闭重开不卸载内容');
    assert(await main.evaluate(el => el.scrollTop) === 300 && await body.evaluate(el => el.scrollTop) === 240, '关闭重开保留两侧滚动位置');
    assert(await frame.getByRole('textbox', { name: '面板草稿' }).inputValue() === '保留这份草稿', '关闭重开保留输入状态');
    await frame.getByRole('button', { name: '切换内容', exact: true }).click();
    assert(await main.evaluate(el => el.scrollTop) === 300, '右侧内容切换不重置主区阅读位置');
    // 真实改变容器宽度：不更换样例，验证宽窄切换保持原有内容 DOM。
    await root.evaluate(el => { el.style.width = '560px'; }); await page.waitForTimeout(250);
    assert(await root.getAttribute('data-mode') === 'overlay', '容器变窄改为覆盖模式');
    assert(await panel.evaluate(el => el.matches(':modal')), '窄屏使用原生模态焦点约束');
    assert(await mainNode.evaluate(el => el.isConnected) && await panelNode.evaluate(el => el.isConnected), '宽窄切换不重建内容');
    await page.keyboard.press('Tab');
    assert(await panel.evaluate(el => el.contains(el.ownerDocument.activeElement)), '窄屏Tab焦点留在面板内');
    const narrowMainWidth = (await main.boundingBox()).width;
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
    assert(Math.abs((await main.boundingBox()).width - narrowMainWidth) < 1, '窄屏关闭不挤动主区');
    await toggle.click(); await panel.waitFor();
    const overlayOpening = await sampleMotion();
    const overlayEnd = overlayOpening.at(-1);
    assert(overlayOpening.some(sample => sample.x > overlayEnd.x + 10)
      && overlayOpening.every(sample => Math.abs(sample.mainWidth - narrowMainWidth) < 1), '窄屏从右侧滑入且主区宽度稳定');
    await panel.screenshot({ path: 'output/playwright/split-pane-overlay.png' });
    await page.keyboard.press('Escape');
    const overlayClosing = await sampleMotion();
    assert(overlayClosing.some(sample => sample.x > overlayEnd.x + 10 && sample.backdrop > 0 && sample.backdrop < 1)
      && overlayClosing.every(sample => Math.abs(sample.mainWidth - narrowMainWidth) < 1), '窄屏向右滑出且遮罩淡出');
    await panel.waitFor({ state: 'hidden' });
    await toggle.click(); await panel.waitFor();
    await root.evaluate(el => { el.style.width = '100%'; }); await page.waitForTimeout(250);
    assert(await root.getAttribute('data-mode') === 'split' && !await panel.evaluate(el => el.matches(':modal')), '恢复宽容器回到非模态分屏');
    assert(await frame.getByRole('textbox', { name: '面板草稿' }).inputValue() === '保留这份草稿', '宽窄切换保留输入');
    await select('closed');
    assert(!await panel.isVisible(), '初始收起样例');
    await toggle.click(); await panel.waitFor({ state: 'visible' });
    assert(await panel.evaluate(el => el.open), '初始收起可正常打开');
    await select('empty');
    assert((await main.textContent()).trim() === '' && (await body.textContent()).trim() === '', '空插槽不伪造内容');
    await select('narrow');
    await toggle.click(); assert(await panel.evaluate(el => el.matches(':modal')), '窄容器独立样例');
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert(await toggle.evaluate(el => el === el.ownerDocument.activeElement), '窄屏Esc恢复触发焦点');
    await select('open');
    await separator.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(80);
    assert((await main.boundingBox()).width >= 319 && (await panel.boundingBox()).width <= 721, '键盘极值遵守主区最小和面板最大宽度');
    await page.keyboard.press('End');
    const keyboardClosing = await sampleMotion();
    assert(keyboardClosing.length > 1, '键盘收起也播放退场动画');
    await panel.waitFor({ state: 'hidden' });
    assert(Math.abs((await main.boundingBox()).width - (await root.boundingBox()).width) < 2, '键盘收起通知受控开关');
    await toggle.click(); await panel.waitFor();
    await page.locator('iframe').evaluate(el => { el.style.width = '360px'; });
    await page.waitForTimeout(250);
    assert(await panel.evaluate(el => el.matches(':modal')), '真实360px视口自动覆盖');
    assert((await panel.boundingBox()).width <= 360, '手机面板不超出视口');
    assert(await root.evaluate(el => el.ownerDocument.documentElement.scrollWidth <= 360), '手机无横向页面溢出');
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toggle.click(); await panel.waitFor();
    assert((await sampleMotion()).length === 1, '减少动态效果模式跳过展开动画');
    await page.keyboard.press('Escape');
    assert(await panel.evaluate(el => !el.open), '减少动态效果模式立即关闭');
    await page.emulateMedia({ reducedMotion: null });
    await page.locator('iframe').evaluate(el => { el.style.width = '1080px'; });
    assert(errors.length === 0, '无浏览器运行错误');
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); }
}
