// 使用 basic-agent-server.ts、产品页面 4463 和接口试验台 4464。
async (page) => {
  const server = 'http://127.0.0.1:4432';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const projects = await page.request.get(server + '/api/projects');
  const [project] = (await projects.json()).projects;
  const created = await page.request.post(server + '/api/sessions', { data: { projectPath: project.path, name: '交付产物验收' } });
  assert(created.status() === 201, await created.text());
  const { id } = await created.json();
  const url = server + '/api/sessions/' + id;
  const config = await page.request.put(url + '/config', { data: { projectApprovalMode: 'full_access' } });
  assert(config.ok(), await config.text());
  const path = '产物 数据.csv';
  const finalText = '[场景](scene.md)和[表格][report]，再次引用[场景副本](./scene.md)。另外有[网站](https://example.com)和代码 `[例子](ignored.md)`。\n\n[report]: <' + path + '>';
  const generated = await page.request.post(url + '/messages', { data: { text: 'WRITE:' + JSON.stringify({
    steps: [{ name: 'write', args: { path, content: 'name,id\n灯塔,' + id } },
      { name: 'write', args: { path: '未交付.txt', content: '仅文件对比 ' + id } }], finalText,
  }) } });
  assert((await generated.text()).includes('event: completed'), '未收到模型完成事件');

  await page.goto('http://127.0.0.1:4463/#chat=' + id);
  const response = page.locator('.plotloom-chat__response');
  const sceneLink = response.getByRole('link', { name: '场景', exact: true });
  await sceneLink.waitFor();
  assert(!(await response.textContent()).includes('[blocked]'), '正文仍有 blocked 标记');
  assert(await response.getByRole('link', { name: '网站' }).getAttribute('href') === 'https://example.com/', '外链行为改变');
  const artifacts = page.getByRole('region', { name: '交付产物' });
  const scene = artifacts.getByRole('button', { name: '打开 scene.md' });
  const report = artifacts.getByRole('button', { name: '打开 ' + path });
  assert(await artifacts.getByRole('button').count() === 2, '重复链接或非交付文件生成了卡片');
  assert(await artifacts.evaluate(el => el.nextElementSibling?.classList.contains('plotloom-chat__file-summary')), '交付区应在文件对比上方');

  await sceneLink.click();
  const preview = page.getByRole('region', { name: 'Markdown 阅读器' });
  await preview.getByText('核对标记：灯塔-731。').waitFor();
  await report.click();
  const unsupported = page.getByText('该文件类型目前不支持预览。');
  await unsupported.waitFor();
  await scene.click();
  await report.click();
  await unsupported.waitFor();
  assert(!(await preview.isVisible()), '快速切换后显示了上一个文件的预览');
  await scene.focus();
  await page.keyboard.press('Enter');
  await preview.getByText('核对标记：灯塔-731。').waitFor();
  const opened = [];
  for (const [entry, file] of [[report, path], [sceneLink, 'scene.md']]) {
    const request = page.waitForResponse(res => res.url().endsWith('/deliverable') && res.request().postDataJSON().action === 'open');
    await entry.click({ modifiers: ['Shift'] });
    const result = await request;
    assert(result.request().postDataJSON().path === file && (await result.json()).kind === 'opened', 'Shift 点击未打开对应文件');
    opened.push(file);
    assert(await preview.isVisible(), 'Shift 点击改变了工作区预览');
  }

  await page.reload();
  await sceneLink.waitFor();
  assert(await artifacts.getByRole('button').count() === 2, '历史消息未恢复交付卡片');

  await page.goto('http://127.0.0.1:4464/#sessions.deliverable');
  await page.getByLabel('会话 ID', { exact: true }).fill(id);
  const send = async (body, status, kind) => {
    await page.getByLabel('请求体', { exact: true }).fill(JSON.stringify(body));
    const received = page.waitForResponse(res => res.url().endsWith('/deliverable'));
    await page.getByRole('button', { name: '发送请求' }).click();
    const result = await received;
    assert(result.status() === status, '试验台状态不符：' + result.status());
    const payload = await result.json();
    assert((payload.kind ?? payload.error?.code) === kind, '试验台响应类型不符');
  };
  await send({ path: 'scene.md', action: 'preview' }, 200, 'markdown');
  await send({ path, action: 'preview' }, 200, 'unsupported');
  await send({ path: '不存在.md', action: 'preview' }, 404, 'DELIVERABLE_UNAVAILABLE');
  await send({ path, action: 'open' }, 200, 'opened');
  return { delivered: 2, preview: 'markdown / unsupported', shiftOpened: opened, demo: '200 / 404' };
}
