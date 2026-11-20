// 真实模型验收：正式页面提交自然语言，只在隔离临时项目内写文件和操作本地测试网页。
async page => {
  const origin = new URL(page.url()).origin;
  const project = new URL(page.url()).searchParams.get('project');
  if (!project) throw new Error('请通过页面 URL 的 project 参数提供隔离验收目录。');
  const created = await (await page.request.post(`${origin}/api/sessions`, { data: { name: '真实模型基础验收', projectPath: project } })).json();
  await page.goto(`${origin}/#chat=${created.id}`); await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const collapse = page.getByRole('button', { name: '收起工作区', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  const text = '请完成这次基础能力验收：先用一句中文解释什么是单栏聊天。然后在当前项目写入 agent-smoke.txt，内容必须为 Plotloom real integration OK。接着使用 browser 工具访问 http://127.0.0.1:4435，读取页面，把表单的验收内容填写为 real-browser-ok 并点击提交。最后读取提交后的页面确认结果，用简短 Markdown 总结文件名、网页地址和页面显示内容。只操作这个项目文件和这个本地测试表单。';
  await page.getByRole('textbox', { name: '尽管问...' }).fill(text);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  return { sessionId: created.id, project, submitted: true };
}
