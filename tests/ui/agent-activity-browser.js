// Playwright CLI：run-code --filename tests/ui/agent-activity-browser.js
async (page) => {
  const passed = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const root = frame.locator('.pl-agent-activity');
  const canvas = frame.locator('.pl-agent-activity__canvas');
  const label = root.locator('.pl-agent-activity__label');
  const labelAnimation = () => label.evaluate(el => getComputedStyle(el).animationName);
  const select = async state => {
    const old = await root.elementHandle();
    const previous = await page.locator('#example-state').inputValue();
    await page.locator('#example-state').selectOption(state);
    if (old && previous !== state) await old.waitForElementState('hidden');
    await root.waitFor(); await page.waitForTimeout(120);
  };
  const pixels = () => canvas.evaluate(el => el.toDataURL());
  const box = target => target.boundingBox();
  try {
    // 粒子在后台页面会主动暂停，前台验收才比较动画像素。
    await page.bringToFront();
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.getByRole('button', { name: 'AgentActivityHeader 10' }).click();
    await select('reading');
    await page.waitForTimeout(1200);
    assert(await canvas.getAttribute('data-shape') === 'book', '阅读使用书页粒子');
    assert((await root.innerText()).includes('阅读中'), '内置 read 映射阅读文案');
    const initial = await box(root);
    const initialTime = await box(root.locator('.pl-agent-activity__time'));
    const visual = await box(frame.locator('.pl-agent-activity__visual'));
    const particle = await box(canvas);
    assert(particle.y >= visual.y - 1 && particle.y + particle.height <= visual.y + visual.height + 1, '粒子画布完整落在可视区域内');
    const right = await box(frame.locator('.pl-agent-activity__right'));
    assert(initial.height === 360 && visual.height === right.height, '默认整体 360px，左右等高');
    assert(await canvas.evaluate(el => el.getContext('2d').getImageData(0, 0, el.width, el.height).data.some((v, i) => i % 4 === 3 && v > 0)), 'Canvas 实际绘制粒子');
    const before = await pixels(); await page.waitForTimeout(400);
    assert(before !== await pixels(), '执行时粒子持续运动');
    assert(await root.getByRole('button', { name: '收起执行过程', exact: true }).count() === 0, '思考期间不存在收起按钮');
    const icon = root.locator('.pl-agent-activity__thinking-icon i');
    assert(await icon.count() === 9 && await icon.first().evaluate(el => getComputedStyle(el).animationName) === 'pl-thinking-pulse', '九宫格思考动画运行');
    assert(await labelAnimation() === 'pl-agent-label-shine', '运行中的状态文字播放扫光');
    await root.locator('.pl-agent-activity__header').click();
    assert(await canvas.isVisible(), '点击状态头部不会收起');
    await page.getByRole('textbox', { name: '工具名称', exact: true }).fill('grep');
    await page.waitForTimeout(150);
    assert(await canvas.getAttribute('data-shape') === 'magnifier' && (await root.innerText()).includes('搜索中'), '同一实例切换工具同时更新文案与形态');
    assert((await box(root)).height === initial.height, '活动切换不改变高度');
    await page.getByRole('textbox', { name: '自定义文案', exact: true }).fill('正在阅读一段非常非常长的活动标题，用于检查状态文字是否挤动右侧操作');
    await page.waitForTimeout(150);
    assert((await box(root)).height === initial.height, '长文案不挤动高度');
    assert(Math.abs((await box(root.locator('.pl-agent-activity__time'))).x - initialTime.x) < 1, '长文案不挤动耗时位置');
    await page.getByRole('textbox', { name: '自定义文案', exact: true }).fill('');
    for (const tool of ['write', 'read', 'powershell', 'ls', 'grep']) {
      await page.getByRole('textbox', { name: '工具名称', exact: true }).fill(tool);
      await page.waitForTimeout(80);
    }
    assert(await canvas.getAttribute('data-shape') === 'magnifier', '快速切换采用最新形态');
    await select('unknown');
    assert((await root.innerText()).includes('处理中') && await canvas.getAttribute('data-shape') === 'sphere', '未知工具使用粒子球兜底');

    await select('reading');
    assert(await root.locator('[data-entry-type="thinking"]').count() === 1 && await root.locator('[data-entry-type="tool"]').count() === 1, 'C03 插槽组合思考说明与工具');
    await frame.getByRole('button', { name: '模拟工具过程', exact: true }).click();
    await root.locator('[data-entry-id="tool-1"]').waitFor();
    const firstTool = await root.locator('[data-entry-id="tool-1"]').elementHandle();
    await root.locator('[data-entry-id="tool-2"]').waitFor();
    await frame.getByRole('button', { name: '暂停工具演示', exact: true }).click();
    assert(await firstTool.evaluate(el => el.isConnected && el.querySelector('.pl-process-node').dataset.status === 'completed'), 'C03 模拟过程在原位完成上一个工具');
    assert(await root.locator('[data-entry-id="tool-2"] .pl-process-node').getAttribute('data-status') === 'running', 'C03 新工具按顺序追加为进行中');

    await select('long');
    const scroll = frame.locator('.pl-execution-timeline__viewport');
    assert(await scroll.evaluate(el => el.scrollHeight > el.clientHeight), '长内容内部滚动');
    await scroll.evaluate(el => { el.scrollTop = 200; });
    assert(await scroll.evaluate(el => el.scrollTop > 0), '思考区域可实际滚动');
    assert(await root.locator('.pl-agent-activity__header').getByRole('button').count() === 0, 'Header 不包含内容展开操作');
    await root.getByRole('button', { name: '展开全部', exact: true }).click();
    assert((await box(root)).height > 360, 'C05 展开全部撑高组合');
    assert((await box(frame.locator('.pl-agent-activity__visual'))).height === 360, '展开全部保持粒子原尺寸');
    await root.getByRole('button', { name: '恢复定高', exact: true }).click();
    assert((await box(root)).height === 360, '恢复定高后组合回到默认高度');
    await frame.getByRole('button', { name: '追加思考内容', exact: true }).click();
    assert(await scroll.isVisible() && (await box(root)).height === 360, '内容追加不触发折叠或撑高');
    const retainedContent = await scroll.elementHandle();

    await frame.getByRole('button', { name: '开始最终回答', exact: true }).click();
    assert(await root.locator('canvas, header, .pl-agent-activity__time, .pl-agent-activity__thinking-icon').count() === 0, '进入最终回答完全隐藏粒子与状态头部');
    assert(await retainedContent.evaluate(el => el.isConnected), '结束时保留同一内容 DOM');
    assert(!await scroll.isVisible(), '示例思考内容自动收起');
    await frame.getByRole('button', { name: '展开执行过程', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert(await scroll.isVisible(), '键盘只展开执行过程');
    await page.waitForTimeout(500);
    assert(await scroll.isVisible(), '流式回答更新不再次折叠内容');
    assert(await canvas.count() === 0 && await root.locator('header').count() === 0, '展开内容不会重现 Header');
    await root.screenshot({ path: 'output/playwright/agent-activity-content-only.png' });
    await frame.getByRole('button', { name: '完成回答', exact: true }).click();
    assert(await scroll.isVisible(), '回答完成尊重用户手动展开');
    await frame.getByRole('button', { name: '收起执行过程', exact: true }).click();
    assert(!await scroll.isVisible(), '完成后只收起内容');
    await page.screenshot({ path: 'output/playwright/agent-activity-collapsed.png' });
    await frame.getByRole('button', { name: '新任务', exact: true }).click();
    assert(await canvas.isVisible() && await root.getByRole('button', { name: '收起执行过程', exact: true }).count() === 0, '新任务恢复 Header，内容不可收起');
    await frame.getByRole('button', { name: '完成回答', exact: true }).click();
    assert(await canvas.count() === 0 && !await scroll.isVisible(), '直接完成同样隐藏 Header 并收起示例内容');

    for (const state of ['failed', 'stopped']) {
      await select(state);
      assert(await canvas.isVisible() && await scroll.isVisible(), `${state} 保留过程可见`);
      assert((await box(root)).height === 360, `${state} 不增加额外摘要行或改变高度`);
      const data = await pixels(); await page.waitForTimeout(300);
      assert(data === await pixels(), `${state} 停止动画`);
      assert(await labelAnimation() === 'none', `${state} 停止文字扫光`);
    }
    await select('reading');
    await page.getByRole('checkbox', { name: '减少动态效果', exact: true }).check();
    await page.waitForTimeout(120);
    const reduced = await pixels(); await page.waitForTimeout(300);
    assert(reduced === await pixels(), '显式减少动态效果保持静态');
    assert(await icon.first().evaluate(el => getComputedStyle(el).animationName) === 'none', '减少动态效果停止思考图标动画');
    assert(await labelAnimation() === 'none', '组件减少动态效果关闭文字扫光');
    // 静态模式隔离自动动画，以像素变化证明实际拖动而非时间变化。
    const canvasBox = await box(canvas);
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.down(); await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 65, canvasBox.y + canvasBox.height / 2, { steps: 8 }); await page.mouse.up();
    const rotated = await pixels();
    assert(rotated !== reduced, '鼠标拖动实际旋转实体');
    await page.waitForTimeout(200);
    assert(rotated === await pixels() && await canvas.getAttribute('data-dragging') === null, '松开后保留视角并结束拖动');
    await canvas.focus(); await page.keyboard.press('Home');
    assert(await pixels() === reduced, 'Home 恢复初始视角');
    await page.keyboard.press('ArrowRight');
    assert(await pixels() !== reduced, '方向键可以旋转');
    await page.keyboard.press('Home');
    await page.getByRole('checkbox', { name: '减少动态效果', exact: true }).uncheck();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(120);
    const systemReduced = await pixels(); await page.waitForTimeout(300);
    assert(systemReduced === await pixels(), '系统减少动态效果保持静态');
    assert(await icon.first().evaluate(el => getComputedStyle(el).animationName) === 'none', '系统减少动态效果停止图标动画');
    assert(await labelAnimation() === 'none', '系统减少动态效果关闭文字扫光');
    await page.getByRole('checkbox', { name: '显示调用方耗时', exact: true }).uncheck();
    await page.waitForTimeout(100);
    assert(await root.locator('.pl-agent-activity__time').count() === 0, '未提供耗时不显示假计时');
    await page.getByRole('checkbox', { name: '显示调用方耗时', exact: true }).check();
    await page.screenshot({ path: 'output/playwright/agent-activity-reading.png' });
    await page.getByRole('button', { name: '窄屏', exact: true }).click();
    await page.waitForTimeout(150);
    assert(await root.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏不产生横向溢出');
    assert((await box(frame.locator('.pl-agent-activity__right'))).height === 360, '窄屏保留思考区可用高度');
    await page.screenshot({ path: 'output/playwright/agent-activity-narrow.png' });
    assert(errors.length === 0, `无浏览器未捕获错误：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); await page.emulateMedia({ reducedMotion: 'no-preference' }); }
}
