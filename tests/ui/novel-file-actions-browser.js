// 使用隔离模型夹具，创建本次验收专属的文稿和聊天。
async page => {
  const origin = new URL(page.url()).origin;
  const check = (ok, label) => { if (!ok) throw Error(label); };
  const button = name => page.getByRole('button', { name, exact: true });
  const item = name => page.getByRole('menuitem', { name, exact: true });
  const get = async path => (await page.request.get(origin + path)).json();
  const prefs = await get('/api/model-config');
  check(['test','p1-test'].includes(prefs.provider) && prefs.model === 'fixture', '需要隔离模型夹具');
  const ws = (await get('/api/workspaces')).workspaces[0];
  const base = '/api/workspaces/' + ws.id;
  const stamp = Date.now();
  const titles = ['界面验收 A ' + stamp, '界面验收 B ' + stamp];
  const path = name => '正文章节/' + name + '.md';
  for (const name of titles) {
    const r = await page.request.put(origin + base + '/document', { data: { path: path(name), baseVersion: null, content: '# ' + name + '\n\n雨停后，渡船靠岸。' } });
    check(r.ok(), '创建测试章节');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/#page=novels&workspace=' + ws.id);
  await page.getByRole('tab', {name:'正文',exact:true}).click();
  const first = button(titles[0]), second = button(titles[1]);
  await first.click();
  check(await first.getAttribute('aria-current') === 'true', '选中正文');
  check(await first.evaluate(el => getComputedStyle(el).backgroundColor) !== await second.evaluate(el => getComputedStyle(el).backgroundColor), '选中背景加深');
  const before = await first.boundingBox();
  await second.click({ button:'right' }); await item('删除章节').click();
  await page.getByRole('dialog').getByText(new RegExp(titles[1])).waitFor();
  await button('取消').click();
  check((await first.boundingBox()).y === before.y && await first.getAttribute('aria-current') === 'true', '右键和取消保留原选中位置');
  await second.click({ button:'right' }); const reveal = page.waitForResponse(r => r.url().endsWith('/document/reveal'));
  await item('在资源管理器中打开').click(); check((await reveal).ok(), '定位文件');
  await second.click({ button:'right' }); await item('删除章节').click();
  await button('移入回收站').click(); await second.waitFor({ state:'detached' });
  check((await get(base + '/documents')).paths.includes(path(titles[0])), '仅回收右键目标');
  const session = await (await page.request.post(origin + base + '/sessions', {data:{}})).json();
  const group = '/api/sessions/' + session.id;
  const filename = '写入审批-' + stamp + '.txt';
  const operation = page.request.post(origin + group + '/messages', { data: { text: 'WRITE:' + JSON.stringify({
    steps:[{ name:'write', args:{ path:filename, content:'长预览行\n'.repeat(180) } }], finalText:'已完成',
  }) } });
  await page.goto(origin + '/#chat=' + session.id);
  const card = page.getByRole('region', {name:'创建文件'});
  await card.waitFor();
  const sizes = [];
  for (const [width,height] of [[1280,900],[390,740]]) {
    await page.setViewportSize({width,height});
    const box = await card.boundingBox(), controls = await button('允许一次').boundingBox();
    check(box.height > 160 && box.height <= height * .65 + 1, '长审批在上下限内扩展');
    check(controls.y >= box.y && controls.y + controls.height <= height, '批准按钮可见');
    check(await card.getByLabel('变更预览').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop>0}), '独立滚动预览');
    check((await button('允许一次').boundingBox()).y === controls.y, '滚动时按钮固定');
    sizes.push(Math.round(box.height));
  }
  await button('允许一次').click();check((await operation).ok(),'完成审批');
  await page.setViewportSize({width:1280,height:900});
  await page.reload();await button('查看变更').click();
  const record = page.getByRole('button', {name:new RegExp(filename)}).last();
  await record.waitFor();if(await record.getAttribute('aria-expanded')==='false')await record.click();
  await page.locator('.pl-file-diff').last().waitFor();
  check((await page.locator('.pl-file-diff').last().innerText()).includes('长预览行'), '展开后可读到实际新增行');
  check((await get(group+'/project-writes')).changes.some(c=>c.path===filename),'小说写入进入对比清单');
  // 普通选择题仍走 QuestionCard；长题干滚动时，答案和发送按钮留在原位。
  await button('收起工作区').click();
  const question = '请选择写作视角。\n'.repeat(32);
  const asking = page.request.post(origin + group + '/messages', { data: { text: 'WRITE:' + JSON.stringify({
    steps: [{ name: 'ask_user', args: { question, options: ['第一人称', '第三人称'] } }], finalText: '已收到选择',
  }) } });
  await page.setViewportSize({width:390,height:740});await page.reload();
  const form = page.getByRole('form', { name: /请选择写作视角/ });
  const option = form.getByRole('radio', { name: /第三人称/ });
  await option.waitFor();
  const optionY = (await option.boundingBox()).y;
  check(await form.getByRole('heading').evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop > 0; }), '长问题可滚动');
  check((await option.boundingBox()).y === optionY, '题干滚动时选项稳定');
  await option.check();await form.getByRole('button',{name:'发送'}).click();check((await asking).ok(),'普通提问可回答');
  return { sizes, chapter:'取消与回收通过', diff:filename, question:'长题干选项可见' };
}
