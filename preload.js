const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (src/index.html + src/app.js)
// Never expose ipcRenderer directly — contextBridge keeps it secure.
contextBridge.exposeInMainWorld('archlog', {
  loadData:     ()       => ipcRenderer.invoke('load-data'),
  saveData:     (data)   => ipcRenderer.invoke('save-data', data),
  openFile:     ()       => ipcRenderer.invoke('open-file'),
  exportBackup: (data)   => ipcRenderer.invoke('export-backup', data),
});
