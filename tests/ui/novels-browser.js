// 配合 basic-agent-server.ts 验证正式小说入口；模型替身只控制工具决策。
async page => {
  const origin = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const button = name => page.getByRole('button', { name, exact: true });
  const editor = page.getByRole('textbox', { name: 'Markdown 正文' });
  const prompt = page.getByRole('textbox', { name: '创作要求' });
  const read = async (base, path) => (await page.request.post(base + '/document/read', { data: { path } })).json();
  const choose = async (label, option) => {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const toggle = async (label, option) => {
    await choose(label, option);
    await page.keyboard.press('Escape');
  };
  const plan = (steps, extra) => 'WRITE:' + JSON.stringify({ steps, ...extra });
  const clear = { name: 'review_writing', args: { status: 'clear', issues: [] } };
  const propose = (path, content) => ({ name: 'propose_change', args: { path, content, reason: '按本轮要求修改。' } });

  const { projects: [project] } = await (await page.request.get(origin + '/api/projects')).json();
  const title = '灯塔验收';
  await page.goto(origin + '/#page=novels');
  const { workspaces } = await (await page.request.get(origin + '/api/workspaces')).json();
  if (workspaces.some(book => book.title === title)) await button('打开 ' + title).click();
  else {
    await button('登记小说').click();
    await page.getByRole('textbox', { name: '小说名称' }).fill(title);
    await page.getByRole('textbox', { name: '本机文件夹' }).fill(project.path);
    await button('登记并打开').click();
  }
  await page.waitForURL(url => new URLSearchParams(url.hash.slice(1)).has('workspace'));
  const workspace = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('workspace');
  const base = origin + '/api/workspaces/' + workspace;
  const slug = Date.now().toString(36);
  const outline = '大纲-' + slug + '.md';
  const path = '章节-' + slug + '.md';
  async function openNew(path) {
    await button('新建文稿').click();
    await page.getByRole('textbox', { name: '文稿相对路径' }).fill(path);
    await button('打开文稿').click();
    await page.getByText('新文稿', { exact: true }).waitFor();
  }
  async function save() {
    await button('保存').click();
    await page.getByText('已保存', { exact: true }).waitFor();
  }
  await openNew(outline);
  const outlineText = '# 第一章\n归还铜钥匙。';
  await editor.fill(outlineText);
  await choose('保存类型', '正式大纲');
  await save();
  assert((await read(base, outline)).content === outlineText, '大纲原样保存');

  await openNew(path);
  await editor.fill('未保存草稿😀');
  await page.reload();
  await page.getByText('未保存草稿', { exact: true }).waitFor();
  assert(await editor.inputValue() === '未保存草稿😀', '刷新恢复当前路径与草稿');
  await button('丢弃草稿').click();

  const initial = '序幕😀\r\n同一句。\r\n中段\r\n同一句。\r\n后文\r\n';
  await choose('创作任务', '按大纲写章节');
  await choose('正式大纲', outline);
  await prompt.fill(plan([clear, propose(path, initial)]));
  await button('生成候选').click();
  const candidate = button('审阅候选 ' + path);
  await candidate.waitFor();
  assert((await read(base, path)).version === null, '候选出现时尚未写入新文稿');
  await candidate.click();
  await page.getByRole('region', { name: '第 1 处差异' }).getByText('序幕😀', { exact: true }).waitFor();
  await button('采纳').click();
  await page.getByRole('dialog').getByText('已采纳', { exact: true }).waitFor();
  await button('关闭弹窗').click();
  await page.getByText('已保存', { exact: true }).waitFor();
  assert((await read(base, path)).content === initial, '采纳后正式稿保留 CRLF');

  await choose('创作任务', '改写选区');
  await toggle('参考资料', outline);
  await editor.evaluate(node => {
    const start = node.value.lastIndexOf('同一句。');
    node.focus();
    node.setSelectionRange(start, start + '同一句。'.length);
    node.dispatchEvent(new Event('select', { bubbles: true }));
    document.dispatchEvent(new Event('selectionchange'));
  });
  await prompt.fill(plan([clear, propose(path, '只改后句。')]));
  await button('生成候选').click();
  await candidate.nth(1).waitFor();
  await page.reload();
  await candidate.nth(1).waitFor();
  const beforeReview = await read(base, path);
  assert(beforeReview.content === initial, '刷新后候选仍可审阅，正式稿保持原文');
  const { proposals } = await (await page.request.get(base + '/proposals')).json();
  const rewrite = proposals.find(item => item.path === path && item.baseVersion === beforeReview.version);
  assert(rewrite?.content === initial.replace('中段\r\n同一句。', '中段\r\n只改后句。'), 'CRLF、emoji 与重复句选区映射正确');
  assert(rewrite.references.some(item => item.path === outline), '参考资料的真实版本随候选落盘');

  const external = initial + '第二个编辑客户端保留的文字。\r\n';
  const saved = await page.request.put(base + '/document', { data: { path, baseVersion: beforeReview.version, content: external } });
  assert(saved.ok(), '第二客户端已更新正式稿');
  await page.getByText('待审阅', { exact: true }).waitFor();
  await page.getByRole('listitem').filter({ has: candidate, hasText: '待审阅' }).getByRole('button').click();
  await button('采纳').click();
  await page.getByText(/版本|改动|变化/).filter({ hasText: /冲突|重新|已变|已更|已被/ }).last().waitFor();
  assert((await read(base, path)).content === external, '旧候选采纳冲突，保留当前正式稿');
  await button('拒绝').click();
  await page.getByRole('dialog').getByText('已拒绝', { exact: true }).waitFor();
  await button('关闭弹窗').click();

  await editor.fill('作者保留的手工草稿。');
  await page.reload();
  await page.getByText('磁盘文稿已有新版本。当前仍显示草稿。', { exact: true }).waitFor();
  assert(await editor.inputValue() === '作者保留的手工草稿。' && await button('保存').isDisabled(), '冲突时草稿仍可找回且禁止覆盖');
  await button('丢弃草稿').click();

  await button('刷新').click();
  await page.getByText('已保存', { exact: true }).waitFor();
  await button('历史版本').click();
  const history = page.getByRole('dialog', { name: '历史版本' });
  await history.getByRole('combobox', { name: '历史版本', exact: true }).click();
  await page.getByRole('option', { name: /采纳候选/ }).click();
  await history.getByLabel('历史文稿预览').getByText('中段', { exact: false }).waitFor();
  await button('恢复所选版本').click();
  await history.waitFor({ state: 'hidden' });
  assert((await read(base, path)).content === initial, '正式稿恢复为所选历史版本');
  const downloaded = page.waitForEvent('download');
  await button('导出 Markdown').click();
  const file = await downloaded;
  assert(file.suggestedFilename() === path && !(await file.failure()), '正式稿下载成功');

  await choose('创作任务', '续写');
  await prompt.fill(plan([clear, propose(path, '未完成的续写')], { waitBefore: 0 }));
  const generateBefore = await button('生成候选').boundingBox();
  await button('生成候选').click();
  await page.getByText('正在创作…', { exact: true }).waitFor();
  const generateDuring = await button('生成候选').boundingBox();
  assert(generateBefore?.y === generateDuring?.y && generateBefore?.width === generateDuring?.width, '生成反馈不挤动生成按钮');
  await page.reload();
  await page.getByText('正在创作…', { exact: true }).waitFor();
  await button('停止生成').click();
  await page.getByRole('status').getByText('已停止', { exact: true }).waitFor();
  assert((await read(base, path)).content === initial, '停止后已恢复的正式稿保持不变');

  await choose('创作任务', '按大纲写章节');
  await choose('正式大纲', outline);
  const twoChanges = initial.replace('序幕😀', '新序幕😀').replace('后文', '新尾声');
  await prompt.fill(plan([clear, propose(path, twoChanges)]));
  await button('生成候选').click();
  await candidate.nth(2).waitFor();
  await page.getByRole('listitem').filter({ has: candidate, hasText: '待审阅' }).getByRole('button').click();
  const review = page.getByRole('dialog', { name: '审阅候选差异' });
  await review.getByRole('button', { name: '采纳', exact: true }).first().click();
  await review.getByText('已采纳', { exact: true }).waitFor();
  await review.getByRole('button', { name: '拒绝', exact: true }).last().click();
  await review.getByText('已拒绝', { exact: true }).waitFor();
  assert((await read(base, path)).content === initial.replace('序幕😀', '新序幕😀'), '同一候选的两处差异可分别采纳和拒绝');
  await button('关闭弹窗').click();
  return { checks: ['登记和打开', '大纲原样留档', '刷新找回草稿', '按正式大纲生成', '差异和采纳', 'CRLF 与重复句选区',
    '版本化参考资料', '刷新找回候选', '旧候选冲突与拒绝', '冲突保留草稿', '历史恢复', '下载 Markdown',
    '生成控件位置', '刷新后停止', '同一候选逐处采纳和拒绝'] };
}
