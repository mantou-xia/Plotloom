async page => {
  const origin = new URL(page.url()).origin;
  await page.reload();
  const result = page.locator('#result-content');
  async function run(endpoint, body, expected) {
    await page.goto(origin + '/#' + endpoint);
    if (body) await page.getByRole('textbox', { name: '请求体', exact: true }).fill(JSON.stringify(body));
    await page.getByRole('button', { name: '发送请求', exact: true }).click();
    await result.getByText(expected, { exact: false }).first().waitFor();
  }
  await run('agent-profile.get', undefined, 'pending');
  const { projects: [project] } = await (await page.request.get(origin + '/api/projects')).json();
  await run('sessions.create', { projectPath: project.path }, 'idle');
  const id = await page.locator('#session-id').inputValue();
  if (!id) throw new Error('试验台没有填入会话 ID');
  const send = text => run('generation.send', { text }, '以后不再主动进行 Agent 人设引导');
  const skip = 'WRITE:' + JSON.stringify({ steps: [{ name: 'setup_agent_profile', args: { action: 'skip' } }] });
  await send(skip);
  await page.locator('#stop-active').click();
  await page.waitForFunction(() => document.querySelector('#result-state').textContent.includes('已停止'));
  await run('agent-profile.get', undefined, 'pending');
  await send(skip);
  await run('generation.answer-question', { kind: 'option', index: 1 }, 'option');
  await page.waitForFunction(async () => (await (await fetch('/api/agent-profile')).json()).setup === 'skipped');
  await run('agent-profile.update', { action: 'save', name: '试验台人设', style: '先给结论', preferences: '核对参考资料' }, '试验台人设');
  await run('agent-profile.update', { action: 'skip' }, '试验台人设');
  await run('agent-profile.update', { action: 'save', name: '缺字段' }, 'INVALID_REQUEST');
  await run('agent-profile.get', undefined, '试验台人设');
  return { checks: ['读取待引导状态', '对话确认等待', '停止不落盘', '确认跳过', '手动保存', '已有设置下跳过保持配置', '非法请求 400'] };
}
