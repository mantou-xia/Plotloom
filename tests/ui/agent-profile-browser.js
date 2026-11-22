// 在真实页面走自然语言消息、确认卡和设置，只有模型响应使用确定性替身。
async page => {
  const origin = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
  const profile = async () => (await page.request.get(origin + '/api/agent-profile')).json();
  await page.setViewportSize({ width: 1280, height: 800 });
  const { projects: [project] } = await (await page.request.get(origin + '/api/projects')).json();
  await page.goto(origin + '/#' + new URLSearchParams({ project: project.path }));
  const composer = page.getByRole('textbox', { name: '尽管问...' });
  const send = async text => { await composer.fill(text); await button('发送').click(); };
  await composer.waitFor();
  assert(await button('设置 Agent 人设').count() === 0, '新聊天页无需首用表单');
  await send('你好，我们先认识一下吧。');
  await page.getByText('你想怎么称呼我？希望我是什么样的性格，怎么跟你协作？', { exact: true }).last().waitFor();
  await page.waitForURL(url => url.hash.includes('chat='));
  await send('叫你小舟。语气温和，给建议前先核对正文版本。');
  const card = page.locator('.pl-question-card');
  const confirm = card.getByRole('radio', { name: /确认保存人设/ });
  await confirm.waitFor();
  assert((await card.getByRole('heading').innerText()).includes('给建议前先核对正文版本。'), '确认卡显示实际写入内容');
  assert((await profile()).setup === 'pending', '确认前没有写入');
  await page.reload();
  await confirm.waitFor();
  await confirm.check();
  await button('发送', card).click();
  await card.waitFor({ state: 'hidden' });
  await page.getByText('全局 Agent 人设已保存。', { exact: true }).last().waitFor();
  assert((await profile()).name === '小舟', 'Agent 确认后落盘');

  await button('设置').click();
  await button('Agent 人设', page.getByRole('navigation', { name: '设置导航' })).click();
  const name = page.getByRole('textbox', { name: 'Agent 名字' });
  const preferences = page.getByRole('textbox', { name: '协作偏好' });
  await name.waitFor();
  assert(await name.inputValue() === '小舟', '设置读回对话落盘的数据');
  assert(await preferences.inputValue() === '给建议前先核对正文版本。', '协作偏好已回显');
  await name.fill('小舟编辑版');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/agent-profile') && response.request().method() === 'PUT');
  await button('保存人设').click();
  assert((await saved).ok() && (await profile()).name === '小舟编辑版', '设置仍可手动修改');
  return { checks: ['Agent 首轮主动提问', '自然语言回复触发确认', '确认前不写入', '刷新恢复确认卡', 'Agent 落盘', '设置回读和修改'] };
}
