// 在产品页验证持久化、系统变化，以及弹层与 Shadow DOM 是否同步换色。
async page => {
  const origin = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const brightness = node => node.evaluate(async element => {
    // 先结算交互控件的短过渡，再取最终颜色。颜色变化不应重建控件。
    getComputedStyle(element).backgroundColor;
    await Promise.allSettled(element.getAnimations()
      .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
      .map(animation => animation.finished));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return (red + green + blue) / 3;
  });
  const appearance = page.getByRole('radiogroup', { name: '颜色模式' });
  const switchTo = name => appearance.getByRole('radio', { name, exact: true }).click();
  const scheme = value => page.locator(`html[data-pl-scheme="${value}"]`).waitFor({ state: 'attached' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${origin}/#settings=appearance`);
  await switchTo('深色');
  await scheme('dark');
  await page.reload();
  await scheme('dark');
  await appearance.locator('[role="radio"][aria-checked="true"]').and(appearance.getByRole('radio', { name: '深色', exact: true })).waitFor();
  await switchTo('浅色');
  await page.emulateMedia({ colorScheme: 'dark' });
  await scheme('light');
  await switchTo('跟随系统');
  await scheme('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await scheme('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await scheme('dark');
  await page.getByRole('button', { name: '返回', exact: true }).click();

  const composer = page.locator('[data-message-composer-surface]');
  await composer.waitFor();
  const darkComposer = await brightness(composer);
  await page.emulateMedia({ colorScheme: 'light' });
  await scheme('light');
  const lightComposer = await brightness(composer);
  assert(darkComposer < 95 && lightComposer > 200, '输入器表面应随宿主切换');

  await page.getByRole('button', { name: '项目', exact: true }).hover();
  await page.getByRole('button', { name: '新增项目', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '创建项目' });
  await dialog.waitFor();
  const nameInput = dialog.getByRole('textbox', { name: '项目名称', exact: true });
  await nameInput.fill('主题切换时保留的草稿');
  const lightDialog = await brightness(dialog);
  await page.emulateMedia({ colorScheme: 'dark' });
  await scheme('dark');
  const darkDialog = await brightness(dialog);
  assert(lightDialog > 200 && darkDialog < 95, '已打开的弹层应原位切换');
  assert(await nameInput.inputValue() === '主题切换时保留的草稿' && await nameInput.evaluate(input => input === document.activeElement), '切换主题应保留表单草稿与焦点');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();

  const nav = page.getByRole('navigation', { name: '应用导航' });
  for (const name of ['技能', '小说管理']) {
    await nav.getByRole('button', { name, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    assert(await brightness(page.locator('html')) < 95, name + ' 应继承深色主题');
  }
  return { lightComposer, darkComposer, lightDialog, darkDialog, checked: '系统跟随、显式选择、刷新恢复、已开启的弹层和一级页面' };
}
