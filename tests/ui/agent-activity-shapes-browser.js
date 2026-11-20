// Playwright CLI：补充形态、尺寸和原位结果切换检查。
async (page) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.getByRole('button', { name: 'AgentActivityHeader 10' }).click();
  const frame = page.frameLocator('iframe');
  const root = frame.locator('.pl-agent-activity');
  await root.waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const shapes = {};
  try {
    for (const shape of ['book', 'pencil', 'magnifier', 'folder', 'robot', 'cube', 'bricks', 'gift', 'sphere']) {
      await page.getByRole('combobox', { name: '粒子形态', exact: true }).selectOption(shape);
      await page.waitForTimeout(150);
      const canvas = frame.locator(`canvas[data-shape="${shape}"]`);
      await canvas.waitFor();
      const count = await canvas.evaluate(el => {
        const pixels = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
        let count = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) count++;
        return count;
      });
      if (count < 6000) throw new Error(`${shape} 缺少实体像素：${count}`);
      shapes[shape] = count;
      if (['book', 'pencil', 'magnifier', 'folder', 'robot'].includes(shape)) await root.screenshot({ path: `output/playwright/agent-activity-${shape}.png` });
    }
    await page.getByRole('spinbutton', { name: '视觉区高度（px）', exact: true }).fill('420');
    await page.getByRole('spinbutton', { name: '视觉区高度（px）', exact: true }).press('Enter');
    await page.waitForTimeout(150);
    if ((await root.boundingBox()).height !== 420) throw new Error('视觉区高度没有作用于整体');
    for (const phase of ['failed', 'stopped', 'working']) {
      await page.getByRole('combobox', { name: '运行阶段', exact: true }).selectOption(phase);
      await page.waitForTimeout(150);
      if ((await root.boundingBox()).height !== 420) throw new Error(`${phase} 结果切换改变高度`);
    }
    await page.getByRole('spinbutton', { name: '视觉区高度（px）', exact: true }).fill('360');
    await page.getByRole('spinbutton', { name: '视觉区高度（px）', exact: true }).press('Enter');
    await page.getByRole('combobox', { name: '粒子形态', exact: true }).selectOption('auto');
    return { shapes, assertions: 13 };
  } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }); }
}
