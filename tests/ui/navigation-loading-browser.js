// 用可控的接口响应验证首次加载、缓存回访与快速切页，避免依赖真实接口的响应速度。
async page => {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const updatedAt = '2026-11-23T00:00:00Z';
  const first = { id: 'loading-a', name: '缓存验收甲', status: 'idle', activity: 'idle', provider: 'mock', model: 'mock', thinkingLevel: 'off' };
  const second = { ...first, id: 'loading-b', name: '缓存验收乙' };
  const skill = { id: 'loading-skill', name: '缓存验收技能', description: '测试后台刷新', source: 'builtin', enabled: true, missingTools: [] };
  const project = Promise.withResolvers();
  const workspaces = Promise.withResolvers();
  const firstHistory = { ...first, messages: [{ id: 'message-a', role: 'user', content: [{ type: 'text', text: '仅甲所有的对话内容' }] }] };
  let skills = Promise.withResolvers();
  let chats = { [first.id]: Promise.withResolvers(), [second.id]: Promise.withResolvers() };
  let modelReads = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
    if (sessionMatch) return route.fulfill({ json: await chats[sessionMatch[1]].promise }).catch(() => {});
    if (path.endsWith('/config')) return route.fulfill({ json: { provider: 'mock', model: 'mock', thinkingLevel: 'off', capabilities: { thinkingLevels: ['off'], input: ['text'] } } });
    if (path.endsWith('/skills') && path !== '/api/skills') return route.fulfill({ json: { skills: [] } });
    switch (path) {
      case '/api/chats': return route.fulfill({ json: { sessions: [first, second].map(session => ({ ...session, updatedAt, pinned: false, archived: false, workspaceId: null })) } });
      case '/api/projects': return route.fulfill({ json: await project.promise });
      case '/api/workspaces': return route.fulfill({ json: await workspaces.promise });
      case '/api/skills': {
        const result = await skills.promise;
        return route.fulfill(result ? { json: { skills: result } } : { status: 500, json: { error: { message: '测试刷新失败' } } }).catch(() => {});
      }
      case '/api/tools': return route.fulfill({ json: { tools: [] } });
      case '/api/models': modelReads++; return route.fulfill({ json: { models: [] } });
      case '/api/model-config': return route.fulfill({ json: { provider: 'mock', model: 'mock', thinkingLevel: 'off' } });
      default: return route.fulfill({ json: {} });
    }
  });
  await page.goto(origin);
  const nav = page.getByRole('navigation', { name: '应用导航' });
  const navButton = name => nav.getByRole('button', { name, exact: true });
  // 只等待一次性的显示动画，呼吸动效会一直循环。
  const waitForPaint = locator => locator.evaluate(node => Promise.all(node.getAnimations()
    .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
    .map(animation => animation.finished)));
  const projectSkeleton = nav.locator('[data-state="loading"] .pl-skeleton').first();
  const recent = navButton('最近');
  await recent.waitFor();
  const before = (await recent.boundingBox()).y;
  await waitForPaint(projectSkeleton);
  assert(await projectSkeleton.evaluate(node => getComputedStyle(node).opacity) === '1', '慢请求应显示侧栏骨架');
  assert((await recent.boundingBox()).y === before, '骨架点亮时不应推挤侧栏分类');
  project.resolve({ projects: [] });
  await nav.getByText('暂无项目', { exact: true }).waitFor();
  assert((await recent.boundingBox()).y === before, '骨架换成空态时不应推挤侧栏分类');
  await page.getByText('在「设置 → 模型服务」配置好模型后，就可以开始对话了。', { exact: true }).waitFor();
  const initialModelReads = modelReads;

  await navButton('小说管理').click();
  const shelfSkeleton = page.locator('.plotloom-shelf-grid .pl-skeleton').first();
  await waitForPaint(shelfSkeleton);
  workspaces.resolve({ workspaces: [] });
  await page.getByText('新建小说并绑定空文件夹，即可开始创作。').waitFor();
  assert(await shelfSkeleton.count() === 0, '小说列表返回时应移除占位');

  await navButton('技能').click();
  const skillSkeleton = page.locator('.plotloom-skills-skeleton .pl-skeleton').first();
  await waitForPaint(skillSkeleton);
  assert(await skillSkeleton.evaluate(node => getComputedStyle(node).opacity) === '1', '首次慢加载应显示技能骨架');
  skills.resolve([skill]);
  await page.getByText(skill.name, { exact: true }).waitFor();
  await navButton('新聊天').click();
  await page.getByText('在「设置 → 模型服务」配置好模型后，就可以开始对话了。', { exact: true }).waitFor();
  assert(modelReads === initialModelReads, '返回新聊天应复用已经读取的模型配置');
  skills = Promise.withResolvers();
  await navButton('技能').click();
  await page.getByText(skill.name, { exact: true }).waitFor();
  assert(await skillSkeleton.count() === 0, '回访技能页应直接显示缓存');
  skills.resolve(null);
  await page.getByText('测试刷新失败', { exact: true }).waitFor();
  assert(await page.getByText(skill.name, { exact: true }).isVisible(), '后台刷新失败时应保留已显示的技能');
  skills = Promise.withResolvers();
  await page.getByRole('button', { name: '刷新技能', exact: true }).click();
  skills.resolve([{ ...skill, name: '已刷新技能' }]);
  await page.getByText('已刷新技能', { exact: true }).waitFor();

  // 先让甲进入缓存，再模拟乙仍在读取时切回甲。乙的迟到响应不得接管页面。
  const openChat = session => nav.getByText(session.name, { exact: true }).click();
  await openChat(first);
  const historySkeleton = page.locator('.plotloom-chat__history-skeleton .pl-skeleton').first();
  await waitForPaint(historySkeleton);
  const reading = page.locator('.plotloom-chat__reading');
  const readingTop = (await reading.boundingBox()).y;
  chats[first.id].resolve(firstHistory);
  const historyText = page.getByText('仅甲所有的对话内容', { exact: true });
  await historyText.waitFor();
  assert((await reading.boundingBox()).y === readingTop, '聊天骨架消失时阅读区顶边应保持原位');
  chats[first.id] = Promise.withResolvers();
  await openChat(second);
  await historySkeleton.waitFor();
  assert(await historyText.count() === 0, '首次打开乙时不能显示甲的缓存');
  await openChat(first);
  await historyText.waitFor();
  assert(await historySkeleton.count() === 0, '切回甲应跳过聊天骨架');
  chats[second.id].resolve({ ...second, messages: [] });
  chats[first.id].resolve(firstHistory);
  await page.getByRole('heading', { name: first.name }).waitFor();
  assert(await page.getByRole('heading', { name: second.name }).count() === 0, '快速切页后不能被乙的迟到响应覆盖');

  await page.evaluate(() => {
    const content = document.querySelector('.plotloom-app-content');
    content.addEventListener('animationend', event => {
      if (event.target.matches('.plotloom-chat__history-skeleton .pl-skeleton')) content.dataset.historySkeletonPainted = 'true';
    });
  });
  await openChat(second);
  await page.getByText('有什么想法，开始聊聊吧。').waitFor();
  assert(await page.locator('.plotloom-app-content').getAttribute('data-history-skeleton-painted') === null, '快速响应不应点亮聊天骨架');
  return { checks: ['侧栏加载与空态位置', '小说首次加载', '技能冷加载与回访', '后台失败与重试', '模型回访缓存', '聊天骨架位置与快速切换', '短请求不点亮占位'] };
}
