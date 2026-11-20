// Playwright CLI：run-code --filename tests/ui/markdown-emergence-browser.js
async (page) => {
  const passed = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (value, label) => { if (!value) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const markdown = frame.locator('.pl-markdown');
  const content = '让文字慢慢发生，像雾散开，像光经过。'.repeat(36);
  try {
    await page.getByRole('button', { name: 'MarkdownRenderer 7' }).click();
    await page.locator('#example-state').selectOption('default');
    await markdown.waitFor();
    const picker = page.getByRole('combobox', { name: '文字渐现效果' });
    assert(await picker.inputValue() === 'ink', '默认选择水墨晕开');
    assert(await markdown.locator('[data-sd-animate]').count() === 0, '静态正文不增加动画包装');
    await page.getByRole('textbox', { name: '内容', exact: true }).fill(content);
    await page.getByRole('checkbox', { name: '模拟流式输入' }).check();
    for (const effect of ['ink', 'mist', 'light']) {
      await picker.selectOption(effect);
      await frame.getByRole('button', { name: '重新播放', exact: true }).click();
      await markdown.locator('span[data-sd-animate]').first().waitFor();
      // 在真实流式追加期间观察同一个字，确保下一分块不会重置它的时序。
      const continuity = await markdown.evaluate(async el => {
        const glyph = el.querySelector('span[data-sd-animate]');
        const duration = glyph.style.getPropertyValue('--sd-duration');
        const oldLength = el.textContent.length;
        await new Promise(resolve => setTimeout(resolve, 120));
        return { connected: glyph.isConnected, duration, nextDuration: glyph.style.getPropertyValue('--sd-duration'), grew: el.textContent.length > oldLength };
      });
      assert(continuity.connected && continuity.grew && continuity.duration === continuity.nextDuration, `${effect} 高频追加保持已有单字动画时序`);
      // 冻结真实 CSS 动画到中间帧，验证实际滤镜/位移/遮罩，不只比对类名。
      const middle = await markdown.evaluate((el, effect) => {
        const animations = el.getAnimations({ subtree: true });
        const animation = animations.find(item => item.animationName === `sd-pl-${effect}`);
        if (!animation) return null;
        animation.pause();
        const timing = animation.effect.getTiming();
        animation.currentTime = Number(timing.delay) + Number(timing.duration) * .4;
        const style = getComputedStyle(animation.effect.target);
        const result = { opacity: Number(style.opacity), filter: style.filter, transform: style.transform, mask: style.maskImage, shadow: style.textShadow };
        animation.play();
        return result;
      }, effect);
      assert(middle && middle.opacity > 0 && middle.opacity < 1, `${effect} 存在真实渐现中间帧`);
      if (effect === 'ink') assert(middle.filter.includes('blur'), '水墨中间帧保留柔焦');
      if (effect === 'mist') assert(middle.filter.includes('blur') && middle.transform !== 'none', '薄雾中间帧柔焦并上移');
      if (effect === 'light') assert(middle.mask.includes('linear-gradient') && middle.shadow !== 'none', '柔光中间帧具有渐变遮罩和高光');
      await frame.getByRole('button', { name: '停止', exact: true }).click();
      const stopped = await markdown.textContent();
      await page.waitForTimeout(150);
      assert(await markdown.textContent() === stopped && stopped.length > 0, `${effect} 停止保留已接收正文`);
      assert(await markdown.locator('[data-sd-animate]').count() === 0 && await markdown.evaluate(el => el.getAnimations({ subtree: true }).length) === 0, `${effect} 停止清理动画包装及滤镜`);
    }
    await frame.getByRole('button', { name: '重新播放', exact: true }).click();
    await frame.getByText('已完成', { exact: true }).waitFor();
    assert(await markdown.textContent() === content, '重播完成后正文完整，无重复或遗漏');
    assert(await markdown.locator('[data-sd-animate]').count() === 0, '自然完成清理逐字包装');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await frame.getByRole('button', { name: '重新播放', exact: true }).click();
    await markdown.locator('span[data-sd-animate]').first().waitFor();
    assert(await markdown.evaluate(el => el.getAnimations({ subtree: true }).length) === 0, '减少动态效果时没有播放动画');
    assert(await markdown.locator('span[data-sd-animate]').first().evaluate(el => getComputedStyle(el).opacity === '1' && getComputedStyle(el).filter === 'none'), '减少动态效果时新增文字直接清晰显示');
    await frame.getByRole('button', { name: '停止', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: '窄屏', exact: true }).click();
    await frame.getByRole('button', { name: '重新播放', exact: true }).click();
    await markdown.locator('span[data-sd-animate]').first().waitFor();
    assert(await markdown.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏逐字动画不撑破正文宽度');
    await frame.getByRole('button', { name: '停止', exact: true }).click();
    assert(errors.length === 0, `浏览器无未捕获异常：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally {
    page.off('pageerror', onError);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
}
