import { setTimeout as delay } from 'node:timers/promises';
import { Type } from 'typebox';

/** 验证用工具适配：现有 Pi 负责决策循环，工具只操作指定的同一个 Playwright Page。 */
export function createBrowserTool(page, allowedOrigin, record, status) {
  return {
    name: 'workspace_browser', label: '操作右侧浏览器',
    description: '操作用户眼前的浏览器。先 observe 读取可访问性树。click/fill 优先用 role 和 name 精确定位（textbox/button/link），也可用 CSS selector。scroll 的 dy 单位为像素。screenshot 返回截图。wait 仅用于停止验证。navigate 仅允许测试站点。',
    parameters: Type.Object({
      action: Type.Union(['observe', 'click', 'fill', 'scroll', 'screenshot', 'navigate', 'back', 'forward', 'reload', 'wait'].map(value => Type.Literal(value))),
      selector: Type.Optional(Type.String()), value: Type.Optional(Type.String()), dy: Type.Optional(Type.Number()),
      role: Type.Optional(Type.Union(['textbox', 'button', 'link', 'checkbox'].map(value => Type.Literal(value)))),
      name: Type.Optional(Type.String()),
    }),
    async execute(_id, params, signal) {
      const started = Date.now();
      signal?.throwIfAborted();
      status(`正在执行：${params.action}`);
      // 等待类动作可被立即取消；点击/输入用短超时并在结束后检查取消，接管等待当前动作收尾。
      try {
        if (params.action === 'wait') await delay(30000, undefined, { signal });
        else if (params.action === 'click' || params.action === 'fill') {
          const target = params.role ? page.getByRole(params.role, { name: params.name, exact: true }) : page.locator(params.selector);
          if (params.action === 'click') await target.click({ timeout: 1500 });
          else await target.fill(params.value ?? '', { timeout: 1500 });
        }
        else if (params.action === 'scroll') await page.mouse.wheel(0, params.dy ?? 600);
        else if (params.action === 'navigate') {
          const url = new URL(params.value);
          if (url.origin !== allowedOrigin) throw new Error('实验仅允许本地测试站点');
          await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
        } else if (params.action === 'back') await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
        else if (params.action === 'forward') await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
        else if (params.action === 'reload') await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        signal?.throwIfAborted();
        const text = `URL: ${page.url()}\n${(await page.locator('body').ariaSnapshot()).slice(0, 14000)}`;
        const content = [{ type: 'text', text }];
        if (params.action === 'screenshot') content.push({ type: 'image', mimeType: 'image/png', data: (await page.screenshot()).toString('base64') });
        record.push({ action: params.action, outcome: 'completed', durationMs: Date.now() - started });
        return { content, details: { action: params.action } };
      } catch (error) {
        record.push({ action: params.action, outcome: signal?.aborted ? 'aborted' : 'failed', durationMs: Date.now() - started });
        if (signal?.aborted) throw error;
        // 模型不需要内部堆栈，只需知道动作失败并可重新观察页面。
        throw new Error(`浏览器 ${params.action} 操作失败，请重新 observe 后确认元素和地址。`);
      }
    },
  };
}
