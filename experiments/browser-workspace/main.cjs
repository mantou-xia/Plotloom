const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const { join } = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');

app.setPath('userData', process.env.SPIKE_PROFILE);
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('remote-debugging-port', '0');
let window, browser, preview, tab = 'browser';
const shellUrl = pathToFileURL(join(__dirname, 'shell.html')).href;
const notify = data => window?.webContents.send('workspace-state', data);
const state = () => notify({ url: browser.webContents.getURL(), back: browser.webContents.navigationHistory.canGoBack(), forward: browser.webContents.navigationHistory.canGoForward(), tab });

/** 两个真实原生视图切换可见性；浏览器从不因文件预览而重建。 */
function layout() {
  const [width, height] = window.getContentSize();
  const bounds = { x: 320, y: 112, width: Math.max(0, width - 320), height: Math.max(0, height - 112) };
  browser.setBounds(bounds); preview.setBounds(bounds);
  browser.setVisible(tab === 'browser'); preview.setVisible(tab !== 'browser');
}

async function command({ action, value }) {
  if (action === 'tab') {
    if (!['browser', 'markdown', 'image'].includes(value)) throw new Error('Unknown tab');
    if (value !== 'browser') await preview.webContents.loadURL(`${process.env.SPIKE_SITE}/preview/${value}`);
    tab = value;
    layout(); state(); return;
  }
  if (action === 'navigate') {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL');
    await browser.webContents.loadURL(url.href); return;
  }
  if (action === 'back' && browser.webContents.navigationHistory.canGoBack()) browser.webContents.navigationHistory.goBack();
  else if (action === 'forward' && browser.webContents.navigationHistory.canGoForward()) browser.webContents.navigationHistory.goForward();
  else if (action === 'reload') browser.webContents.reload();
  else if (action === 'takeover') { notify({ mode: 'user', status: '已请求停止 Agent，等待正在执行的动作收尾。' }); process.send?.({ event: 'takeover' }); }
}

app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 1280, height: 820, minWidth: 900, minHeight: 600, show: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.setMenuBarVisibility(false);
  browser = new WebContentsView({ webPreferences: { partition: 'persist:spike-browser', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  preview = new WebContentsView({ webPreferences: { partition: 'spike-preview', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  for (const view of [browser, preview]) {
    view.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    view.webContents.session.setPermissionCheckHandler(() => false);
    // 本轮只验证一个浏览器页；弹出页面不创建失去控制的窗口。
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.contentView.addChildView(view);
  }
  browser.webContents.on('did-navigate', state);
  browser.webContents.on('did-navigate-in-page', state);
  browser.webContents.on('did-fail-load', (_event, _code, _description, _url, isMain) => { if (isMain) notify({ status: '网页加载失败，可修改地址后重试。' }); });
  window.on('resize', layout);
  window.on('closed', () => { for (const view of [browser, preview]) if (!view.webContents.isDestroyed()) view.webContents.close(); });
  ipcMain.handle('workspace-command', (event, args) => {
    if (event.sender !== window.webContents || event.senderFrame?.url !== shellUrl) throw new Error('Untrusted sender');
    return command(args);
  });
  await window.loadURL(shellUrl);
  await browser.webContents.loadURL(process.env.SPIKE_SITE);
  // 在连接自动化之前建立预览分区的 renderer target；外部 CDP 不会自动枚举后创建的 Electron 分区。
  await preview.webContents.loadURL(`${process.env.SPIKE_SITE}/preview/markdown`);
  layout(); window.show(); state();
  browser.webContents.debugger.attach('1.3');
  const { targetInfo } = await browser.webContents.debugger.sendCommand('Target.getTargetInfo');
  browser.webContents.debugger.detach();
  process.send?.({ event: 'ready', targetId: targetInfo.targetId, webContentsId: browser.webContents.id });
});

// 仅 Node 验证父进程使用的私有实验协议；不暴露给网页或注册为产品接口。
process.on('message', async message => {
  const { id, action, value } = message;
  try {
    if (action === 'shutdown') { await browser?.webContents.session.cookies.flushStore(); app.quit(); return; }
    if (action === 'status') notify(value);
    else if (action === 'screenshot') {
      // capturePage 只截壳的 webContents，漏掉原生子视图；窗口级截图才能验收用户实际看到的内容。
      const handle = window.getNativeWindowHandle().readBigUInt64LE().toString();
      const quote = text => "'" + text.replaceAll("'", "''") + "'";
      await promisify(execFile)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & ${quote(join(__dirname, 'capture-window.ps1'))} -WindowHandle ${handle} -OutputPath ${quote(value)}`], { windowsHide: true });
    }
    else if (action === 'info') { process.send?.({ id, result: { webContentsId: browser.webContents.id, url: browser.webContents.getURL(), visible: browser.getVisible(), tab } }); return; }
    else await command({ action, value });
    process.send?.({ id, result: true });
  } catch (error) { process.send?.({ id, error: error.message }); }
});
app.on('window-all-closed', () => app.quit());
