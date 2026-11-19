/* 在组件调试台页面执行，检查材质公开参数、真实背景更新及切换清理。 */
(async () => {
  const results = [];
  const wait = () => new Promise(resolve => setTimeout(resolve, 150));
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const doc = () => document.querySelector('iframe').contentDocument;
  const card = () => doc().querySelector('.plotloom-card');
  const css = () => doc().defaultView.getComputedStyle(card());
  const select = async (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
  };
  const input = async (label, value) => {
    const element = Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === label).querySelector('input');
    element.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.blur();
    await wait();
  };
  Array.from(document.querySelectorAll('nav button')).find(el => /^Card\s*\d/.test(el.textContent)).click();
  await wait();
  assert(css().backgroundColor === 'rgb(255, 255, 255)' && css().borderRadius === '8px' && css().padding === '12px', '默认普通材质保持白底、8px 圆角、12px 内边距');
  assert(css().backdropFilter === 'none' && !card().querySelector('svg'), '普通材质不挂载光学资源');
  await select(document.querySelector('#example-state'), 'liquid-glass');
  const material = Array.from(document.querySelectorAll('label')).find(el => el.textContent.startsWith('材质')).querySelector('select');
  const chromium = /Chrom(e|ium)\/|Edg\//.test(navigator.userAgent);
  assert(chromium ? css().backdropFilter.includes('url(') : css().backdropFilter.includes('blur(8px)'), '材质按浏览器启用折射或模糊降级');
  if (chromium) assert(card().querySelector('filter').getAttribute('width') === '360', '折射图与卡片初始尺寸一致');
  assert(doc().defaultView.getComputedStyle(card().querySelector('strong')).filter === 'none', '前景内容没有被滤镜扭曲');
  const beforeMap = card().querySelector('feImage').getAttribute('href');
  const beforePosition = doc().querySelector('.pl-card-backdrop').style.transform;
  const button = card().querySelector('button');
  const rect = button.getBoundingClientRect();
  assert(button.contains(doc().elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), '玻璃层不拦截前景指针');
  button.click(); await wait();
  assert(doc().querySelector('.pl-card-backdrop').style.transform !== beforePosition, '前景点击更新真实背景内容');
  assert(card().querySelector('feImage').getAttribute('href') === beforeMap, '背景移动无需重建光学贴图');
  const border = Array.from(document.querySelectorAll('label')).find(el => el.textContent.includes('显示边框线')).querySelector('input');
  border.click(); await wait();
  // 浏览器缩放可能把 1px 边框量化为小数像素，同时检查声明值与实际可见边框。
  assert(card().style.border.startsWith('1px solid') && parseFloat(css().borderTopWidth) > 0 && css().boxShadow === 'none', '液态玻璃开启边框时不叠加阴影');
  border.click(); await wait();
  assert(css().borderTopWidth === '0px' && css().boxShadow !== 'none', '无边框液态玻璃显示材质高光');
  await input('圆角（px）', '12');
  if (chromium) assert(card().querySelector('feImage').getAttribute('href') !== beforeMap, '圆角变化重新生成折射图');
  const width = document.querySelector('[aria-label="组件宽度（px）"]');
  width.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(width, '240');
  width.dispatchEvent(new Event('input', { bubbles: true }));
  width.blur(); await wait();
  assert(card().offsetWidth === 240, '宽度参数作用于真实 Card');
  if (chromium) assert(card().querySelector('filter').getAttribute('width') === '240', 'ResizeObserver 同步折射图尺寸');
  const sameCard = card();
  await select(material, 'normal');
  assert(card() === sameCard && !card().querySelector('svg') && !card().style.getPropertyValue('--pl-card-filter'), '切换普通材质保留根节点并清理滤镜资源');
  assert(css().backdropFilter === 'none' && css().boxShadow === 'none' && css().backgroundColor === 'rgb(255, 255, 255)', '普通材质无玻璃样式残留');
  await select(material, 'liquid-glass');
  assert(chromium ? css().backdropFilter.includes('url(') : css().backdropFilter.includes('blur(8px)'), '重新启用液态玻璃正常');
  await select(document.querySelector('#example-state'), 'liquid-glass');
  return { passed: results.length, results };
})()
