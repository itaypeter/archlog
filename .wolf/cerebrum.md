# Cerebrum — ArchLog

Read before generating code. Respect every entry.

## User Preferences
- **Answer in English.** The user finds reading Hebrew hard. (App UI stays Hebrew.)
- No trailing summaries — the user reads the diff.
- Prefer direct action when intent is clear; don't over-ask.
- Commit/push only when explicitly asked.
- No code comments unless the WHY is non-obvious.
- Never ask the user to paste secrets (API keys) into chat — use the in-app settings UI.

## Project Context
- **Goal: sell ArchLog to Swiss architecture offices** as a smart/efficient way to work.
- Chosen topology: **hybrid** — keep local-first Electron client (privacy + Obsidian = differentiators), add a backend later for accounts, AI brokering, billing, and a competitions/Wettbewerbe feed.
- "Runs locally OR in the cloud, your choice" is positioned as a **privacy feature** for Swiss/nFADP offices, not just cost savings.

## Key Learnings
- **AI is provider-pluggable**: one `analyze(prompt) → {ok,text}` contract in `main.js`; backends = Anthropic cloud (default, Sonnet 4.6) and local **Ollama** (`/api/chat`). Add new providers behind the same contract.
- AI must run in the **main process**, never the renderer (renderer fetch to Anthropic has no key/headers + CORS). Key never exposed to renderer.
- An **Obsidian vault is just a folder of `.md`** — no Obsidian install needed; ArchLog reads/writes the folder directly.
- **Prompt caching** is the cloud-AI margin lever: each office's knowledge base is a stable prefix → cache it (reads ~0.1× input price). Relevant for the future backend.
- Current Anthropic pricing (per 1M in/out): Sonnet 4.6 $3/$15 (default), Haiku 4.5 $1/$5, Opus 4.8 $5/$25. `inference_geo: "eu"` available for Swiss/EU data residency.
- Project numbers = manual free-text (e.g. `26-045`); Obsidian sync = full two-way (manual, button-driven).
- Competitions feed sources: simap.ch (official), konkurado, espazium/WBW; SIA 142/143 are the competition norms.
- GitHub user is **itaypeter** (not "itaipeter").

## Do-Not-Repeat
- Don't read a file UTF-8 and call it "PDF support" — PDFs are binary; use `pdf-parse` (already wired in `extractText`).
- Don't create/push a public GitHub repo without asking (done once with permission).
- Don't reference Ollama/KB/vault working in the **browser** build — those need the desktop app; browser is UI-only.
- Don't lose the manual gh-pages sync step after changing `src/` (copy 3 files to gh-pages root, commit, push).
- AI-billing model is still **undecided** — don't assume one; it's gated on the Ollama-vs-Claude quality test.
