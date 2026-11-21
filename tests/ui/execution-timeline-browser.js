// Playwright CLI：run-code --filename tests/ui/execution-timeline-browser.js
async (page) => {
  const passed = [], errors = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const frame = page.frameLocator('iframe');
  const panel = frame.locator('.pl-execution-timeline');
  const scroll = frame.locator('.pl-execution-timeline__viewport');
  const body = frame.locator('.pl-execution-timeline__body');
  const append = () => frame.getByRole('button', { name: '推进一条事件', exact: true }).click();
  const metrics = () => scroll.evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, total: el.scrollHeight }));
  const bottom = async () => { const m = await metrics(); return m.total - m.height - m.top < 3; };
  const select = async state => {
    const old = await panel.count() ? await panel.elementHandle() : null;
    const previous = await page.locator('#example-state').inputValue();
    await page.locator('#example-state').selectOption(state);
    if (old && previous !== state) await old.waitForElementState('hidden');
    if (state !== 'empty') await panel.waitFor();
    await page.waitForTimeout(180);
  };
  const phase = async value => {
    await page.getByRole('combobox', { name: '过程阶段', exact: true }).selectOption(value);
    await frame.locator(`.pl-execution-timeline[data-phase="${value}"]`).waitFor();
    await page.waitForTimeout(80);
  };
  try {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.getByRole('button', { name: 'ExecutionTimeline 10', exact: true }).click();
    await select('default');
    await panel.waitFor();
    assert((await panel.boundingBox()).height === 312, '默认固定高度 312px');
    assert(await panel.locator('li[data-entry-id]').count() === 7, '混合过程包含七个顺序节点');
    assert(await panel.getByRole('button', { name: '收起执行过程', exact: true }).count() === 0, '执行期间保持思考内容可见');
    await select('long');
    assert((await metrics()).total > (await metrics()).height, '长内容内部实际溢出');
    assert((await metrics()).top === 0, '静态长内容从开头阅读');
    await scroll.focus(); await page.keyboard.press('PageDown');
    // 原生键盘滚动由浏览器合成线程调度，等到滚动落地再检查而非依赖固定短延迟。
    await scroll.evaluate(el => new Promise(resolve => {
      const started = performance.now();
      const check = () => el.scrollTop > 0 || performance.now() - started > 3000 ? resolve() : requestAnimationFrame(check);
      check();
    }));
    await page.waitForTimeout(300);
    assert((await metrics()).top > 0, '键盘 PageDown 可以阅读内容');
    const readTop = (await metrics()).top;
    const retained = await scroll.elementHandle();
    await panel.getByRole('button', { name: '展开全部', exact: true }).click();
    assert((await panel.boundingBox()).height > 312, '展开全部撑高面板');
    assert(Math.abs((await metrics()).total - (await metrics()).height) <= 1, '展开全部无内部纵向裁切');
    assert(await retained.evaluate(el => el.isConnected), '展开全部保持原内容 DOM');
    await panel.getByRole('button', { name: '恢复定高', exact: true }).click();
    assert((await panel.boundingBox()).height === 312, '恢复默认固定高度');
    assert(Math.abs((await metrics()).top - readTop) < 2, '恢复定高保留原阅读位置');
    const expandBox = await panel.getByRole('button', { name: '展开全部', exact: true }).boundingBox();
    const anchor = await frame.getByText('示例后续内容：用于检查固定高度与展开行为。', { exact: true }).boundingBox();
    await panel.getByRole('button', { name: '回到最新过程', exact: true }).click();
    assert(await bottom(), '回到最新实际到达内部底部');
    assert(await scroll.evaluate(el => el === el.ownerDocument.activeElement), '回到最新后焦点回到阅读区');
    assert(!await panel.getByRole('button', { name: '回到最新过程', exact: true }).isVisible(), '最新入口到达底部后隐藏');
    assert(JSON.stringify(expandBox) === JSON.stringify(await panel.getByRole('button', { name: '展开全部', exact: true }).boundingBox()), '最新入口隐藏不挤动展开按钮');
    assert(JSON.stringify(anchor) === JSON.stringify(await frame.getByText('示例后续内容：用于检查固定高度与展开行为。', { exact: true }).boundingBox()), '最新入口切换不挤动后续内容');

    await select('default'); await select('long');
    await page.getByRole('checkbox', { name: '模拟过程流式输入', exact: true }).check();
    await page.waitForTimeout(650);
    assert(await bottom(), '流式内容自动跟随底部');
    const streamHeight = (await panel.boundingBox()).height;
    await scroll.evaluate(el => { el.scrollTop = 0; }); await page.waitForTimeout(150);
    const priorText = await scroll.innerText();
    await page.waitForTimeout(1100);
    assert((await metrics()).top === 0 && await scroll.innerText() !== priorText, '用户上翻后增量继续但阅读位置不动');
    assert((await panel.boundingBox()).height === streamHeight, '流式追加与最新入口出现不撑高');
    assert(await panel.getByRole('button', { name: '回到最新过程', exact: true }).isVisible(), '上翻后提供回到最新入口');
    await panel.getByRole('button', { name: '回到最新过程', exact: true }).click(); await page.waitForTimeout(300);
    assert(await bottom(), '回到最新恢复后续流式跟随');
    await frame.getByRole('button', { name: '暂停流式', exact: true }).click();
    const pausedText = await scroll.innerText(); await page.waitForTimeout(300);
    assert(await scroll.innerText() === pausedText, '暂停流式保留已收到文本');
    await frame.getByRole('button', { name: '继续流式', exact: true }).click(); await page.waitForTimeout(1100);
    assert(await scroll.innerText() !== pausedText, '继续流式追加后续文本');

    await phase('stopped');
    const stoppedText = await scroll.innerText();
    assert(await body.isVisible() && await panel.locator('.pl-markdown').evaluateAll(els => els.every(el => el.getAttribute('aria-busy') === 'false')), '停止保留内容并停止流式渲染');
    await page.waitForTimeout(250);
    assert(await scroll.innerText() === stoppedText && (await panel.boundingBox()).height === streamHeight, '停止不清空内容、不增加反馈行');
    await panel.getByRole('button', { name: '展开全部', exact: true }).click();
    await phase('failed');
    assert(await panel.getAttribute('data-full') === 'true', '失败保留完整展开方式');
    await phase('answering');
    assert(!await body.isVisible() && (await panel.boundingBox()).height === 36, '进入最终回答自动收起一次');
    assert(await panel.getAttribute('data-full') === 'false', '最终回答重新展开使用默认定高');
    await append();
    assert(!await body.isVisible(), '收起后追加文本不强制展开');
    await panel.getByRole('button', { name: '展开执行过程', exact: true }).focus(); await page.keyboard.press('Enter');
    assert(await body.isVisible(), '键盘展开执行过程');
    await append(); await phase('completed');
    assert(await body.isVisible(), '追加与回答完成不会再次折叠');
    await panel.getByRole('button', { name: '收起执行过程', exact: true }).focus(); await page.keyboard.press('Space');
    assert(!await body.isVisible(), '键盘可再次收起');
    await phase('failed');
    assert(!await body.isVisible(), '回答期间失败不改变已折叠状态');
    await panel.getByRole('button', { name: '展开执行过程', exact: true }).click();
    await panel.getByRole('button', { name: '展开全部', exact: true }).click();
    await phase('stopped');
    assert(await body.isVisible() && await panel.getAttribute('data-full') === 'true', '回答期间停止保留手动完整展开');
    await phase('completed');
    assert(await panel.getAttribute('data-full') === 'true', '同一任务重新进入完成阶段不重复自动折叠');

    await select('empty');
    const empty = frame.locator('.pl-execution-timeline__empty');
    assert(await panel.count() === 0 && await empty.isVisible() && await empty.evaluate(el => !el.hasChildNodes()),
      '首条记录前只保留留白');
    const emptyHeight = (await empty.boundingBox()).height;
    const emptyAnchor = (await frame.locator('[data-process-after]').boundingBox()).y;
    await append(); await panel.waitFor();
    assert((await scroll.innerText()).includes('继续检查下一份资料'), '空内容首次增量正确显示');
    assert(await empty.count() === 0 && (await panel.boundingBox()).height === emptyHeight, '首条过程原位替换等高空态');
    assert((await frame.locator('[data-process-after]').boundingBox()).y === emptyAnchor, '空态切换不挤动后续内容');
    await select('default'); await select('empty');
    await page.getByRole('combobox', { name: '过程阶段', exact: true }).selectOption('completed');
    await empty.waitFor({ state: 'hidden' });
    assert(await panel.count() === 0, '完成后无过程不保留空态');
    await select('long');
    const heightControl = page.getByRole('spinbutton', { name: '固定阅读高度（px）', exact: true });
    await heightControl.fill('400'); await heightControl.press('Enter'); await page.waitForTimeout(120);
    assert((await panel.boundingBox()).height === 400, '公开 height 参数实际调整阅读高度');
    await panel.screenshot({ path: 'output/playwright/execution-timeline-long.png' });
    await page.getByRole('button', { name: '窄屏', exact: true }).click(); await page.waitForTimeout(150);
    assert(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏面板无横向溢出');
    assert(await panel.locator('.pl-execution-timeline__toolbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏工具栏完整可操作');
    await panel.screenshot({ path: 'output/playwright/execution-timeline-narrow.png' });
    await phase('answering');
    await panel.getByRole('button', { name: '展开执行过程', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      await panel.getByRole('button', { name: '收起执行过程', exact: true }).click();
      await panel.getByRole('button', { name: '展开执行过程', exact: true }).click();
    }
    assert(await body.isVisible() && (await panel.boundingBox()).height === 400, '快速折叠展开最终状态与高度正确');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await phase('working');
    await page.getByRole('checkbox', { name: '模拟过程流式输入', exact: true }).check(); await page.waitForTimeout(200);
    assert(await panel.locator('[data-sd-animate]').evaluateAll(els => els.every(el => getComputedStyle(el).animationName === 'none')), '减少动态效果时思考文本不播放渐现动画');
    assert(errors.length === 0, `无浏览器未捕获异常：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); await page.emulateMedia({ reducedMotion: 'no-preference' }); }
}
