async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const origin = new URL(page.url()).origin;
  const id = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('chat');
  const url = `${origin}/api/sessions/${id}`;
  const waitIdle = async () => {
    for (let i = 0; i < 100; i++) { if ((await (await page.request.get(url)).json()).status === 'idle') return; await page.waitForTimeout(100); }
    throw new Error('没有结束');
  };
  await page.route(url, route => route.fulfill({ status: 503, json: { error: { code: 'TEST_OFFLINE', message: '验收断网恢复' } } }));
  await page.reload();
  const collapse = page.getByRole('button', { name: '收起工作区', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  await page.getByRole('button', { name: '重新查询聊天记录', exact: true }).waitFor();
  await page.unroute(url);
  await page.getByRole('button', { name: '重新查询聊天记录', exact: true }).click();
  await page.getByRole('textbox', { name: '尽管问...' }).fill('WAIT:refresh');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  for (let i = 0; i < 50; i++) {
    const current = await (await page.request.get(url)).json();
    if (current.messages.some(m => m.streaming)) break;
    await page.waitForTimeout(100);
  }
  await page.reload();
  if (await collapse.isVisible()) await collapse.click();
  await page.getByRole('button', { name: '停止', exact: true }).waitFor();
  await page.getByRole('region', { name: '过程记录', exact: true }).last().getByText('部分回复 WAIT:refresh', { exact: true }).waitFor();
  await page.getByRole('button', { name: '停止', exact: true }).click(); await waitIdle();
  const result = await (await page.request.get(url)).json();
  if (result.messages.findLast(m => m.role === 'user').outcome !== 'aborted') throw new Error('刷新后停止未生效');
  return { checks: ['加载失败重试', '生成中刷新恢复过程', '刷新后停止'] };
}
