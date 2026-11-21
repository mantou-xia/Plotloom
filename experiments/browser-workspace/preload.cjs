const { contextBridge, ipcRenderer } = require('electron');

// 只给可信壳暴露明确命令；远程网页没有 preload，也不能获得此桥。
contextBridge.exposeInMainWorld('workspace', {
  command: (action, value) => ipcRenderer.invoke('workspace-command', { action, value }),
  subscribe: listener => {
    const handler = (_event, value) => listener(value);
    ipcRenderer.on('workspace-state', handler);
    return () => ipcRenderer.removeListener('workspace-state', handler);
  },
});
