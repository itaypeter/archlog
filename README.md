# ArchLog — יומן עבודה אדריכלי שוויצרי

פלטפורמה לניהול יומן עבודה, פרויקטים ופורטפוליו לאדריכלים בשוויץ.  
כולל שלבי SIA 102, נורמות SIA, GIS קנטונלי וניתוח קבצים עם AI.

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

---

## פיתוח ב-VS Code

```bash
# הרץ במצב פיתוח (עם DevTools פתוח)
npm run dev
```

### מבנה הפרויקט

```
archlog/
├── main.js          ← Electron: חלון, שמירת קבצים, IPC
├── preload.js       ← גשר מאובטח בין main לrenderer
├── package.json     ← תלויות ו-scripts
└── src/
    ├── index.html   ← מבנה HTML + modals
    ├── styles.css   ← כל העיצוב
    └── app.js       ← לוגיקה: views, data, AI
```

### איפה לערוך מה

| רוצה לשנות | קובץ |
|---|---|
| עיצוב, צבעים, גדלים | `src/styles.css` |
| תוכן תצוגה (views) | `src/app.js` → פונקציות `dashboard()`, `projects()` וכו' |
| טפסים ו-modals | `src/index.html` |
| שמירת קבצים, תיקיות | `main.js` |
| הוספת שלב SIA חדש | `src/app.js` → מערך `PHASES` + `PHASE_PCT` |
| הוספת קנטון GIS | `src/app.js` → פונקציה `gis()` → מערך `CANTONS` |

---

## נתונים

הנתונים נשמרים אוטומטית בקובץ JSON מקומי:

- **Windows:** `%APPDATA%\archlog\archlog-data.json`
- **macOS:** `~/Library/Application Support/archlog/archlog-data.json`
- **Linux:** `~/.config/archlog/archlog-data.json`

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
