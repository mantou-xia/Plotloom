import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { webCitation } from './citations.ts';

export const BROWSER_TOOL = 'browser';
const parameters = Type.Object({
  action: Type.Union([Type.Literal('navigate'), Type.Literal('snapshot'), Type.Literal('click'), Type.Literal('fill'), Type.Literal('press'), Type.Literal('scroll'), Type.Literal('back'), Type.Literal('forward'), Type.Literal('reload'), Type.Literal('tabs'), Type.Literal('select_tab'), Type.Literal('close')]),
  url: Type.Optional(Type.String({ description: 'navigate 使用的完整 HTTP(S) URL。' })),
  ref: Type.Optional(Type.String({ description: '最新页面快照中的元素 ref，如 e5。点击、填写、按键优先使用。' })),
  selector: Type.Optional(Type.String({ description: '没有 ref 时可用明确 CSS 选择器；不要猜测，先读取页面。' })),
  text: Type.Optional(Type.String({ description: 'fill 的完整文本。' })),
  key: Type.Optional(Type.String({ description: 'press 的按键，例如 Enter、Tab。' })),
  deltaY: Type.Optional(Type.Number({ minimum: -4000, maximum: 4000, description: 'scroll 的纵向像素，向下为正。' })),
  tab: Type.Optional(Type.Integer({ minimum: 0, description: 'select_tab 的标签页索引，来自 tabs。' })),
}, { additionalProperties: false });
interface BrowserInput { action: string; url?: string; ref?: string; selector?: string; text?: string; key?: string; deltaY?: number; tab?: number }
interface BrowserSession { context: BrowserContext; page: Page }
export interface BrowserOptions { headless?: boolean; channel?: 'chrome' | 'msedge' }

/** 每个聊天独占持久浏览器目录；懒启动避免普通聊天和读取历史时打开窗口。 */
export class SessionBrowsers {
  private readonly sessions = new Map<string, Promise<BrowserSession>>();
  private readonly busy = new Set<string>();
  private readonly dataDir: string;
  private readonly options: BrowserOptions;
  constructor(dataDir: string, options: BrowserOptions = {}) { this.dataDir = dataDir; this.options = options; }

  /** 清理归档聊天独占的浏览器上下文和用户数据。 */
  async remove(id: string) {
    const session = this.sessions.get(id);
    if (session) await (await session).context.close();
    await rm(resolve(this.dataDir, 'browsers', id), { recursive: true, force: true });
  }

  private open(id: string): Promise<BrowserSession> {
    let opening = this.sessions.get(id);
    if (!opening) {
      opening = (async () => {
        const context = await chromium.launchPersistentContext(resolve(this.dataDir, 'browsers', id), {
          channel: this.options.channel ?? (process.platform === 'win32' ? 'msedge' : 'chrome'),
          headless: this.options.headless ?? false, viewport: null, timeout: 20000,
        });
        context.setDefaultTimeout(12000);
        context.setDefaultNavigationTimeout(20000);
        const state = { context, page: context.pages()[0] ?? await context.newPage() };
        context.on('page', page => { state.page = page; });
        context.on('close', () => { if (this.sessions.get(id) === opening) this.sessions.delete(id); });
        return state;
      })();
      this.sessions.set(id, opening);
      void opening.catch(() => { if (this.sessions.get(id) === opening) this.sessions.delete(id); });
    }
    return opening;
  }

