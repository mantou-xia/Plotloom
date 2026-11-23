// 配合 basic-agent-server.ts 验证正式小说入口；模型替身只控制工具决策。
async page => {
  const origin = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const button = name => page.getByRole('button', { name, exact: true });
  const read = async (base, path) => (await page.request.post(base + "/document/read", { data: { path } })).json();
  const plan = (steps, extra) => 'WRITE:' + JSON.stringify({ steps, ...extra });

  const { projects: [project] } = await (await page.request.get(origin + '/api/projects')).json();
  const title = '灯塔验收';
  await page.goto(origin + '/#page=novels');
  const { workspaces } = await (await page.request.get(origin + '/api/workspaces')).json();
  for (const [name, suffix] of [[title, 'page'], ['侧栏建书验收', 'sidebar']]) {
    if (workspaces.some(book => book.title === name)) continue;
    if (suffix === 'page') await page.getByRole('main').getByRole('button', { name: '新建小说', exact: true }).click();
    else {
      await button('小说').hover();
      await button('新建小说').click();
    }
    const dialog = page.getByRole('dialog', { name: '新建小说' });
    await dialog.getByLabel('小说名称').fill(name);
    if (suffix === 'page') {
      await dialog.getByLabel('本机文件夹').fill(project.path);
      await button('创建并开始对话').click();
      await page.getByText('请选择空文件夹，新建小说需要初始化目录。', { exact: true }).waitFor();
    }
    await dialog.getByLabel('本机文件夹').fill(project.path + '-novel-' + suffix);
    await button('创建并开始对话').click();
    await page.getByRole('heading', { name: '继续创作《' + name + '》' }).waitFor();
    const id = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('workspace');
    assert(id && (await (await page.request.get(origin + '/api/workspaces/' + id)).json()).title === name, '初始聊天归属新书');
    await page.reload();
    await page.getByRole('heading', { name: '继续创作《' + name + '》' }).waitFor();
    if (suffix === 'sidebar') {
      await page.getByText(/故事开头，主角生活在一个怎样的世界/).waitFor();
      const startPage = page.url();
      await page.getByRole('textbox', { name: '输入消息，/ 调用技能，@ 引用文件' }).fill(plan([{ name: 'propose_world_rule',
        args: { subject: '内功', fact: '归元境只见于古籍。', effective: 1, revealed: 10 } }]));
      const created = page.waitForResponse(response => response.url().endsWith('/workspaces/' + id + '/sessions') && response.request().method() === 'POST');
      await button('发送').click();
      assert((await (await created).json()).workspaceId === id, '首次发送创建属于该书的会话');
      const approval = page.getByRole('region', { name: '保存世界观设定' });
      await approval.getByRole('button', { name: '允许一次' }).click();
      await page.waitForFunction(async book => {
        const doc = await fetch('/api/workspaces/' + book + '/document/read', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '世界观.md' }) });
        return (await doc.json()).content.includes('归元境');
      }, id);
      await page.goto(startPage);
      await page.getByText('从这里开始一段新的对话。').waitFor();
    }
  }
  await page.goto(origin + '/#page=novels');
  await button('打开 ' + title).click();
  await page.waitForURL(url => new URLSearchParams(url.hash.slice(1)).has('workspace'));
  const workspace = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('workspace');
  const base = origin + '/api/workspaces/' + workspace;
  const name = Date.now().toString(36);
  const chapter = '正文章节/' + name + '.md';
  const outline = '大纲/' + name + '.md';
  const put = async (path, content) => {
    const result = await page.request.put(base + '/document', { data: { path, content, baseVersion: null } });
    assert(result.ok(), '写入测试文稿');
    return result.json();
  };
  const initialStats = await (await page.request.get(base + '/manuscript-stats')).json();
  await put(chapter, '灯塔😀');
  await put(outline, '# 总纲');
  const world = await read(base, '世界观.md');
  if (!world.version) await put('世界观.md', '# 海港设定');
  const character = '人物' + name;
  for (const [number, note] of [[8, '远航'], [2, '初遇']]) {
    const result = await page.request.post(base + '/character-cards', { data: { character, chapter: number, note, content: '## ' + note } });
    assert(result.ok(), '写入测试角色卡');
  }

  await button('刷新小说资料').click();
  const tab = name => page.getByRole('tab', { name, exact: true });
  await tab('正文').click();
  await button(name).click();
  const editor = page.getByRole('textbox', { name: '文稿正文' });
  await editor.getByText('灯塔😀').waitFor();
  const stats = page.locator('[aria-label="正文统计"]');
  const expectStats = async (addedChars) => {
    const format = new Intl.NumberFormat('zh-CN');
    const expected = format.format(initialStats.chapters + 1) + ' 章 · ' + format.format(initialStats.characters + addedChars) + ' 字';
    await page.waitForFunction(expected => document.querySelector('[aria-label="正文统计"]')?.textContent.trim() === expected, expected);
  };
  await expectStats(3);
  const footerBefore = await stats.boundingBox();
  await editor.fill('潮声渐近😀');
  await expectStats(5);
  const footerAfter = await stats.boundingBox();
  assert(footerBefore.y === footerAfter.y, '自动保存不移动底栏');
  assert((await read(base, chapter)).content === '潮声渐近😀', '自动保存更新正文');
  await tab('预览').click();
  await page.getByRole('article', { name: '章节预览' }).getByText('潮声渐近😀').waitFor();
  await tab('大纲').click();
  await button(name).click();
  await tab('预览').click();
  await page.getByRole('heading', { name: '总纲', exact: true }).waitFor();
  await tab('角色卡').click();
  await button(character).click();
  const stages = page.getByRole('tabpanel', { name: '角色卡' }).locator('.plotloom-novel-character-stages button');
  assert((await stages.nth(0).getAttribute('aria-label')) === '第 2 章起' && (await stages.nth(1).getAttribute('aria-label')) === '第 8 章起', '阶段按创建时间倒序');
  assert((await stages.nth(0).innerText()).includes('初遇'), '阶段条目显示变化备注');
  await stages.first().click();
  await page.getByRole('heading', { name: character + ' · 第 2 章起' }).waitFor();
  await button('世界观').click();
  await page.getByRole('heading', { name: '世界观', exact: true }).waitFor();
  assert(await page.getByRole('textbox', { name: '创作要求' }).count() === 0, '管理页没有创作表单');
  assert(await button('审阅候选').count() === 0, '管理页没有候选审阅入口');
  await button('返回全部小说').click();
  await button('打开 ' + title).waitFor();
  return { title, checks: ['建书', '本书聊天', '管理目录', '角色阶段倒序', '统计', '自动保存', '预览', '世界观', '返回书架'] };
}
