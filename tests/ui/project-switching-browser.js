// 在已打开应用的独立 Playwright CLI 会话中执行；仅拦截公开请求，不写入后端数据。
async page => {
  const projects = [
    { id: 'a', name: '项目甲', path: 'D:\\fixture-a', createdAt: '2026-11-19T00:00:00Z' },
    { id: 'b', name: '项目乙', path: 'D:\\fixture-b', createdAt: '2026-11-19T00:00:00Z' },
  ];
  const model = { provider: 'fixture', id: 'stable-model', name: '稳定模型', configured: true,
    reasoning: true, thinkingLevels: ['off','high'], contextWindow: 100000, maxTokens: 1000, input: ['text'] };
  const counts = { models: 0, config: 0 };
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/api/chats', route => route.fulfill({json:{sessions:[]}}));
  await page.route('**/api/projects', route => route.fulfill({json:{projects}}));
  await page.route('**/api/models', route => { counts.models++; return route.fulfill({json:{models:[model]}}); });
  await page.route('**/api/model-config', route => { counts.config++; return route.fulfill({json:{provider:model.provider,model:model.id,configured:true,thinkingLevel:'high'}}); });
  await page.reload();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'项目甲',exact:true}).hover();
  await page.getByRole('button',{name:'在 项目甲 中新建聊天',exact:true}).click();
  await page.getByRole('button',{name:'stable-model 高',exact:true}).waitFor();
  const initialCounts = {...counts};
  const results = [];
  // 不只检查节点身份：每个绘制帧同时检查文字可见性，捕获收起透明度和子控件重建。
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(700);
    await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).fill('草稿-' + width);
    await page.evaluate(() => {
      const host = document.querySelector('.plotloom-task-composer [data-deep-agent-original]');
      window.stableNodes = {
        page: document.querySelector('.plotloom-work-start'),
        heading: document.querySelector('.plotloom-work-start__heading'),
        caption: document.querySelector('.plotloom-work-start__welcome > p:last-child'),
        canvas: document.querySelector('.plotloom-work-start__ocean canvas'),
        trigger: document.querySelector('.plotloom-work-start__project'),
        host, editor: host.shadowRoot.querySelector('textarea'),
        model: [...host.shadowRoot.querySelectorAll('button')].find(button => button.textContent.includes('stable-model')),
      };
    });
    await page.getByRole('button',{name:/^切换项目：/}).click();
    await page.evaluate(() => {
      window.textFrames = [];
      document.addEventListener('click', () => {
        const until = performance.now() + 650;
        const sample = () => {
          const failures = [];
          for (const [name,node] of Object.entries(window.stableNodes)) {
            if (!node?.isConnected) { failures.push(name+':detached'); continue; }
            let element = node;
            while (element) {
              const css = getComputedStyle(element);
              if (Number(css.opacity) < 0.99 || css.visibility === 'hidden' || css.display === 'none') { failures.push(name+':hidden'); break; }
              element = element.parentElement ?? element.getRootNode().host;
            }
          }
          if (!window.stableNodes.model.textContent.includes('stable-model')) failures.push('model:label-reset');
          window.textFrames.push(failures);
          if (performance.now() < until) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },{once:true,capture:true});
    });
    const target = width === 768 ? '项目甲' : '项目乙';
    await page.getByRole('dialog',{name:'切换项目',exact:true}).getByRole('button',{name:target,exact:true}).click();
    await page.waitForTimeout(750);
    const failures = await page.evaluate(() => window.textFrames.flat());
    if (failures.length) throw new Error(JSON.stringify({width,failures}));
    const expectedDraft = width === 1440 ? '' : width === 768 ? '草稿-1440' : '草稿-768';
    if (await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).inputValue() !== expectedDraft) throw new Error('切换项目未恢复本项目草稿');
    results.push({width,frames:await page.evaluate(()=>window.textFrames.length),failures});
  }
  if (counts.models !== initialCounts.models || counts.config !== initialCounts.config) throw new Error('切换重复加载模型');
  await page.setViewportSize({width:1440,height:1000});
  const choose = async name => {
    await page.getByRole('button',{name:/^切换项目：/}).click();
    await page.getByRole('dialog',{name:'切换项目',exact:true}).getByRole('button',{name,exact:true}).click();
  };
  await choose('项目甲');
  const sessions = [], uploads = [];
  let releaseUpload, uploadStarted;
  const uploadGate = new Promise(resolve => {releaseUpload=resolve;});
  const firstUpload = new Promise(resolve => {uploadStarted=resolve;});
  await page.route('**/api/sessions', route => {
    sessions.push(route.request().postDataJSON());
    return route.fulfill({json:{id:'reset-draft-'+sessions.length}});
  });
  await page.route('**/api/sessions/reset-draft-*/attachments', async route => {
    const number = uploads.push(route.request().url());
    if (number === 1) { uploadStarted(); await uploadGate; }
    await route.fulfill({json:{id:'uploaded-'+number,size:100}});
  });
  await page.locator('input[type=file]').setInputFiles('README.md');
  await firstUpload;
  await choose('项目乙');
  await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).fill('新项目草稿');
  const oldResponse = page.waitForResponse('**/reset-draft-1/attachments');
  releaseUpload(); await oldResponse;
  await page.waitForTimeout(150);
  if (await page.getByText('README.md',{exact:true}).count()) throw new Error('旧上传回填到新草稿');
  if (await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).inputValue() !== '新项目草稿') throw new Error('旧上传改变新草稿');
  const newResponse = page.waitForResponse('**/reset-draft-2/attachments');
  await page.locator('input[type=file]').setInputFiles('README.md');
  await newResponse;
  if (sessions.length !== 2 || sessions[0].projectPath !== projects[0].path || sessions[1].projectPath !== projects[1].path) throw new Error('草稿会话归属错误');
  // 配置请求尚未完成时从侧栏切换，旧发送不能提交消息或清空新项目输入。
  let releaseConfig, configStarted, messageRequests = 0;
  const configGate = new Promise(resolve => {releaseConfig=resolve;});
  const firstConfig = new Promise(resolve => {configStarted=resolve;});
  await page.route('**/api/sessions/reset-draft-2/config', async route => {
    configStarted(); await configGate; await route.fulfill({json:{}});
  });
  await page.route('**/api/sessions/*/messages', route => { messageRequests++; return route.fulfill({status:400,json:{error:{message:'测试不发送消息'}}}); });
  await page.getByRole('button',{name:'发送',exact:true}).click();
  await firstConfig;
  await page.getByRole('button',{name:'项目甲',exact:true}).hover();
  await page.getByRole('button',{name:'在 项目甲 中新建聊天',exact:true}).click();
  await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).fill('切换后继续输入');
  const configResponse = page.waitForResponse('**/reset-draft-2/config');
  releaseConfig(); await configResponse; await page.waitForTimeout(200);
  if (messageRequests || await page.getByRole('textbox',{name:'输入消息，/ 调用技能，@ 引用文件'}).inputValue() !== '切换后继续输入') throw new Error('旧发送影响新项目');
  await page.evaluate(result => {window.projectSwitchingResult=result;}, {results,extraModelRequests:0,staleUploadIgnored:true,staleSendIgnored:true});
}