  /** 工具定义只引用会话 ID；取消使用 Playwright 的 AbortSignal，不以 Promise.race 遗留后台点击。 */
  tool(id: string) {
    return defineTool<typeof parameters, Record<string, unknown>>({ name: BROWSER_TOOL, label: '浏览器', parameters,
      description: '操作本聊天独立可见浏览器：导航、读取页面快照、点击、填写、按键、滚动和标签页。先读快照再使用 ref。结果含真实 URL、标题和页面文本。',
      execute: async (_callId, input, signal) => {
        if (this.busy.has(id)) return { isError: true, content: [{ type: 'text' as const, text: '当前浏览器操作尚未结束，请依次执行。' }], details: {} };
        this.busy.add(id);
        try {
          signal?.throwIfAborted();
          const result = await this.execute(id, input, signal);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
        } catch (error) {
          if (signal?.aborted) throw error;
          // 不返回 Playwright 原始堆栈或用户目录；失败细节保持可操作，页面内容只在成功快照中返回。
          const message = error instanceof BrowserInputError ? error.message
            : error instanceof Error && error.name === 'TimeoutError' ? '浏览器操作超时；请重新读取页面，检查目标是否存在。'
              : '浏览器操作失败；请确认本机浏览器可用、页面未关闭，然后重新读取页面。';
          return { isError: true, content: [{ type: 'text' as const, text: message }], details: { publicError: message } };
        } finally { this.busy.delete(id); }
      },
    });
  }

  private async execute(id: string, input: BrowserInput, signal?: AbortSignal) {
    if (input.action === 'navigate') {
      let url: URL;
      try { url = new URL(input.url ?? ''); } catch { throw new BrowserInputError('navigate 需要完整 HTTP(S) URL。'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw new BrowserInputError('浏览器只接受 HTTP(S) 页面地址。');
    }
    if (input.action === 'close') {
      const current = this.sessions.get(id);
      if (current) await (await current).context.close();
      return { closed: true };
    }
    const state = await this.open(id);
    signal?.throwIfAborted();
    if (state.page.isClosed()) state.page = state.context.pages()[0] ?? await state.context.newPage();
    if (input.action === 'select_tab') {
      const selected = input.tab === undefined ? undefined : state.context.pages()[input.tab];
      if (!selected) throw new BrowserInputError('标签页不存在，请先调用 tabs。');
      state.page = selected;
    }
    const page = state.page;
    await page.bringToFront();
    const target = () => {
      if (input.ref && /^[a-zA-Z0-9_-]+$/.test(input.ref)) return page.locator(`aria-ref=${input.ref}`);
      if (input.selector) return page.locator(input.selector);
      throw new BrowserInputError('此操作需要最新快照的 ref 或明确的 selector。');
    };
    switch (input.action) {
      case 'navigate': await page.goto(input.url!, { waitUntil: 'domcontentloaded', signal }); break;
      case 'click': await target().click({ signal }); break;
      case 'fill':
        if (input.text === undefined) throw new BrowserInputError('fill 需要 text。');
        await target().fill(input.text, { signal }); break;
      case 'press':
        if (!input.key) throw new BrowserInputError('press 需要 key。');
        await target().press(input.key, { signal }); break;
      case 'scroll':
        signal?.throwIfAborted();
        await page.mouse.wheel(0, input.deltaY ?? 600); break;
      case 'back': await page.goBack({ waitUntil: 'domcontentloaded', signal }); break;
      case 'forward': await page.goForward({ waitUntil: 'domcontentloaded', signal }); break;
      case 'reload': await page.reload({ waitUntil: 'domcontentloaded', signal }); break;
    }
    signal?.throwIfAborted();
    // 点击新窗口后读取真实新标签页，手动操作仍可在同一窗口继续。
    const active = state.page.isClosed() ? page : state.page;
    const snapshot = await active.ariaSnapshot({ mode: 'ai', signal, timeout: 12000 });
    const title = await active.title();
    const url = active.url();
    return { url, title, snapshot: snapshot.slice(0, 24000), truncated: snapshot.length > 24000,
      tabs: state.context.pages().map((tab, index) => ({ index, url: tab.url(), active: tab === active })),
      ...(/^https?:\/\//.test(url) ? { source: webCitation(url, title) } : {}) };
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.sessions.values()].map(async session => (await session).context.close()));
    this.sessions.clear();
  }
}

class BrowserInputError extends Error {}
