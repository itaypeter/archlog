# ArchLog — יומן עבודה אדריכלי שוויצרי

פלטפורמה לניהול יומן עבודה, פרויקטים ופורטפוליו לאדריכלים בשוויץ.
כולל שלבי SIA 102, נורמות SIA, GIS קנטונלי וניתוח קבצים עם AI.

אפליקציית **Electron** לדסקטופ (Windows / macOS / Linux) — כל הנתונים נשמרים מקומית על המחשב, בלי שרת ובלי חשבון.

---

## מה זה ArchLog?

ArchLog הוא כלי עבודה יומיומי למשרד אדריכלים שוויצרי, שמאחד כמה דברים שבדרך כלל מפוזרים בין Excel, Word ותיקיות:

| תצוגה (View) | מה היא עושה |
|---|---|
| **לוח בקרה** (`dashboard`) | סיכום שבועי — שעות עבודה, פרויקטים פעילים, כניסות שסומנו לפורטפוליו |
| **פרויקטים** (`projects`) | ניהול פרויקטים, עם התקדמות לפי **9 שלבי SIA 102** (Strategische Planung → Abschluss) ואחוזי Leistungstabelle מצטברים לכל שלב |
| **יומן יומי** (`log`) | תיעוד יומי לכל פרויקט: שעות, תיאור, קובץ מצורף (PDF / טקסט / מייל וכו') |
| **פורטפוליו** (`portfolio`) | ליקוט כניסות יומן שסומנו כ"פורטפוליו" לתצוגה מרוכזת |
| **מאגר ידע** (`knowledge`) | ייבוא מסמכים (קבצים בודדים, תיקייה שלמה, או **Obsidian Vault** דו-כיווני) וניתוחם עם AI |
| **נורמות SIA** (`norms`) | רשימת נורמות SIA רלוונטיות, כולל הוספת נורמות מותאמות אישית |
| **GIS קנטונלי** (`gis`) | קישורים ישירים למערכות ה-GIS הרשמיות של כל קנטון שוויצרי |
| **ציר זמן** (`timeline`) | תצוגה כרונולוגית של כל הפעילות בפרויקטים |

### ניתוח AI

תכונת "ניתוח" זמינה בכמה מקומות (מסמכים, יומן) ותומכת בשני backends נבחרים על ידי המשתמש בהגדרות:

- **Anthropic (ענן)** — קריאה ל-`api.anthropic.com` עם מפתח API אישי.
- **Ollama (מקומי)** — קריאה לשרת Ollama שרץ על המחשב (`http://localhost:11434` כברירת מחדל) — בלי לשלוח נתונים לרשת.

מפתח ה-API לעולם לא מגיע ל-renderer — הוא נשמר ונשלח רק מתוך תהליך ה-main (ראו ארכיטקטורה למטה).

---

## ארכיטקטורה (Electron)

ArchLog בנוי לפי מודל התהליכים הרגיל של Electron, עם הפרדה מאובטחת בין main ל-renderer:

```
┌─────────────────┐   IPC (invoke/handle)   ┌──────────────────────┐
│  Renderer        │ ───────────────────────▶│  Main process        │
│  src/index.html  │                          │  main.js              │
│  src/app.js      │◀─────────────────────────│  (Node.js + Electron) │
│  src/styles.css  │      window.archlog      │                       │
└─────────────────┘        (preload.js)       └──────────────────────┘
                                                   │  fs, dialog, fetch
                                                   ▼
                                    ~/.config/archlog/archlog-data.json
                                    ~/.config/archlog/archlog-settings.json
```

### `main.js` — תהליך ה-main

תהליך Node.js מלא, אחראי על כל מה שה-renderer לא יכול (או לא צריך) לגעת בו ישירות:

- **יצירת החלון** — `BrowserWindow` עם `contextIsolation: true` ו-`nodeIntegration: false` (renderer לא ניגש ל-Node.js API-ים ישירות, מטעמי אבטחה).
- **פרסיסטנטיות נתונים** — `load-data` / `save-data` קוראים וכותבים את `archlog-data.json` בתיקיית `userData` של המשתמש.
- **קבצים** — `open-file` / `open-files` / `open-folder` פותחים דיאלוגים מקוריים של המערכת, וממירים כל קובץ לטקסט קריא (`extractText`): טקסט/Markdown/CSV/JSON/HTML נקראים ישירות, PDF דרך `pdf-parse` (טעינה עצלה/אופציונלית).
- **Obsidian Vault (דו-כיווני)** — `pick-vault` בוחר תיקיית Vault ושומר אותה בהגדרות; `read-vault` מייבא את כל קובצי ה-Markdown שבה למאגר הידע; `write-vault-notes` מייצא כניסות יומן חזרה ל-Vault כקבצי Markdown בתיקיית `ArchLog/`.
- **הגדרות** — `get-settings` / `save-settings` שומרים ספק AI, מפתח API, מודל, כתובת Ollama ונתיב ה-Vault ב-`archlog-settings.json`. `get-settings` חושף רק `hasKey` (בוליאני) — לעולם לא את המפתח עצמו.
- **ניתוח AI** — `analyze` מנתב ל-`analyzeAnthropic` או `analyzeOllama` לפי ההגדרה השמורה, ושתי הפונקציות חולקות אותו חוזה (`prompt → { ok, text } | { ok:false, error }`).
- **ייצוא גיבוי** — `export-backup` שומר את כל ה-state כקובץ JSON דרך דיאלוג שמירה.

כל הפעולות האלה חשופות ל-renderer רק דרך ערוצי IPC בשם `ipcMain.handle(...)`, ולא ישירות.

### `preload.js` — הגשר המאובטח

רץ בהקשר מבודד (isolated context) בין main ל-renderer. משתמש ב-`contextBridge.exposeInMainWorld('archlog', {...})` כדי לחשוף רק פונקציות ספציפיות (עטופות סביב `ipcRenderer.invoke`) תחת `window.archlog` — לעולם לא את `ipcRenderer` עצמו ולא Node.js API-ים גולמיים. זה מונע מקוד renderer (או מתוכן זדוני שהוזרק אליו) גישה בלתי מוגבלת למערכת הקבצים או לרשת.

### `src/` — תהליך ה-renderer (UI)

- **`index.html`** — כל מבנה ה-DOM: הסרגל הצדדי, אזור התוכן, וכל ה-modals (יומן, פרויקט, הגדרות, מאגר ידע).
- **`styles.css`** — כל העיצוב, כולל משתני CSS לצבעים (`--accent` וכו').
- **`app.js`** — כל הלוגיקה בצד הלקוח: ניהול `state` (פרויקטים/יומנים/ידע/נורמות) בזיכרון, טעינה/שמירה דרך `window.archlog`, נתב ה-views (`renderView`), ורינדור כל תצוגה כ-HTML string (`dashboard()`, `projects()`, `log()`, `portfolio()`, `knowledge()`, `norms()`, `gis()`, `timeline()`).

renderer זה אינו נוגע ב-Node.js או במערכת הקבצים ישירות — כל פעולה כזו עוברת דרך `window.archlog` ← `preload.js` ← IPC ← `main.js`.

---

## התקנה מהירה (5 דקות)

### דרישות מוקדמות
- [Node.js](https://nodejs.org) — גרסה 18 ומעלה
- [VS Code](https://code.visualstudio.com) — לעריכה (אופציונלי)

### שלבים

```bash
# 1. פתח את התיקייה ב-Terminal
cd archlog

# 2. התקן תלויות (רק פעם ראשונה)
npm install

# 3. הרץ את האפליקציה
npm start
```

זהו — האפליקציה תיפתח כחלון desktop.

> **טיפ:** ניתוח AI דורש הגדרה נוספת (הגדרות → ספק AI). אפשר לבחור Anthropic (מפתח API אישי) או Ollama מקומי — האפליקציה עובדת גם בלי זה, פשוט בלי תכונות הניתוח.

---

## פיתוח ב-VS Code

```bash
# הרץ במצב פיתוח (עם DevTools פתוח)
npm run dev
```

### מבנה הפרויקט

```
archlog/
├── main.js          ← Electron: חלון, שמירת קבצים, IPC, backends AI
├── preload.js       ← גשר מאובטח בין main לrenderer (contextBridge)
├── package.json     ← תלויות ו-scripts
└── src/
    ├── index.html   ← מבנה HTML + modals
    ├── styles.css   ← כל העיצוב
    └── app.js       ← לוגיקה: views, state, קריאות ל-window.archlog
```

### איפה לערוך מה

| רוצה לשנות | קובץ |
|---|---|
| עיצוב, צבעים, גדלים | `src/styles.css` |
| תוכן תצוגה (views) | `src/app.js` → פונקציות `dashboard()`, `projects()` וכו' |
| טפסים ו-modals | `src/index.html` |
| שמירת קבצים, תיקיות, IPC handlers | `main.js` |
| חשיפת API חדש ל-renderer | `preload.js` → `contextBridge.exposeInMainWorld` |
| הוספת שלב SIA חדש | `src/app.js` → מערך `PHASES` + `PHASE_PCT` |
| הוספת קנטון GIS | `src/app.js` → פונקציה `gis()` → מערך `CANTONS` |

---

## נתונים

הנתונים נשמרים אוטומטית בקובץ JSON מקומי:

- **Windows:** `%APPDATA%\archlog\archlog-data.json`
- **macOS:** `~/Library/Application Support/archlog/archlog-data.json`
- **Linux:** `~/.config/archlog/archlog-data.json`

הגדרות (ספק AI, מפתח API, נתיב Vault) נשמרות בנפרד באותה תיקייה, בקובץ `archlog-settings.json`.

לגיבוי: לחץ "ייצוא גיבוי" בתחתית הסרגל הצדדי.

---

## הוספת פיצ'רים — דוגמאות מהירות

### הוספת שדה חדש לתיעוד (למשל: "שם הממונה")

1. ב-`src/index.html` — הוסף שדה בתוך `#modal-log`:
```html
<div class="form-group">
  <label class="form-label">שם הממונה</label>
  <input class="form-input" id="log-supervisor" placeholder="Ing. Müller" />
</div>
```

2. ב-`src/app.js` — הוסף ב-`saveLog()`:
```js
supervisor: document.getElementById('log-supervisor').value.trim(),
```

3. ב-`src/app.js` — הוסף ב-`logCard(l)`:
```js
${l.supervisor ? `<span>${esc(l.supervisor)}</span>` : ''}
```

### שינוי צבע ראשי

ב-`src/styles.css`, שנה את:
```css
--accent:      #7F77DD;   /* צבע ראשי */
--accent-dark: #534AB7;   /* צבע hover */
--accent-light:#EEEDFE;   /* רקע עדין */
```

---

## בניית קובץ להפצה (exe / dmg)

```bash
# התקן electron-builder
npm install --save-dev electron-builder

# הוסף ל-package.json תחת "scripts":
# "build": "electron-builder"

# בנה
npm run build
```

הקובץ המוכן יופיע בתיקיית `dist/`.

---

## רישיון
MIT — חופשי לשימוש ושינוי.
