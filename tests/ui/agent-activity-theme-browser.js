// 检查画布实际像素，覆盖没有持续动画帧的状态。
async page => {
  await page.getByRole('searchbox', { name: '搜索组件' }).fill('AgentActivityHeader');
  await page.getByRole('button', { name: /^AgentActivityHeader/ }).click();
  const mode = page.getByRole('combobox', { name: '颜色模式', exact: true });
  const state = page.locator('#example-state');
  const frame = page.frames().find(item => item.url().includes('preview=1'));
  const canvas = frame.locator('.pl-agent-activity__canvas');

  const checkPixels = async dark => {
    await frame.waitForFunction(expectDark => {
      const node = document.querySelector('.pl-agent-activity__canvas');
      const context = node?.getContext('2d');
      if (!context) return false;
      const rgba = context.getImageData(0, 0, node.width, node.height).data;
      let matching = 0;
      for (let index = 0; index < rgba.length; index += 4) {
        if (rgba[index + 3] < 240) continue;
        const brightness = (rgba[index] + rgba[index + 1] + rgba[index + 2]) / 3;
        if (expectDark ? brightness > 180 : brightness < 80) matching++;
        if (matching >= 100) return true;
      }
      return false;
    }, dark);
  };

  await mode.selectOption('light');
  await state.selectOption('stopped');
  await frame.getByText('已停止', { exact: true }).waitFor();
  await checkPixels(false);
  const stoppedCanvas = await canvas.elementHandle();
  await mode.selectOption('dark');
  await checkPixels(true);
  if (!await stoppedCanvas.evaluate(node => node.isConnected)) throw new Error('切换颜色不应替换已停止的画布');
  await mode.selectOption('light');
  await checkPixels(false);

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mode.selectOption('system');
  await page.locator('#example-state option').first().evaluate(option => option.value).then(value => state.selectOption(value));
  await checkPixels(false);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await checkPixels(true);
  return { checks: ['已停止时来回切换', '保持同一画布', '减少动态效果时跟随系统'] };
}
