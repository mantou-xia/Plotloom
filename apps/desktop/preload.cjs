const { contextBridge, ipcRenderer } = require('electron');

// 窗口按钮走 Electron 原生行为，页面只同步标题栏的主题配色。
contextBridge.exposeInMainWorld('plotloomDesktop', {
  setTitleBarColor: (symbolColor, backgroundColor) => ipcRenderer.send('desktop:titlebar-color', symbolColor, backgroundColor),
});
