# Anatomy — ArchLog

Electron desktop app (Hebrew RTL) for Swiss architects. Read this before opening a file; if the description is enough, don't read the full file.

| File | Description | ~Tokens |
|---|---|---|
| `main.js` | Electron main process. Window creation + IPC handlers: data load/save (JSON in userData), settings (provider/apiKey/model/ollama/vaultPath), **pluggable `analyze()`** (Anthropic cloud OR local Ollama, same `{ok,text}` contract), file/folder pickers, PDF text extraction (`pdf-parse`), Obsidian vault read/write, backup export. | ~3.1K |
| `preload.js` | contextBridge — exposes the safe `window.archlog` API (loadData, saveData, openFile/Files/Folder, get/saveSettings, analyze, ollamaModels, pickVault/readVault/writeVaultNotes, exportBackup). | ~0.3K |
| `src/index.html` | HTML structure: sidebar nav (8 views), topbar, modals (project, log, **settings** with provider toggle, custom-norm, **advisor**). Loads Tabler icons via CDN, `styles.css`, `app.js`. | ~4K |
| `src/styles.css` | All styling. CSS vars for theme (`--accent` etc.). Cards, modals, norm rows (green/red status), advisor checklist. | ~4.8K |
| `src/app.js` | Renderer logic. `PHASES`/`PHASE_PCT`/`PHASE_DELIVERABLES` (SIA 102), `state` ({projects, logs, knowledge, customNorms, normOwned}), view functions, CRUD, AI analysis + RAG, knowledge base + Obsidian sync, norms inventory, project advisor, settings (cloud/Ollama). | ~12.5K |
| `package.json` | deps: `pdf-parse`. devDeps: `electron ^29`. scripts: start, dev. | ~0.1K |
| `README.md` | Hebrew setup/dev docs. | ~0.85K |

## Notable
- `src/{index.html,styles.css,app.js}` are also mirrored (flat) on the `gh-pages` branch for a browser QA build at https://itaypeter.github.io/archlog/ (UI only — no Electron features).
- Data files at runtime: `<userData>/archlog-data.json` and `<userData>/archlog-settings.json`.
