const { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, protocol, session, shell, utilityProcess } = require('electron');
const { randomBytes } = require('node:crypto');
const { mkdir } = require('node:fs/promises');
const { join, resolve, sep } = require('node:path');
const { pathToFileURL } = require('node:url');

const host = 'plotloom://app';
const token = randomBytes(32).toString('hex');
const resources = process.resourcesPath;
let backend;
let window;
let closing = false;

// 固定的来源让 localStorage 在重启后仍可读取，服务端口和令牌只留在主进程。
protocol.registerSchemesAsPrivileged([{ scheme: 'plotloom', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

/** 等服务完成监听才加载窗口，退出时先等待正在处理的生成与文件写入。 */
async function openDesktop() {
  const dataDir = join(app.getPath('userData'), 'data');
  await mkdir(dataDir, { recursive: true });
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(PLOTLOOM_|NODE_OPTIONS$|ELECTRON_RUN_AS_NODE$)/i.test(key)) delete env[key];
  }
  const server = utilityProcess.fork(join(resources, 'server', 'src', 'desktop.js'), [
    dataDir, join(resources, 'browser', 'chrome.exe'),
  ], { cwd: dataDir, env: { ...env, PLOTLOOM_DESKTOP_TOKEN: token }, serviceName: 'Plotloom 本地服务' });
  backend = server;
  server.once('exit', () => { backend = undefined; });
  const address = await new Promise((resolveAddress, reject) => {
    const timeout = setTimeout(() => reject(new Error('本地服务启动超时')), 20000);
    server.once('exit', () => { clearTimeout(timeout); reject(new Error('本地服务启动失败')); });
    server.once('message', ({ address }) => { clearTimeout(timeout); resolveAddress(address); });
  });
  server.once('exit', () => {
    if (!closing) showFailure('本地服务已退出，请重新打开 Plotloom。');
  });
  const webRoot = join(resources, 'web');
  protocol.handle('plotloom', request => serveDesktop(request, address, webRoot));
  const canCopy = (contents, permission) => contents === window?.webContents && permission === 'clipboard-sanitized-write';
  session.defaultSession.setPermissionCheckHandler(canCopy);
  session.defaultSession.setPermissionRequestHandler((contents, permission, respond) => respond(canCopy(contents, permission)));
  window = new BrowserWindow({
    width: 1360, height: 900, minWidth: 620, minHeight: 520, autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    roundedCorners: true,
    titleBarOverlay: { height: 36, color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000' },
    icon: join(__dirname, 'plotloom.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: join(__dirname, 'preload.cjs') },
  });
  // 原生窗口按钮与应用共用底色和图标色，悬停和按压由 Electron 绘制。
  ipcMain.on('desktop:titlebar-color', (event, symbolColor, color) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame
      || event.senderFrame?.url.split('#', 1)[0] !== host + '/'
      || ![symbolColor, color].every(value => typeof value === 'string' && /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/.test(value))) return;
    window.setTitleBarOverlay({ color, symbolColor });
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  await window.loadURL(host + '/');
}

/** 同源请求保留状态、响应头和 SSE 流，外部客户端拿不到用于访问后端的令牌。 */
async function serveDesktop(request, address, webRoot) {
  const url = new URL(request.url);
  if (url.host !== 'app') return new Response(null, { status: 404 });
  if (url.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin && origin !== host) return new Response(null, { status: 403 });
    const headers = new Headers(request.headers);
    headers.set('origin', address);
    headers.set('x-plotloom-desktop', token);
    try {
      return await fetch(address + url.pathname + url.search, {
        method: request.method, headers, body: request.body, duplex: 'half', signal: request.signal, redirect: 'error',
      });
    } catch {
      return Response.json({ error: { code: 'DESKTOP_BACKEND_UNAVAILABLE', message: '无法连接 Plotloom 本地服务。' } }, { status: 503 });
    }
  }
  let path;
  try { path = decodeURIComponent(url.pathname); }
  catch { return new Response(null, { status: 400 }); }
  const file = resolve(webRoot, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(webRoot + sep)) return new Response(null, { status: 404 });
  return net.fetch(pathToFileURL(file).href);
}

function showFailure(message) {
  dialog.showErrorBox('Plotloom', message);
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!backend) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    const server = backend;
    const deadline = setTimeout(() => server.kill(), 8000);
    server.once('exit', () => { clearTimeout(deadline); backend = undefined; app.quit(); });
    server.postMessage('shutdown');
  });
  app.whenReady().then(openDesktop).catch(error => showFailure(error.message));
}
