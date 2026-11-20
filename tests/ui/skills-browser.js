// 在 Playwright CLI 会话中执行：run-code --filename tests/ui/skills-browser.js
// 组件检查使用 4320；页面检查使用 4319，接口以浏览器内夹具覆盖以验证交互状态。
async (page) => {
  const passed = [];
  const assert = (value, label) => { if (!value) throw new Error(label); passed.push(label); };
  await page.goto('http://127.0.0.1:4320');
  await page.getByRole('button', { name: 'PrimaryTabs 3' }).click();
  const frame = page.frameLocator('iframe');
  await frame.getByRole('tab', { name: '最近', exact: true }).click();
  assert(await frame.getByRole('tab', { name: '最近', exact: true }).getAttribute('aria-selected') === 'true', '一级 Tab 点击更新受控值');
  await page.keyboard.press('ArrowLeft');
  assert(await frame.getByRole('tab', { name: '全部', exact: true }).getAttribute('aria-selected') === 'true', '方向键切换分类');
  const stable = await frame.getByRole('tablist', { name: '内容导航' }).evaluate(async list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const bounds = () => tabs.map(tab => { const r = tab.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    const baseline = JSON.stringify(bounds());
    for (let index = 0; index < 12; index++) {
      tabs[index % tabs.length].click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (JSON.stringify(bounds()) !== baseline) return false;
    }
    return true;
  });
  assert(stable, '快速切换全过程标签位置和尺寸稳定');
  await frame.getByRole('tab', { name: '最近', exact: true }).click();
  await frame.getByRole('tabpanel', { name: '最近', exact: true }).waitFor();
  assert(await frame.getByRole('tabpanel').count() === 1, '标签关联面板且只展示当前内容');
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe').contentDocument;
    const tab = doc.querySelector('[role="tab"][aria-selected="true"]').getBoundingClientRect();
    const indicator = doc.querySelector('.pl-primary-tabs__indicator').getBoundingClientRect();
    return Math.abs(tab.x - indicator.x) < 1 && Math.abs(tab.width - indicator.width) < 1;
  });
  passed.push('滑块最终对齐当前标签');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await frame.locator('.pl-primary-tabs__indicator').evaluate(el => getComputedStyle(el).transitionDuration === '0s'), '减少动态效果时关闭滑动');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#example-state').selectOption('option-disabled');
  await frame.getByRole('tab', { name: '最近', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  assert(await frame.getByRole('tab', { name: '全部', exact: true }).getAttribute('aria-selected') === 'true', '键盘跳过禁用项');
  await page.locator('#example-state').selectOption('disabled');
  assert(await frame.getByRole('tab', { name: '全部', exact: true }).isDisabled(), '整体禁用');

  const base = { version: 'a'.repeat(64), origin: 'test', updatedAt: '', compatibility: '', declaredTools: [], files: ['SKILL.md'], missingTools: [], warnings: [], runnable: true };
  let skills = [
    { ...base, id: 'builtin-test', name: 'novel-writing', description: '为小说规划大纲、整理人物与章节。', source: 'builtin' },
    { ...base, id: 'personal-1', name: 'dialogue-polish', description: '打磨人物对白，保持人物声音一致。', source: 'imported' },
    { ...base, id: 'personal-2', name: 'my-outline', description: '整理章节大纲', source: 'custom' },
    { ...base, id: 'personal-3', name: 'scene-check', description: '检查场景中的人物与道具', source: 'imported', runnable: false, warnings: ['缺少声明工具'] },
    { ...base, id: 'personal-4', name: 'character-notes', description: '整理角色卡片和关系', source: 'custom' },
  ];
  let mode = 'cancelled'; let failList = false; let importCalls = 0; let release;
  const requests = [];
  await page.route('**/api/skills', async route => {
    await route.fulfill({ status: failList ? 500 : 200, json: failList ? { error: { code: 'FAILED', message: '读取失败' } } : { skills } });
  });
  await page.route('**/api/skills/import-folder', async route => {
    importCalls++; requests.push(route.request().postDataJSON());
    if (mode === 'pending') await new Promise(resolve => { release = resolve; });
    if (mode === 'failed') { await route.fulfill({ status: 409, json: { error: { code: 'SKILL_NAME_EXISTS', message: '同名技能已存在，请使用其他名称。' } } }); return; }
    if (mode !== 'success') { await route.fulfill({ json: { skill: null } }); return; }
    const skill = { ...base, id: 'new-skill', name: 'new-import', source: 'imported', description: '新导入的技能' };
    skills = [...skills, skill]; await route.fulfill({ json: { skill } });
  });
  try {
    await page.goto('http://127.0.0.1:4319');
    await page.getByRole('button', { name: '技能', exact: true }).click();
    await page.getByRole('heading', { name: 'novel-writing', exact: true }).waitFor();
    assert((await page.getByRole('tab', { name: /系统内置/ }).textContent()).includes('1'), '系统技能数量');
    await page.getByRole('tabpanel', { name: /系统内置/ }).waitFor();
    await page.getByRole('tab', { name: /个人安装/ }).click();
    await page.getByRole('tabpanel', { name: /个人安装/ }).waitFor();
    assert(await page.locator('.plotloom-skill-item').count() === 4, '个人分类包含自建及导入技能');
    assert((await page.locator('.plotloom-skills').textContent()).includes('当前不可用'), '缺失工具诊断保留');
    const search = page.getByRole('searchbox', { name: '搜索技能', exact: true });
    await search.fill('DIALOGUE');
    assert(await page.locator('.plotloom-skill-item').count() === 1, '名称搜索不区分大小写');
    await search.fill('章节');
    assert((await page.locator('.plotloom-skills').textContent()).includes('my-outline'), '按描述搜索');
    await search.fill('不存在的技能');
    await page.getByText('没有找到匹配的技能', { exact: true }).waitFor();
    passed.push('搜索无结果提示');
    await page.getByRole('button', { name: '清空输入', exact: true }).click();
    assert(await page.locator('.plotloom-skill-item').count() === 4, '清空搜索恢复列表');
    await page.setViewportSize({ width: 1440, height: 960 });
    assert(await page.locator('.plotloom-skills').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 2), '宽屏双列');
    await page.screenshot({ path: 'output/playwright/skills-desktop.png' });
    await page.setViewportSize({ width: 760, height: 900 });
    assert(await page.locator('.plotloom-skills').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 1), '窄屏单列');
    assert(await page.locator('.plotloom-page-layout').evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏页面无横向溢出');
    await page.screenshot({ path: 'output/playwright/skills-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 960 });
    const importButton = page.getByRole('button', { name: '导入技能', exact: true });
    await importButton.click();
    await page.waitForFunction(() => !document.querySelector('.plotloom-skills-feedback'));
    assert(await page.locator('.plotloom-skill-item').count() === 4, '系统取消不改变列表');
    mode = 'failed'; await importButton.click();
    await page.getByRole('alert').filter({ hasText: '同名技能已存在' }).waitFor();
    passed.push('导入错误提示可重试');
    mode = 'success'; await page.getByRole('tab', { name: /系统内置/ }).click(); await search.fill('novel');
    await importButton.click();
    await page.getByRole('heading', { name: 'new-import', exact: true }).waitFor();
    assert(await search.inputValue() === '', '导入成功清空搜索');
    assert(await page.getByRole('tab', { name: /个人安装/ }).getAttribute('aria-selected') === 'true', '导入成功切至个人分类');
    assert(await page.locator('.plotloom-skill-item').count() === 5, '导入结果与数量更新');
    assert(requests.every(body => Object.keys(body).length === 0), '导入仅发送空对象，无路径字段');
    mode = 'pending'; await importButton.click();
    await page.getByText('请在系统窗口选择包含 SKILL.md 的文件夹，确认后开始导入。').waitFor();
    assert(await importButton.isDisabled(), '选择期间禁止重复提交');
    assert(importCalls === 4, '每次操作只发起一次请求');
    mode = 'cancelled'; release();
    await page.waitForFunction(() => !document.querySelector('.plotloom-skills-feedback'));
    // 关闭顶部提示后操作页头，避免悬停提示暂停计时并挡住刷新按钮。
    for (const close of await page.getByRole('button', { name: '关闭提示', exact: true }).all()) await close.click();
    failList = true; await page.getByRole('button', { name: '刷新技能', exact: true }).click();
    await page.getByRole('button', { name: '重新加载', exact: true }).waitFor();
    passed.push('列表失败显示重试入口');
    failList = false; await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('heading', { name: 'new-import', exact: true }).waitFor();
    passed.push('重试恢复列表');
    return { passed };
  } finally {
    await page.unroute('**/api/skills'); await page.unroute('**/api/skills/import-folder');
  }
}
