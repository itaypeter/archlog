const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (src/index.html + src/app.js)
// Never expose ipcRenderer directly — contextBridge keeps it secure.
contextBridge.exposeInMainWorld('archlog', {
  loadData:     ()         => ipcRenderer.invoke('load-data'),
  saveData:     (data)     => ipcRenderer.invoke('save-data', data),
  openFile:     ()         => ipcRenderer.invoke('open-file'),
  exportBackup: (data)     => ipcRenderer.invoke('export-backup', data),
  getSettings:  ()         => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  analyze:      (prompt)   => ipcRenderer.invoke('analyze', { prompt }),
  // Knowledge base
  openFiles:    ()         => ipcRenderer.invoke('open-files'),
  openFolder:   ()         => ipcRenderer.invoke('open-folder'),
  // Obsidian vault (two-way)
  pickVault:      ()       => ipcRenderer.invoke('pick-vault'),
  readVault:      ()       => ipcRenderer.invoke('read-vault'),
  writeVaultNotes:(notes)  => ipcRenderer.invoke('write-vault-notes', notes),
});
