const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Path to the local data file (saved in user's AppData / Library)
const DATA_FILE     = path.join(app.getPath('userData'), 'archlog-data.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'archlog-settings.json');

const DEFAULT_MODEL = 'claude-sonnet-4-6';

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading settings:', err);
  }
  return { apiKey: '', model: DEFAULT_MODEL, vaultPath: '' };
}

// Extensions whose text we can read directly
const TEXT_EXTS = ['.txt', '.eml', '.md', '.markdown', '.csv', '.json', '.html'];
const MAX_TEXT  = 20000; // cap stored text per document

// Extract readable text from a file. PDF via pdf-parse (lazy, optional).
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      let pdfParse;
      try { pdfParse = require('pdf-parse'); }
      catch { return '(להפעלת קריאת PDF הרץ: npm install)'; }
      const data = await pdfParse(fs.readFileSync(filePath));
      return (data.text || '').substring(0, MAX_TEXT);
    }
    if (TEXT_EXTS.includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT);
    }
    return ''; // binary / unsupported (dwg, dxf, docx…)
  } catch (err) {
    return '(לא ניתן לקרוא תוכן: ' + err.message + ')';
  }
}

// Recursively collect supported files from a folder (used for vault import)
function collectFiles(dir, exts, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, exts, acc);
    else if (exts.includes(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

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
  const content  = await extractText(filePath);
  return { fileName, filePath, content };
});

// ─── IPC: Knowledge base — multi-file upload ─────────────────────────────────
ipcMain.handle('open-files', async () => {
  const result = await dialog.showOpenDialog({
    title: 'בחר מסמכים למאגר הידע',
    filters: [
      { name: 'מסמכים', extensions: ['pdf', 'txt', 'eml', 'md', 'markdown', 'csv', 'docx'] },
      { name: 'כל הקבצים', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || !result.filePaths.length) return [];
  return Promise.all(result.filePaths.map(async filePath => ({
    fileName: path.basename(filePath),
    filePath,
    ext: path.extname(filePath).toLowerCase().replace('.', ''),
    content: await extractText(filePath),
  })));
});

// Pick a folder; ingest all supported documents within it (recursively)
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'בחר תיקייה למאגר הידע',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return [];
  const exts = [...TEXT_EXTS, '.pdf'];
  const files = collectFiles(result.filePaths[0], exts);
  return Promise.all(files.map(async filePath => ({
    fileName: path.basename(filePath),
    filePath,
    ext: path.extname(filePath).toLowerCase().replace('.', ''),
    content: await extractText(filePath),
  })));
});

// ─── IPC: Obsidian vault (two-way) ───────────────────────────────────────────
// Pick the vault folder and persist it in settings
ipcMain.handle('pick-vault', async () => {
  const result = await dialog.showOpenDialog({
    title: 'בחר תיקיית Obsidian Vault',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const vaultPath = result.filePaths[0];
  const current = readSettings();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...current, vaultPath }, null, 2), 'utf-8');
  return vaultPath;
});

// Import: read every markdown note in the vault → knowledge entries
ipcMain.handle('read-vault', async () => {
  const { vaultPath } = readSettings();
  if (!vaultPath || !fs.existsSync(vaultPath)) return { ok: false, error: 'NO_VAULT' };
  try {
    const files = collectFiles(vaultPath, ['.md', '.markdown']);
    const notes = files.map(filePath => ({
      fileName: path.basename(filePath),
      filePath,
      ext: 'md',
      content: fs.readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT),
    }));
    return { ok: true, notes };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Export: write ArchLog journal entries back to the vault as markdown notes
ipcMain.handle('write-vault-notes', async (event, notes) => {
  const { vaultPath } = readSettings();
  if (!vaultPath || !fs.existsSync(vaultPath)) return { ok: false, error: 'NO_VAULT' };
  try {
    const outDir = path.join(vaultPath, 'ArchLog');
    fs.mkdirSync(outDir, { recursive: true });
    for (const note of notes) {
      const safe = String(note.fileName).replace(/[\\/:*?"<>|]/g, '-');
      fs.writeFileSync(path.join(outDir, safe), note.content, 'utf-8');
    }
    return { ok: true, count: notes.length, dir: outDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Settings (API key, model) ─────────────────────────────────────────
// The key never reaches the renderer; only main process uses it for AI calls.
ipcMain.handle('get-settings', () => {
  const s = readSettings();
  // Expose only whether a key exists — not the key itself
  return { hasKey: !!s.apiKey, model: s.model || DEFAULT_MODEL, vaultPath: s.vaultPath || '' };
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    const current = readSettings();
    const next = {
      // keep existing key unless a non-empty new one is provided
      apiKey: (settings.apiKey && settings.apiKey.trim()) || current.apiKey || '',
      model:  settings.model || current.model || DEFAULT_MODEL,
      vaultPath: settings.vaultPath !== undefined ? settings.vaultPath : (current.vaultPath || ''),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    console.error('Error saving settings:', err);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: AI analysis (Anthropic, from main process) ─────────────────────────
ipcMain.handle('analyze', async (event, { prompt }) => {
  const { apiKey, model } = readSettings();
  if (!apiKey) {
    return { ok: false, error: 'NO_API_KEY' };
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, text: data.content?.[0]?.text || '' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
