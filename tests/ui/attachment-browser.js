// Playwright CLI：run-code --filename tests/ui/attachment-browser.js
async (page) => {
  const passed = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const cards = frame.locator('.pl-attachment-card');
  const select = async state => { await page.locator('#example-state').selectOption(state); await page.waitForTimeout(200); };
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.getByRole('button', { name: 'AttachmentCard 3', exact: true }).click();
  await page.getByRole('spinbutton', { name: '画布宽度（px）', exact: true }).fill('860');
  await cards.first().waitFor();
  assert(await cards.count() === 8, '八个常用类型和长名称样例');
  const icons = await cards.locator('.pl-attachment-card__icon svg').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-icon')));
  assert(icons.join(',') === 'file-excel,file-word,file-pdf,file-powerpoint,file-zipper,file-lines,file-code,file-excel', '图标对应真实文件类型');
  assert(await cards.locator('.pl-attachment-card__detail').allTextContents().then(values => values.every(v => v === '1 KB')), '文件显示真实大小');
  assert(await cards.last().locator('.pl-attachment-card__basename').evaluate(el => el.scrollWidth > el.clientWidth), '长文件名实际发生省略');
  assert(await cards.last().locator('.pl-attachment-card__extension').textContent() === '.xlsx', '省略后扩展名完整保留');
  const visual = async card => card.evaluate(el => {
    const s = getComputedStyle(el), icon = el.querySelector('.pl-attachment-card__icon');
    return { height: s.height, radius: s.borderRadius, background: s.backgroundColor, color: getComputedStyle(icon).color, path: icon.querySelector('path').getAttribute('d') };
  });
  const sentVisual = await visual(cards.first());
  await frame.locator('.pl-example-target').screenshot({ path: 'output/playwright/attachment-types.png' });
  await select('status');
  const initial = await cards.boundingBox();
  for (const status of ['processing', 'error', 'ready', 'processing', 'error', 'ready']) {
    await frame.getByRole('button', { name: '切换附件状态' }).click();
    assert(await cards.getAttribute('data-status') === status, `状态 ${status} 已更新`);
    const box = await cards.boundingBox();
    assert(['x', 'y', 'width', 'height'].every(k => box[k] === initial[k]), `状态 ${status} 不改变卡片位置尺寸`);
  }
  await select('draft');
  await frame.getByRole('button', { name: /移除附件/ }).click();
  assert(await cards.count() === 0, '草稿移除正常触发');
  await frame.getByRole('button', { name: '恢复样例' }).click();
  assert(await cards.count() === 1, '样例恢复后卡片正常');

  await page.getByRole('button', { name: /^TaskComposer \d+$/ }).click();
  await frame.locator('input[type=file]').last().waitFor({ state: 'attached' });
  await frame.locator('input[type=file]').last().setInputFiles({ name: '项目数据.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(1024, 65) });
  await cards.locator('.pl-attachment-card__detail').getByText('1 KB', { exact: true }).waitFor();
  await page.waitForTimeout(700);
  assert(JSON.stringify(await visual(cards)) === JSON.stringify(sentVisual), 'Composer 和已发送卡片的类型图标、颜色、高度、圆角、背景一致');
  await frame.locator('input[type=file]').last().setInputFiles('D:/git-depository/Plotloom/docs/plotloom-agent-architecture.diagram.visual-check.1440x900.light.png');
  const thumb = frame.locator('.pl-attachment-thumbnail');
  await thumb.waitFor();
  await thumb.locator('img').evaluate(img => img.decode());
  assert(await thumb.locator('img').evaluate(img => img.naturalWidth > 0), 'Composer 实际选择图片后显示真实缩略图');
  await page.waitForTimeout(700);
  assert(Math.round((await thumb.boundingBox()).width) === 68, '上传前后缩略图采用相同 68px 尺寸');
  await thumb.click();
  await frame.getByRole('dialog').waitFor();
  assert(true, 'Composer 原有点击预览保持可用');
  await page.keyboard.press('Escape');
  await frame.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForTimeout(600);
  await frame.locator('.pl-example-target').screenshot({ path: 'output/playwright/attachment-composer.png' });
  await frame.getByRole('button', { name: '移除附件 项目数据.xlsx', exact: true }).click();
  await cards.waitFor({ state: 'detached' });
  assert(true, 'Composer 移除文件保留退出动画并实际删除');
  return { passed: passed.length, assertions: passed };
}
