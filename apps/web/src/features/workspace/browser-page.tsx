import { BrowserFrame } from '@plotloom/ui/browser-frame';

/** 正式原生浏览器的内容位置；框架阶段只展示真实的未连接状态。 */
export function BrowserPage() {
  return <BrowserFrame connected={false} status="浏览器未连接 · 地址草稿会在标签内保留" />;
}
