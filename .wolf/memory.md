# Memory — ArchLog

One line per build/edit action. Newest at bottom.

- Initial app: Electron shell (main.js, preload.js) + renderer (index.html, styles.css, app.js); 7 views, projects/logs CRUD (create-only), local JSON persistence, backup export.
- Fixed AI: moved Anthropic call from renderer to main process; added settings store (apiKey/model) + secure `analyze` IPC; added Settings modal + button. Default model claude-sonnet-4-6.
- Added knowledge base: multi-file/folder upload, PDF extraction via pdf-parse, RAG injection into AI prompt; new "מאגר ידע" view.
- Added Obsidian two-way sync: pick vault, import `.md` → KB, export logs → markdown (vault/ArchLog/ with frontmatter).
- Added project number field (manual free-text) on projects.
- Added SIA 102 project advisor: PHASE_DELIVERABLES per phase + advisor modal + AI assessment (done/missing/next) from logs + KB.
- Expanded SIA norms to ~30 curated, grouped by category; green/red office-inventory status from KB + purchase links.
- Made norms editable (add/delete custom norms) + manual "owned" toggle (state.customNorms, state.normOwned).
- Made AI backend pluggable: provider selector (cloud Claude / local Ollama); Ollama via /api/chat + /api/tags model list; shared error text; Settings modal updated.
- Set up .wolf/ (anatomy, cerebrum, memory, buglog).

## Deploy / QA
- Public repo: github.com/itaypeter/archlog. Live UI-only QA build: https://itaypeter.github.io/archlog/ (gh-pages branch, flat src files at root).
- Refresh live build: checkout gh-pages, copy src/{index.html,styles.css,app.js} to root, commit, push, checkout main.
