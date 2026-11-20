// 隔离模型协议服务配合正式页面：验证错误反馈、操作恢复，并保留截图证据。
async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const origin = new URL(page.url()).origin;
  const checks = [], screenshots = [];
  let id;
  const url = () => `${origin}/api/sessions/${id}`;
  const detail = async () => (await (await page.request.get(url())).json());
  const wait = async predicate => {
    for (let i = 0; i < 250; i++) {
      const current = await detail(); if (predicate(current)) return current;
      await page.waitForTimeout(100);
    }
    throw new Error('会话未达到预期状态');
  };
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const open = async name => {
    const response = await page.request.post(`${origin}/api/sessions`, { data: { name } });
    id = (await response.json()).id;
    if (!id) throw new Error('创建测试聊天失败');
    await page.goto(`${origin}/#chat=${id}`);
    // 应用在初始化读取聊天 ID；同文档 hash 跳转后重载，确保检查的是当前测试会话。
    await page.reload();
    await page.getByRole('textbox', { name: '尽管问...' }).waitFor();
    const collapse = page.getByRole('button', { name: '收起工作区', exact: true });
    if (await collapse.isVisible()) await collapse.click();
  };
  const send = async text => {
    const count = (await detail()).messages.filter(m => m.role === 'user').length;
    await page.getByRole('textbox', { name: '尽管问...' }).fill(text);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await wait(s => s.messages.filter(m => m.role === 'user').length > count);
  };
  const idle = async outcome => {
    const result = await wait(s => s.status === 'idle' && s.messages.findLast(m => m.role === 'user')?.outcome === outcome);
    await page.waitForTimeout(600);
    return result;
  };
  const shot = async name => {
    const path = `output/playwright/agent-failure-${name}.png`;
    await page.screenshot({ path }); screenshots.push(path);
  };
  await open('模型失败与恢复');
  await send('FAIL'); await idle('failed');
  await page.getByRole('button', { name: '重试生成', exact: true }).waitFor();
  assert(await page.getByText('执行失败', { exact: true }).isVisible(), '模型鉴权失败可见且提供重试');
  await shot('model');
  const count = (await detail()).messages.filter(m => m.role === 'user').length;
  await page.getByRole('button', { name: '重试生成', exact: true }).click();
  await wait(s => s.messages.filter(m => m.role === 'user').length === count + 1);
  await idle('failed');
  assert((await detail()).messages.filter(m => m.role === 'user').length === count + 1, '持续故障时重试仍失败并保留历史');
  await send('失败后继续正常对话'); await idle('completed');
  assert((await page.locator('.plotloom-chat__turn').last().innerText()).includes('收到：失败后继续正常对话'), '模型失败后同会话可继续成功');
  await shot('recovered');

  await open('模型自动重试成功'); await send('RETRY');
  const recovered = await idle('completed');
  assert(recovered.messages.some(m => m.content.some(b => b.type === 'event' && b.name === 'retrying')), '503 自动重试后成功');
  await page.getByRole('button', { name: '展开执行过程', exact: true }).click();
  await shot('auto-retry');

  await open('模型重试耗尽'); await send('RETRY_FAIL');
  const exhausted = await idle('failed');
  assert(exhausted.messages.filter(m => m.content.some(b => b.type === 'event' && b.name === 'retrying')).length === 2, '重试耗尽结束为失败');
  await shot('exhausted');

  await open('浏览器工具失败');
  await send('WRITE:' + JSON.stringify({ steps: [{ name: 'browser', args: { action: 'navigate', url: 'file:///invalid' } }], finalText: '浏览器操作失败，已结束本轮。' }));
  const tool = await idle('completed');
  assert(tool.messages.some(m => m.role === 'tool' && m.content.some(b => b.type === 'tool' && b.status === 'failed')), '工具失败保留结果，模型仍可结束本轮');
  await page.getByRole('button', { name: '展开执行过程', exact: true }).click();
  await shot('tool');

  await open('重试等待时停止'); await send('RETRY_STOP');
  await wait(s => s.messages.some(m => m.content.some(b => b.type === 'event' && b.name === 'retrying')));
  await page.getByRole('button', { name: '停止', exact: true }).click(); await idle('aborted');
  assert(await page.getByRole('button', { name: '重试生成', exact: true }).isVisible(), '重试等待可停止且可再次重试');
  await shot('stopped');

  await open('记录加载失败与恢复');
  await page.route(url(), route => route.fulfill({ status: 503, json: { error: { code: 'TEST_OFFLINE', message: '测试：聊天记录暂时无法加载。' } } }));
  await page.reload();
  await page.getByRole('button', { name: '重新查询聊天记录', exact: true }).waitFor();
  await shot('load');
  await page.unroute(url());
  await page.getByRole('button', { name: '重新查询聊天记录', exact: true }).click();
  await page.getByRole('textbox', { name: '尽管问...' }).waitFor();
  assert(await page.getByRole('button', { name: '重新查询聊天记录', exact: true }).count() === 0, '加载失败可重新查询恢复');
  return { checks, screenshots, sessionId: id };
}
