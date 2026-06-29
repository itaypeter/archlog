const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Path to the local data file (saved in user's AppData / Library)
const DATA_FILE = path.join(app.getPath('userData'), 'archlog-data.json');

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'ArchLog',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('src/index.html');

  // Open DevTools in dev mode: run with `npm run dev`
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Data persistence ─────────────────────────────────────────────────
// Load data from disk
ipcMain.handle('load-data', () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
    return { projects: [], logs: [] }; // default empty state
  } catch (err) {
    console.error('Error loading data:', err);
    return { projects: [], logs: [] };
  }
});

// Save data to disk
ipcMain.handle('save-data', (event, data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    console.error('Error saving data:', err);
    return { ok: false, error: err.message };
  }
});

// Open file picker dialog — returns file path + content
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'בחר קובץ לצירוף',
    filters: [
      { name: 'מסמכים', extensions: ['pdf', 'txt', 'eml', 'dwg', 'dxf', 'docx'] },
      { name: 'כל הקבצים', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);

  // Read text-readable files; skip binary (DWG etc.)
  const textExtensions = ['.txt', '.eml', '.pdf'];
  const ext = path.extname(filePath).toLowerCase();
  let content = '';
  if (textExtensions.includes(ext)) {
    try {
      content = fs.readFileSync(filePath, 'utf-8').substring(0, 3000);
    } catch {
      content = '(לא ניתן לקרוא תוכן)';
    }
  }

  return { fileName, filePath, content };
});

// Export data as JSON backup
ipcMain.handle('export-backup', async (event, data) => {
  const result = await dialog.showSaveDialog({
    title: 'ייצוא גיבוי',
    defaultPath: `archlog-backup-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return { ok: false };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
