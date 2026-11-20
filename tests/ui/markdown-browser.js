// 在已打开组件调试台的 Playwright CLI 会话中执行：run-code --filename tests/ui/markdown-browser.js
async (page) => {
  const passed = [];
  const errors = [];
  // Windows 剪贴板将 LF 规范化为 CRLF，读取比对时统一换行。
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const assert = (value, label) => { if (!value) throw new Error(label); passed.push(label); };
  const frame = page.frameLocator('iframe');
  const markdown = frame.locator('.pl-markdown');
  const select = async state => {
    const previousState = await page.locator('#example-state').inputValue();
    const previousRoot = await markdown.elementHandle();
    await page.locator('#example-state').selectOption(state);
    // 宿主通过消息异步更新 iframe；状态改变会重挂载示例，不能把旧根节点当作已就绪。
    if (previousRoot && previousState !== state) {
      await previousRoot.waitForElementState('hidden');
    }
    await markdown.waitFor();
  };
  const settle = async () => {
    await frame.locator('.pl-md-diagram svg').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(200);
  };
  const fill = async content => {
    await page.getByRole('textbox', { name: '内容', exact: true }).fill(content);
    await page.waitForTimeout(200);
  };
  try {
    await page.getByRole('button', { name: 'MarkdownRenderer 7' }).click();
    await select('default');
    assert(await markdown.locator('h1').count() === 1 && await markdown.locator('table tbody tr').count() === 3, '标题与 GFM 表格渲染');
    assert(await markdown.locator('blockquote').count() === 1 && await markdown.locator('input[type=checkbox]').count() === 2, '引用与任务列表渲染');
    assert(await markdown.locator('.pl-md-inline').textContent() === 'const value = 1', '行内代码保持独立排版');
    assert((await markdown.getByRole('link').first().getAttribute('rel')).includes('noopener'), '外部链接使用隔离关系');

    await select('code');
    await frame.locator('.pl-code-block__line span[style]').first().waitFor();
    assert(await frame.locator('.pl-md-block').count() === 3, '三种语言代码块完整显示');
    assert((await frame.locator('.pl-md-block').last().innerText()).includes('未来自定义语法'), '未知语言保留原文');
    assert(await frame.locator('pre section').count() === 0, '代码块 DOM 无非法嵌套');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const firstSource = await frame.locator('pre code').first().textContent();
    await frame.getByRole('button', { name: '复制代码', exact: true }).first().click();
    await frame.locator('.pl-code-block__copy[data-copied]').first().waitFor();
    assert((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === firstSource, '代码复制得到原始代码');
    assert(!(await frame.locator('.pl-md-block').first().textContent()).includes('已复制'), '复制成功仅图标变色，不出现文案');
    await frame.getByRole('button', { name: '复制代码', exact: true }).first().focus();
    await page.keyboard.press('Enter');
    assert((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === firstSource, '键盘 Enter 可复制代码');

    await select('math');
    await frame.locator('.katex').first().waitFor();
    assert(await frame.locator('.katex').count() === 4 && await frame.locator('.katex-display').count() === 2, '行内、块级、积分、矩阵公式实际渲染');
    assert(await frame.locator('.katex-error').count() === 0, '有效公式无解析错误');
    await fill('正常正文 $\\notAValidCommand{a}$ 后面的文字。');
    assert((await markdown.innerText()).includes('后面的文字'), '错误公式不阻断正文');

    await select('mermaid'); await settle();
    assert(await frame.locator('.pl-md-diagram svg').count() === 2, 'Mermaid 流程图和时序图生成 SVG');
    assert(await frame.getByRole('alert').count() === 0, '有效 Mermaid 无错误提示');
    await frame.getByRole('button', { name: '查看源码', exact: true }).first().click();
    assert((await frame.locator('pre').first().textContent()).includes('flowchart LR'), '图示可切换到原始源码');
    await frame.getByRole('button', { name: '查看图表', exact: true }).click(); await settle();
    assert(await frame.locator('.pl-md-diagram svg').count() === 2, '源码切回图示正常重建');

    await select('charts'); await settle();
    const chart = frame.locator('.pl-md-diagram__canvas--echarts');
    assert(await chart.locator('svg').count() === 3, '柱状图、折线图、饼图全部渲染');
    assert((await chart.first().textContent()).includes('每周创作字数'), '图表保留中文标题与数据');
    // 点击实际 SVG 图例，验证事件确实进入 ECharts，而非只检查静态图像。
    const pie = chart.nth(2);
    const pathsBefore = await pie.locator('svg path').count();
    await pie.locator('svg text').filter({ hasText: /^情节$/ }).last().click();
    await page.waitForTimeout(200);
    assert(await pie.locator('svg path').count() !== pathsBefore, '饼图图例可切换数据展示');
    const firstBar = chart.first().locator('svg path[fill="#64748b"]').first();
    await firstBar.hover();
    await page.waitForTimeout(250);
    assert((await chart.first().textContent()).includes('字数'), '悬停显示图表数值提示');

    const originalWidth = await chart.first().locator('svg').getAttribute('width');
    await page.getByRole('button', { name: '窄屏', exact: true }).click();
    await page.waitForTimeout(250);
    assert(Number(await chart.first().locator('svg').getAttribute('width')) < Number(originalWidth), '窄屏触发图表尺寸重算');
    assert(await markdown.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '窄屏图表不撑破正文宽度');

    await select('errors');
    await frame.getByRole('alert').nth(1).waitFor({ timeout: 15000 });
    assert(await frame.getByRole('alert').count() === 2, '无效 JSON 与 Mermaid 显示独立错误');
    assert((await markdown.innerText()).includes('后面的正文仍然可读'), '图表失败后正文保持可读');
    assert(await markdown.locator('script').count() === 0, '模型 HTML 不变成可执行脚本');
    assert(await markdown.locator('a[href^="javascript:"]').count() === 0, '危险 URL 不成为可点击链接');

    await select('streaming');
    await frame.getByText('正在接收图表…', { exact: true }).first().waitFor({ timeout: 15000 });
    assert(await frame.getByRole('alert').count() === 0, '未完成图表围栏显示接收状态而不报错');
    await frame.getByRole('button', { name: '停止', exact: true }).click();
    const stopped = await markdown.innerText();
    await page.waitForTimeout(250);
    // 停止后图表可能由等待态进入源码错误态，但不得继续追加后续正文。
    assert(!(await markdown.innerText()).includes('生成结束。') && stopped.length > 0, '停止保留已有内容并停止追加');
    await frame.getByRole('button', { name: '重新播放', exact: true }).click();
    await frame.getByText('生成结束。', { exact: true }).waitFor({ timeout: 15000 });
    await frame.locator('.pl-md-diagram__canvas--echarts svg').waitFor();
    assert(await markdown.getAttribute('aria-busy') === 'false', '流式完成恢复非忙碌状态');
    assert(await frame.locator('.pl-md-diagram svg').count() === 2, '流式结束图示与数据图表均可用');
    assert(await frame.getByRole('alert').count() === 0, '完整流式内容无残留错误');

    await fill('替换内容 **新回答**');
    await frame.getByText('新回答', { exact: true }).waitFor();
    assert(await frame.locator('.pl-md-diagram svg').count() === 0, '修改内容后旧图表实例移除');
    assert(errors.length === 0, `浏览器无未捕获异常：${errors.join('; ')}`);
    return { passed: passed.length, assertions: passed };
  } finally { page.off('pageerror', onError); }
}
