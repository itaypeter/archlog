// ─── Constants ─────────────────────────────────────────────────────────────
const PHASES = [
  'Strategische Planung', 'Vorstudien', 'Vorprojekt', 'Bauprojekt',
  'Baueingabe', 'Ausschreibung', 'Ausführungsplanung', 'Realisierung', 'Abschluss'
];
// Cumulative % per SIA 102 Leistungstabelle
const PHASE_PCT = [2, 7, 16, 37, 39.5, 57.5, 73.5, 88.5, 100];
const PHASE_CLS = ['ph-0','ph-1','ph-2','ph-3','ph-4','ph-5','ph-6','ph-7','ph-8'];

// Key deliverables (Leistungen) required per SIA 102 phase
const PHASE_DELIVERABLES = [
  // 0 — Strategische Planung
  ['הגדרת צרכים ויעדים (Bedürfnisformulierung)', 'בדיקת היתכנות ראשונית (Machbarkeit)', 'מסגרת תקציב ולוח זמנים ראשונית'],
  // 1 — Vorstudien
  ['ניתוח מגרש ותקנון בנייה (Bau- und Zonenordnung)', 'מחקר מקדים ותכניות עקרון (Studien)', 'אומדן עלויות ראשוני ±25%', 'בדיקת תכנון מול Nutzungsplanung'],
  // 2 — Vorprojekt
  ['תכניות עקרון 1:200 (Vorprojektpläne)', 'קונספט מבני ואנרגטי (SIA 380/1)', 'אומדן עלויות ±15% (eBKP)', 'לוח זמנים מעודכן'],
  // 3 — Bauprojekt
  ['תכניות פרויקט 1:100 (Bauprojektpläne)', 'חישוב שטחים ונפחים (SIA 416)', 'תיאום מהנדסים (קונסטרוקציה, HLKS)', 'Kostenvoranschlag ±10%'],
  // 4 — Baueingabe
  ['תיק בקשת היתר (Baugesuch) לפי דרישות הקנטון', 'תכניות היתר (Eingabepläne)', 'חישובי אנרגיה ומרחקי בנייה', 'הגשה ל-Bauamt וטיפול בהתנגדויות (Einsprachen)'],
  // 5 — Ausschreibung
  ['כתבי כמויות / מכרז לפי NPK', 'Submission והשוואת הצעות קבלנים', 'המלצת זכייה (Vergabeantrag)'],
  // 6 — Ausführungsplanung
  ['תכניות ביצוע 1:50 (Ausführungspläne)', 'תכניות פרטים (Detailpläne)', 'תיאום תכניות מקצוע (Werkpläne)'],
  // 7 — Realisierung
  ['ניהול וביצוע באתר (Bauleitung)', 'בקרת לוח זמנים ועלויות (Kostenkontrolle)', 'פרוטוקולי אתר (Bautagebuch)', 'בקרת איכות וקבלת עבודות'],
  // 8 — Abschluss
  ['מסירה ללקוח (Abnahme)', 'תכניות As-Built (Revisionspläne)', 'חשבון סופי (Schlussabrechnung)', 'תיק תחזוקה ותקופת אחריות'],
];

// ─── State ──────────────────────────────────────────────────────────────────
let state = { projects: [], logs: [], knowledge: [], customNorms: [], normOwned: {} };

// ─── Boot ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  setTodayDate();
  await loadData();
  setupNavigation();
  setupModals();
  setupButtons();
  renderView('dashboard');
});

// ─── Data persistence (via Electron IPC) ─────────────────────────────────────
async function loadData() {
  try {
    const saved = await window.archlog.loadData();
    state = saved || { projects: [], logs: [], knowledge: [] };
    if (!state.knowledge) state.knowledge = [];
    if (!state.customNorms) state.customNorms = [];
    if (!state.normOwned) state.normOwned = {};
  } catch (e) {
    console.warn('Could not load data:', e);
  }
}

async function saveData() {
  try {
    await window.archlog.saveData(state);
  } catch (e) {
    console.warn('Could not save data:', e);
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderView(btn.dataset.view);
    });
  });
}

function setActiveNav(viewName) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });
}

// ─── View Router ─────────────────────────────────────────────────────────────
const VIEW_TITLES = {
  dashboard: 'לוח בקרה', projects: 'פרויקטים', log: 'יומן יומי',
  portfolio: 'פורטפוליו', knowledge: 'מאגר ידע', norms: 'נורמות SIA',
  gis: 'GIS קנטונלי', timeline: 'ציר זמן'
};

function renderView(name) {
  document.getElementById('view-title').textContent = VIEW_TITLES[name] || name;
  const content = document.getElementById('content');
  const views = { dashboard, projects, log, portfolio, knowledge, norms, gis, timeline };
  content.innerHTML = views[name] ? views[name]() : '<p>תצוגה לא נמצאה</p>';
  setActiveNav(name);
  if (name === 'knowledge') updateVaultLabel();
}

async function updateVaultLabel() {
  const el = document.getElementById('kb-vault-path');
  if (!el) return;
  try {
    const s = await window.archlog.getSettings();
    el.textContent = s.vaultPath ? `מחובר: ${s.vaultPath}` : 'לא חובר Vault';
  } catch {
    el.textContent = 'זמין רק באפליקציית Desktop';
  }
}

// ─── Views ───────────────────────────────────────────────────────────────────

function dashboard() {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekLogs = state.logs.filter(l => new Date(l.date) >= weekAgo);
  const totalHours = weekLogs.reduce((s, l) => s + (l.hours || 0), 0);
  const portfolioCount = state.logs.filter(l => l.portfolio).length;

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="label">פרויקטים פעילים</div><div class="value">${state.projects.length}</div></div>
      <div class="stat-card"><div class="label">שעות השבוע</div><div class="value">${totalHours.toFixed(1)}</div><div class="sub">מ-${weekLogs.length} תיעודים</div></div>
      <div class="stat-card"><div class="label">סה"כ תיעודים</div><div class="value">${state.logs.length}</div></div>
      <div class="stat-card"><div class="label">פורטפוליו</div><div class="value">${portfolioCount}</div></div>
    </div>

    <div class="section-title">פרויקטים — שלבי SIA 102</div>
    <div class="card-list">
      ${state.projects.length
        ? state.projects.slice(0,4).map(projectCard).join('')
        : emptyState('ti-building-arch', 'לחץ "פרויקט" בסרגל העליון להוסיף פרויקט ראשון')}
    </div>

    <div class="section-title mt-16">תיעודים אחרונים</div>
    <div class="card-list">
      ${state.logs.length
        ? state.logs.slice(0,4).map(logCard).join('')
        : emptyState('ti-file-text', 'לחץ "תיעוד" להוסיף תיעוד ראשון')}
    </div>
  `;
}

function projects() {
  return `
    <div class="flex-between" style="margin-bottom:12px;">
      <div class="section-title" style="margin:0">כל הפרויקטים (${state.projects.length})</div>
      <button class="btn-primary" onclick="openModal('modal-project')">
        <i class="ti ti-plus"></i> פרויקט חדש
      </button>
    </div>
    <div class="card-list">
      ${state.projects.length ? state.projects.map(projectCard).join('') : emptyState('ti-building', 'אין פרויקטים')}
    </div>
  `;
}

function log() {
  return `
    <div class="flex-between" style="margin-bottom:12px;">
      <div class="section-title" style="margin:0">יומן עבודה (${state.logs.length} רשומות)</div>
    </div>
    <div class="card-list">
      ${state.logs.length ? state.logs.map(logCard).join('') : emptyState('ti-clipboard', 'היומן ריק')}
    </div>
  `;
}

function portfolio() {
  const items = state.logs.filter(l => l.portfolio);
  return `
    <div class="section-title">פורטפוליו — תוכניות ומשימות לדוגמה (${items.length})</div>
    <div class="portfolio-grid">
      ${items.length ? items.map(portfolioCard).join('') : `<div style="grid-column:1/-1">${emptyState('ti-briefcase', 'סמן תיעודים כ"שמור לפורטפוליו"')}</div>`}
    </div>
  `;
}

function knowledge() {
  const docs = state.knowledge || [];
  return `
    <div class="flex-between" style="margin-bottom:6px;">
      <div class="section-title" style="margin:0">מאגר הידע של המשרד (${docs.length})</div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" onclick="uploadFolder()"><i class="ti ti-folder"></i> תיקייה</button>
        <button class="btn-primary" onclick="uploadFiles()"><i class="ti ti-upload"></i> העלה מסמכים</button>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
      העלה נורמות, מנואלים ומסמכי משרד. ה-AI ישתמש בהם כדי לנתח קבצים בצורה מדויקת יותר.
    </p>

    <div class="kb-vault" style="margin-bottom:16px;padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600;">
        <i class="ti ti-brand-obsidian"></i> סנכרון Obsidian Vault
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;" id="kb-vault-path">—</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-ghost-sm" onclick="pickVault()"><i class="ti ti-folder-open"></i> בחר Vault</button>
        <button class="btn-ghost-sm" onclick="importVault()"><i class="ti ti-download"></i> ייבא הערות</button>
        <button class="btn-ghost-sm" onclick="exportToVault()"><i class="ti ti-upload"></i> ייצא יומן ל-Vault</button>
      </div>
    </div>

    <div class="card-list" id="kb-list">
      ${docs.length ? docs.map(knowledgeCard).join('') : emptyState('ti-books', 'המאגר ריק — העלה מסמך ראשון')}
    </div>
  `;
}

// Curated set of the SIA norms most relevant to architects (not the full catalog).
const NORMS = [
  // Ordnungen — LHO
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 102',   title:'Ordnung für Leistungen und Honorare der Architekten', desc:'הנורמה המרכזית — שלבי עבודה ושכר אדריכלים' },
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 103',   title:'Leistungen und Honorare der Bauingenieure', desc:'שלבי עבודה ושכר למהנדסי בניין' },
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 105',   title:'Leistungen und Honorare der Landschaftsarchitekten', desc:'שלבי עבודה ושכר לאדריכלי נוף' },
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 108',   title:'Leistungen und Honorare der Ingenieure Gebäudetechnik', desc:'שכר מהנדסי מערכות (HLKSE)' },
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 112',   title:'Modell Bauplanung — Leistungsmodell', desc:'מודל שלבי התכנון: Vorstudien → Projektierung → Realisierung' },
  { cat:'Ordnungen (LHO) — שלבי עבודה ושכר', num:'SIA 112/1', title:'Nachhaltiges Bauen — Hochbau', desc:'בנייה בת-קיימא בבנייני מגורים ומשרדים' },

  // Bauausführung
  { cat:'ביצוע וחוזים', num:'SIA 118', title:'Allgemeine Bedingungen für Bauarbeiten', desc:'תנאים כלליים לחוזי בנייה — אדריכל, קבלן ובעל הבית' },

  // Tragwerke — Swisscodes
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 260', title:'Grundlagen der Projektierung von Tragwerken', desc:'יסודות תכנון מבנים — בסיס לכל נורמות הקונסטרוקציה' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 261', title:'Einwirkungen auf Tragwerke', desc:'עומסים: קבועים, שימושיים, רוח, שלג, רעידות אדמה' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 262', title:'Betonbau', desc:'תכנון מבנה בטון — הנפוצה ביותר בבנייה שוויצרית' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 263', title:'Stahlbau', desc:'תכנון מבני פלדה' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 264', title:'Stahl-Beton-Verbundbau', desc:'מבנים מורכבים פלדה-בטון' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 265', title:'Holzbau', desc:'תכנון מבני עץ' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 266', title:'Mauerwerk', desc:'תכנון מבני בנייה (לבנים/בלוקים)' },
  { cat:'קונסטרוקציה (Swisscodes 260–267)', num:'SIA 267', title:'Geotechnik', desc:'גיאוטכניקה ויסודות' },

  // Bauphysik / Energie
  { cat:'פיזיקה ואנרגיה', num:'SIA 180',   title:'Wärmeschutz, Feuchteschutz und Raumklima', desc:'בידוד תרמי, הגנה מלחות ואקלים פנים' },
  { cat:'פיזיקה ואנרגיה', num:'SIA 181',   title:'Schallschutz im Hochbau', desc:'בידוד אקוסטי בבניינים' },
  { cat:'פיזיקה ואנרגיה', num:'SIA 380/1', title:'Thermische Energie im Hochbau', desc:'צריכת אנרגיה לחימום — בסיס ל-MuKEn / MINERGIE' },
  { cat:'פיזיקה ואנרגיה', num:'SIA 380/4', title:'Elektrische Energie im Hochbau', desc:'צריכת אנרגיה חשמלית בבניין' },
  { cat:'פיזיקה ואנרגיה', num:'SIA 382/1', title:'Lüftungs- und Klimaanlagen', desc:'מערכות אוורור ומיזוג' },
  { cat:'פיזיקה ואנרגיה', num:'SIA 384/1', title:'Heizungsanlagen in Gebäuden', desc:'מערכות חימום' },

  // Gebäudehülle
  { cat:'מעטפת בניין', num:'SIA 271', title:'Abdichtungen im Hochbau', desc:'איטום בבנייה — גגות, מרתפים, רטוב' },
  { cat:'מעטפת בניין', num:'SIA 279', title:'Wärmedämmstoffe', desc:'חומרי בידוד תרמי' },

  // Flächen / Erhaltung
  { cat:'שטחים ותחזוקה', num:'SIA 416', title:'Flächen und Volumen von Gebäuden', desc:'חישוב שטחים (HNF, NNF, GF) ונפחים (GV)' },
  { cat:'שטחים ותחזוקה', num:'SIA 469', title:'Erhaltung von Bauwerken', desc:'שימור ותחזוקת מבנים קיימים' },

  // Accessibility
  { cat:'נגישות', num:'SIA 500', title:'Hindernisfreie Bauten', desc:'בנייה נגישה לאנשים עם מוגבלויות' },

  // Merkblätter
  { cat:'דפי מידע (Merkblätter)', num:'SIA 2024', title:'Raumnutzungsdaten für Energie- und Gebäudetechnik', desc:'נתוני שימוש בחללים לתכנון אנרגטי' },
  { cat:'דפי מידע (Merkblätter)', num:'SIA 2028', title:'Klimadaten', desc:'נתוני אקלים לתכנון בנייה' },
  { cat:'דפי מידע (Merkblätter)', num:'SIA 2040', title:'SIA-Effizienzpfad Energie', desc:'יעד אנרגיה — חברה של 2000 ואט' },

  // Geodaten
  { cat:'גאו-נתונים', num:'SIA 405', title:'Geodaten zu Leitungsnetzen', desc:'נתוני תשתיות וקווי שירות' },

  // Non-SIA (CRB)
  { cat:'CRB (לא SIA)', num:'BKP / eBKP', title:'Baukostenplan', desc:'תכנון עלויות — eBKP-H לבניינים, eBKP-T לתשתיות', vendor:'crb', match:['bkp','ebkp'] },
  { cat:'CRB (לא SIA)', num:'NPK',        title:'Normpositionen-Katalog', desc:'קטלוג עמדות תקניות לכתיבת מכרזים', vendor:'crb', match:['npk'] },
];

// Does the office already have this norm in its knowledge base?
function officeHasNorm(n) {
  const docs = state.knowledge || [];
  if (!docs.length) return false;
  const tokens = n.match || (() => {
    const lc = n.num.toLowerCase();              // e.g. 'sia 380/1'
    return [lc, lc.replace(/\s+/g, '')];         // ['sia 380/1','sia380/1']
  })();
  return docs.some(d => {
    const hay = ((d.title || '') + ' ' + (d.content || '')).toLowerCase();
    return tokens.some(t => hay.includes(t));
  });
}

// A norm counts as owned if a file matches it OR it was marked manually
function normIsOwned(n) {
  return officeHasNorm(n) || !!(state.normOwned && state.normOwned[n.num]);
}

function normRow(n) {
  const auto   = officeHasNorm(n);
  const manual = !!(state.normOwned && state.normOwned[n.num]);
  const has    = auto || manual;
  const buy = n.buy
    ? n.buy
    : (n.vendor === 'crb' ? 'https://www.crb.ch' : 'https://shop.sia.ch/?s=' + encodeURIComponent(n.num));
  const numAttr = esc(n.num).replace(/'/g, "\\'");

  let status;
  if (auto) {
    status = '<span class="norm-status has"><i class="ti ti-file-check"></i> יש (מקובץ)</span>';
  } else if (manual) {
    status = `<span class="norm-status has"><i class="ti ti-check"></i> יש במשרד</span>
              <button class="norm-toggle" onclick="toggleNormOwned('${numAttr}')">בטל סימון</button>`;
  } else {
    status = `<span class="norm-status missing"><i class="ti ti-x"></i> חסר</span>
              <a class="norm-buy" href="${buy}" target="_blank">לרכישה ↗</a>
              <button class="norm-toggle" onclick="toggleNormOwned('${numAttr}')">סמן כקיים</button>`;
  }

  return `
    <div class="norm-item ${has ? 'norm-has' : 'norm-missing'}">
      <div class="norm-num">${esc(n.num)}</div>
      <div style="flex:1">
        <div class="norm-title">${esc(n.title)}${n.custom ? ' <span class="tag">מותאם</span>' : ''}</div>
        <div class="norm-desc">${esc(n.desc || '')}</div>
      </div>
      <div class="norm-actions">
        ${status}
        ${n.custom ? `<button class="norm-toggle" onclick="deleteCustomNorm(${n.id})"><i class="ti ti-trash"></i> מחק</button>` : ''}
      </div>
    </div>
  `;
}

function norms() {
  const all = [...NORMS, ...(state.customNorms || []).map(c => ({ ...c, custom: true }))];
  const have = all.filter(normIsOwned).length;
  const cats = [];
  const byCat = {};
  for (const n of all) {
    const cat = n.cat || 'מותאם אישית';
    if (!byCat[cat]) { byCat[cat] = []; cats.push(cat); }
    byCat[cat].push(n);
  }
  return `
    <div class="flex-between" style="margin-bottom:6px;">
      <div class="section-title" style="margin:0">נורמות SIA</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="tag">${have}/${all.length} במשרד</span>
        <button class="btn-secondary" onclick="openNormModal()"><i class="ti ti-plus"></i> הוסף נורמה</button>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
      🟢 קיים במאגר הידע (זוהה מקובץ או סומן ידנית) · 🔴 חסר, עם קישור לרכישה.
      ניתן להוסיף נורמות משלך ולסמן ידנית מה קיים במשרד. הקטלוג המלא ב-shop.sia.ch.
    </p>
    ${cats.map(c => `
      <div class="section-title">${esc(c)}</div>
      <div class="norm-list" style="margin-bottom:14px;">
        ${byCat[c].map(normRow).join('')}
      </div>
    `).join('')}
  `;
}

// ─── Norm ownership + custom norms ────────────────────────────────────────────
async function toggleNormOwned(num) {
  if (!state.normOwned) state.normOwned = {};
  if (state.normOwned[num]) delete state.normOwned[num];
  else state.normOwned[num] = true;
  await saveData();
  renderView('norms');
}

function openNormModal() {
  document.getElementById('cn-num').value = '';
  document.getElementById('cn-title').value = '';
  document.getElementById('cn-desc').value = '';
  document.getElementById('cn-cat').value = '';
  document.getElementById('cn-buy').value = '';
  openModal('modal-norm');
}

async function saveCustomNorm() {
  const num = document.getElementById('cn-num').value.trim();
  if (!num) { document.getElementById('cn-num').focus(); return; }
  if (!state.customNorms) state.customNorms = [];
  state.customNorms.push({
    id:    Date.now(),
    num,
    title: document.getElementById('cn-title').value.trim(),
    desc:  document.getElementById('cn-desc').value.trim(),
    cat:   document.getElementById('cn-cat').value.trim() || 'מותאם אישית',
    buy:   document.getElementById('cn-buy').value.trim(),
  });
  await saveData();
  closeModal('modal-norm');
  renderView('norms');
}

async function deleteCustomNorm(id) {
  state.customNorms = (state.customNorms || []).filter(c => c.id !== id);
  await saveData();
  renderView('norms');
}

function gis() {
  const CANTONS = [
    { code:'VD', name:'Vaud', links:[{t:'geo.vd.ch — ASIT VD',u:'https://www.geo.vd.ch'},{t:'cadastre.ch',u:'https://www.cadastre.ch'}] },
    { code:'ZH', name:'Zürich', links:[{t:'maps.zh.ch',u:'https://maps.zh.ch'},{t:'GeoLion',u:'https://geolion.zh.ch'}] },
    { code:'BE', name:'Bern', links:[{t:'Geoportal Bern',u:'https://www.agi.dij.be.ch/de/start/geoportal.html'}] },
    { code:'GE', name:'Genève', links:[{t:'SITG — ge.ch/sitg',u:'https://ge.ch/sitg/'},{t:'Autorisations construire',u:'https://ge.ch/telesguichet/accueil'}] },
    { code:'BS', name:'Basel-Stadt', links:[{t:'map.geo.bs.ch',u:'https://map.geo.bs.ch'}] },
    { code:'AG', name:'Aargau', links:[{t:'Geoportal AG',u:'https://www.ag.ch/de/verwaltung/dfr/geoinformation/geoportal'}] },
    { code:'TI', name:'Ticino', links:[{t:'ARGIS Ticino',u:'https://www4.ti.ch/dt/sg/sai/argis/home/'}] },
    { code:'FR', name:'Fribourg', links:[{t:'map.geo.fr.ch',u:'https://map.geo.fr.ch'}] },
    { code:'SG', name:'St. Gallen', links:[{t:'GIS-Browser SG',u:'https://www.geoportal.ch/ksgis'}] },
    { code:'VS', name:'Valais', links:[{t:'Portail cartographique VS',u:'https://www.vs.ch/web/sde/portail-cartographique'}] },
    { code:'LU', name:'Luzern', links:[{t:'geo.lu.ch',u:'https://www.geo.lu.ch/map/grundbuchplan'}] },
    { code:'GR', name:'Graubünden', links:[{t:'geoportal.gr.ch',u:'https://www.geoportal.gr.ch'}] },
  ];
  return `
    <div class="section-title">Geoportal פדרלי</div>
    <div style="margin-bottom:14px;padding:10px 13px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);">
      <a class="gis-link" href="https://map.geo.admin.ch" target="_blank">
        <i class="ti ti-world"></i> map.geo.admin.ch — Geoportal שוויצרי לאומי ↗
      </a>
      <a class="gis-link" href="https://www.geocat.ch" target="_blank" style="margin-top:4px;">
        <i class="ti ti-database"></i> geocat.ch — קטלוג גיאו-נתונים ↗
      </a>
      <a class="gis-link" href="https://www.cadastre.ch" target="_blank" style="margin-top:4px;">
        <i class="ti ti-home"></i> cadastre.ch — רישום קרקעות ↗
      </a>
      <a class="gis-link" href="https://www.are.admin.ch" target="_blank" style="margin-top:4px;">
        <i class="ti ti-building-community"></i> ARE — תכנון מרחבי פדרלי ↗
      </a>
    </div>
    <div class="section-title">GIS קנטונלי</div>
    <div class="gis-grid">
      ${CANTONS.map(c => `
        <div class="gis-card">
          <div class="gis-card-header">
            <div class="gis-flag">${c.code}</div>
            <div class="gis-name">${c.name}</div>
          </div>
          <div class="gis-links">
            ${c.links.map(l => `<a class="gis-link" href="${l.u}" target="_blank"><i class="ti ti-map-2"></i> ${l.t} ↗</a>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function timeline() {
  if (!state.logs.length) return emptyState('ti-timeline', 'הוסף תיעודים לבנות את ציר הזמן');
  return `
    <div class="section-title">ציר זמן כרונולוגי</div>
    <div class="timeline">
      ${state.logs.map(l => `
        <div class="tl-item">
          <div class="tl-dot">${l.phase}</div>
          <div class="tl-body">
            <div class="tl-date">
              ${formatDate(l.date)} · ${l.projectName || '—'} · ${PHASES[l.phase]}
              ${l.hours ? ` · ${l.hours}ש'` : ''}
              ${l.norm ? ` · <span class="tag">${l.norm}</span>` : ''}
            </div>
            <div class="tl-title">${esc(l.desc.substring(0,80))}${l.desc.length>80?'...':''}</div>
            ${l.learnings ? `<div class="tl-sub">📚 ${esc(l.learnings.substring(0,100))}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Card Templates ──────────────────────────────────────────────────────────
function projectCard(p) {
  const pct = PHASE_PCT[Math.min(p.phase, 8)];
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${p.number ? `<span class="tag">${esc(p.number)}</span> ` : ''}${esc(p.name)}</div>
          <div class="card-meta">
            <span>${esc(p.canton)}</span>
            <span>${esc(p.type)}</span>
            ${p.start ? `<span>התחיל: ${formatDate(p.start)}</span>` : ''}
          </div>
        </div>
        <span class="phase-badge ${PHASE_CLS[p.phase]}">Ph.${p.phase}: ${PHASES[p.phase]}</span>
      </div>
      ${p.desc ? `<div class="card-body">${esc(p.desc.substring(0,100))}${p.desc.length>100?'...':''}</div>` : ''}
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="flex-between">
          <div class="progress-label">${pct.toFixed(0)}% מהפרויקט (לפי SIA 102)</div>
          <button class="btn-ghost-sm" onclick="openAdvisor(${p.id})"><i class="ti ti-sparkles"></i> יועץ פרויקט</button>
        </div>
      </div>
    </div>
  `;
}

function logCard(l) {
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${esc(l.desc.substring(0,70))}${l.desc.length>70?'...':''}</div>
          <div class="card-meta">
            <span>${esc(l.projectName || '—')}</span>
            ${l.hours ? `<span><i class="ti ti-clock" style="font-size:12px"></i> ${l.hours}ש'</span>` : ''}
            ${l.norm ? `<span class="tag">${esc(l.norm)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="phase-badge ${PHASE_CLS[l.phase]}">Ph.${l.phase}</span>
          ${l.portfolio ? `<span class="tag">פורטפוליו</span>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <span style="font-size:11px;color:var(--text-muted)">${formatDate(l.date)}</span>
        ${l.fileName ? `<span style="font-size:11px;color:var(--text-muted)"><i class="ti ti-paperclip" style="font-size:12px"></i> ${esc(l.fileName)}</span>` : ''}
      </div>
    </div>
  `;
}

function portfolioCard(l) {
  return `
    <div class="portfolio-card">
      <div class="portfolio-card-title">${esc(l.desc.substring(0,80))}${l.desc.length>80?'...':''}</div>
      <div class="portfolio-card-meta">
        <span class="phase-badge ${PHASE_CLS[l.phase]}">Ph.${l.phase}: ${PHASES[l.phase]}</span>
        ${l.hours ? `<span class="tag">${l.hours}ש'</span>` : ''}
        <span style="font-size:11px;color:var(--text-muted)">${formatDate(l.date)}</span>
      </div>
      ${l.projectName ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${esc(l.projectName)}</div>` : ''}
      ${l.learnings ? `
        <div class="portfolio-card-learnings">
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">מה למדתי</div>
          ${esc(l.learnings)}
        </div>` : ''}
    </div>
  `;
}

function knowledgeCard(d) {
  const chars = (d.content || '').length;
  const srcLabel = d.source === 'vault' ? 'Obsidian' : d.source === 'folder' ? 'תיקייה' : 'הועלה';
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${esc(d.title)}</div>
          <div class="card-meta">
            <span class="tag">${esc((d.ext || '').toUpperCase() || 'DOC')}</span>
            <span>${srcLabel}</span>
            <span>${chars.toLocaleString()} תווים</span>
            ${chars === 0 ? '<span style="color:var(--text-muted)">(ללא טקסט קריא)</span>' : ''}
          </div>
        </div>
        <button class="btn-ghost-sm" onclick="removeKnowledge(${d.id})"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><i class="ti ${icon}"></i><p>${text}</p></div>`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function setupModals() {
  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  // Click outside
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById(id).setAttribute('aria-hidden', 'true');
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
function setupButtons() {
  // Nav shortcut buttons
  document.getElementById('btn-new-project').addEventListener('click', () => {
    resetProjectModal();
    openModal('modal-project');
  });
  document.getElementById('btn-new-log').addEventListener('click', () => {
    resetLogModal();
    openModal('modal-log');
  });

  // Save project
  document.getElementById('btn-save-project').addEventListener('click', saveProject);

  // Save log
  document.getElementById('btn-save-log').addEventListener('click', saveLog);

  // File attach
  document.getElementById('file-drop-zone').addEventListener('click', attachFile);

  // Export backup
  document.getElementById('btn-export').addEventListener('click', async () => {
    await window.archlog.exportBackup(state);
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // Project advisor
  document.getElementById('btn-run-advisor').addEventListener('click', runProjectAdvisor);

  // Custom norm
  document.getElementById('btn-save-norm').addEventListener('click', saveCustomNorm);
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────
function resetProjectModal() {
  document.getElementById('proj-number').value = '';
  document.getElementById('proj-name').value = '';
  document.getElementById('proj-desc').value = '';
  document.getElementById('proj-start').value = todayISO();
  document.getElementById('proj-phase').value = '0';
}

async function saveProject() {
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { document.getElementById('proj-name').focus(); return; }

  state.projects.unshift({
    id: Date.now(),
    number:  document.getElementById('proj-number').value.trim(),
    name,
    canton:  document.getElementById('proj-canton').value,
    phase:   parseInt(document.getElementById('proj-phase').value),
    type:    document.getElementById('proj-type').value,
    desc:    document.getElementById('proj-desc').value.trim(),
    start:   document.getElementById('proj-start').value,
  });

  await saveData();
  closeModal('modal-project');
  renderView('projects');
}

// ─── Log CRUD ─────────────────────────────────────────────────────────────────
function resetLogModal() {
  document.getElementById('log-project').innerHTML = state.projects.length
    ? state.projects.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')
    : '<option>— הוסף פרויקט תחילה —</option>';
  document.getElementById('log-date').value = todayISO();
  document.getElementById('log-desc').value = '';
  document.getElementById('log-hours').value = '';
  document.getElementById('log-learnings').value = '';
  document.getElementById('log-norm').value = '';
  document.getElementById('log-portfolio').checked = false;
  document.getElementById('log-file-name').textContent = '';
  document.getElementById('log-ai-box').style.display = 'none';
  window._attachedFile = null;
}

async function saveLog() {
  const desc = document.getElementById('log-desc').value.trim();
  if (!desc) { document.getElementById('log-desc').focus(); return; }

  const projIdx = parseInt(document.getElementById('log-project').value);
  const proj = state.projects[projIdx];

  state.logs.unshift({
    id:          Date.now(),
    projectIdx:  isNaN(projIdx) ? -1 : projIdx,
    projectName: proj?.name || '—',
    phase:       parseInt(document.getElementById('log-phase').value),
    desc,
    date:        document.getElementById('log-date').value,
    hours:       parseFloat(document.getElementById('log-hours').value) || 0,
    norm:        document.getElementById('log-norm').value,
    learnings:   document.getElementById('log-learnings').value.trim(),
    portfolio:   document.getElementById('log-portfolio').checked,
    fileName:    window._attachedFile?.fileName || '',
    filePath:    window._attachedFile?.filePath || '',
  });

  await saveData();
  closeModal('modal-log');
  renderView('log');
}

// ─── File Attachment + AI Analysis ───────────────────────────────────────────
async function attachFile() {
  const result = await window.archlog.openFile();
  if (!result) return;

  window._attachedFile = result;
  document.getElementById('log-file-name').textContent = result.fileName;

  if (result.content) {
    runAIAnalysis(result.content);
  }
}

async function runAIAnalysis(fileContent) {
  const aiBox     = document.getElementById('log-ai-box');
  const aiContent = document.getElementById('log-ai-content');
  const spinner   = document.getElementById('ai-spinner');

  aiBox.style.display = 'block';
  aiContent.textContent = 'מנתח קובץ...';
  spinner.style.display = 'inline-block';

  const phase     = document.getElementById('log-phase').value;
  const phaseName = PHASES[parseInt(phase)];
  const kb        = relevantKnowledge();

  const prompt = `אתה עוזר לאדריכל סטודנט שעובד במשרד בשוויץ. הוא נמצא בשלב "${phaseName}" (SIA 102 Phase ${phase}).
בהתבסס על תוכן הקובץ הבא, ענה בעברית בצורה קצרה:
1. סיכום: מה מכיל הקובץ (2 משפטים)
2. נורמת SIA הרלוונטית
3. תובנה: מה ניתן ללמוד / להשתמש בו
${kb ? `\nהסתמך גם על מאגר הידע של המשרד (נורמות ומנואלים שהועלו):\n${kb}` : ''}
תוכן הקובץ:
${fileContent.substring(0, 2500)}`;

  try {
    const result = await window.archlog.analyze(prompt);
    if (!result.ok) {
      if (result.error === 'NO_API_KEY') {
        aiContent.innerHTML = 'לא הוגדר מפתח API. <a href="#" id="ai-open-settings">פתח הגדרות</a> כדי להזין מפתח Anthropic.';
        document.getElementById('ai-open-settings')?.addEventListener('click', e => {
          e.preventDefault();
          openSettings();
        });
      } else {
        aiContent.textContent = 'שגיאה בניתוח: ' + result.error;
      }
      return;
    }

    const text = result.text || 'לא ניתן לנתח.';
    aiContent.textContent = text;

    // Auto-fill desc if empty
    if (!document.getElementById('log-desc').value) {
      const firstLine = text.split('\n').find(l => l.trim());
      if (firstLine) {
        document.getElementById('log-desc').value = firstLine.replace(/^[0-9.\-\*]+\s*/,'').replace(/\*\*/g,'');
      }
    }
  } catch (err) {
    aiContent.textContent = 'שגיאה בחיבור ל-AI: ' + err.message;
  } finally {
    spinner.style.display = 'none';
  }
}

// ─── Settings (API key) ───────────────────────────────────────────────────────
async function openSettings() {
  try {
    const s = await window.archlog.getSettings();
    document.getElementById('set-key-status').textContent = s.hasKey
      ? '✓ מפתח שמור (הזן חדש כדי להחליף)'
      : 'לא הוגדר מפתח';
    document.getElementById('set-api-key').value = '';
    document.getElementById('set-model').value = s.model || 'claude-sonnet-4-6';
  } catch { /* not running under Electron */ }
  openModal('modal-settings');
}

async function saveSettings() {
  await window.archlog.saveSettings({
    apiKey: document.getElementById('set-api-key').value.trim(),
    model:  document.getElementById('set-model').value,
  });
  closeModal('modal-settings');
}

// ─── Knowledge base ─────────────────────────────────────────────────────────
function addDocs(files, source) {
  for (const f of files) {
    state.knowledge.unshift({
      id:      Date.now() + Math.floor(Math.random() * 1000),
      title:   f.fileName,
      ext:     f.ext || (f.fileName.split('.').pop() || ''),
      source,
      path:    f.filePath || '',
      content: f.content || '',
      addedAt: todayISO(),
    });
  }
  return files.length;
}

async function uploadFiles() {
  const files = await window.archlog.openFiles();
  if (!files || !files.length) return;
  addDocs(files, 'upload');
  await saveData();
  renderView('knowledge');
}

async function uploadFolder() {
  const files = await window.archlog.openFolder();
  if (!files || !files.length) return;
  addDocs(files, 'folder');
  await saveData();
  renderView('knowledge');
}

async function removeKnowledge(id) {
  state.knowledge = state.knowledge.filter(d => d.id !== id);
  await saveData();
  renderView('knowledge');
}

// ─── Obsidian vault (two-way) ─────────────────────────────────────────────────
async function pickVault() {
  const p = await window.archlog.pickVault();
  if (p) updateVaultLabel();
}

async function importVault() {
  const res = await window.archlog.readVault();
  if (!res.ok) {
    alert(res.error === 'NO_VAULT' ? 'בחר תחילה תיקיית Vault' : 'שגיאה: ' + res.error);
    return;
  }
  const existing = new Set(state.knowledge.map(d => d.path).filter(Boolean));
  const fresh = res.notes.filter(n => !existing.has(n.filePath));
  addDocs(fresh, 'vault');
  await saveData();
  renderView('knowledge');
  alert(`יובאו ${fresh.length} הערות חדשות מ-Vault`);
}

async function exportToVault() {
  if (!state.logs.length) { alert('אין רשומות יומן לייצוא'); return; }
  const notes = state.logs.map(l => ({
    fileName: `${l.date || 'log'}-${(l.projectName || 'log').replace(/\s+/g, '-')}-${l.id}.md`,
    content:  logToMarkdown(l),
  }));
  const res = await window.archlog.writeVaultNotes(notes);
  alert(res.ok
    ? `יוצאו ${res.count} רשומות ל-${res.dir}`
    : (res.error === 'NO_VAULT' ? 'בחר תחילה תיקיית Vault' : 'שגיאה: ' + res.error));
}

function logToMarkdown(l) {
  return `---
date: ${l.date || ''}
project: ${l.projectName || ''}
phase: ${PHASES[l.phase] || ''}
hours: ${l.hours || 0}
norm: ${l.norm || ''}
---

# ${(l.desc || '').split('\n')[0]}

${l.desc || ''}
${l.learnings ? '\n## מה למדתי\n\n' + l.learnings + '\n' : ''}`;
}

// Pick knowledge docs relevant to the current log entry, for the AI prompt
function relevantKnowledge(maxChars = 4000) {
  const docs = (state.knowledge || []).filter(d => d.content && d.content.length > 20);
  if (!docs.length) return '';
  const norm      = document.getElementById('log-norm').value;
  const phaseName = PHASES[parseInt(document.getElementById('log-phase').value)] || '';
  const terms     = [norm, phaseName].filter(Boolean).map(t => t.toLowerCase());
  const scored = docs.map(d => {
    const hay = (d.title + ' ' + d.content).toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { d, score };
  }).sort((a, b) => b.score - a.score);

  let out = '', used = 0;
  for (const { d } of scored.slice(0, 3)) {
    const snippet = d.content.substring(0, 1500);
    if (used + snippet.length > maxChars) break;
    out += `\n--- ${d.title} ---\n${snippet}\n`;
    used += snippet.length;
  }
  return out;
}

// ─── Project advisor ──────────────────────────────────────────────────────────
let advisorId = null;

function projectLogs(p) {
  return state.logs.filter(l => l.projectName === p.name);
}

// Top knowledge-base docs to feed the advisor (no per-norm filter here)
function projectKnowledge(maxChars = 4000) {
  const docs = (state.knowledge || []).filter(d => d.content && d.content.length > 20);
  let out = '', used = 0;
  for (const d of docs.slice(0, 3)) {
    const snippet = d.content.substring(0, 1200);
    if (used + snippet.length > maxChars) break;
    out += `\n--- ${d.title} ---\n${snippet}\n`;
    used += snippet.length;
  }
  return out;
}

function openAdvisor(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  advisorId = id;
  const deliverables = PHASE_DELIVERABLES[p.phase] || [];
  const logs = projectLogs(p);
  document.getElementById('advisor-title').textContent =
    `יועץ פרויקט · ${p.number ? p.number + ' ' : ''}${p.name}`;
  document.getElementById('advisor-body').innerHTML = `
    <div class="card-meta" style="margin-bottom:12px;">
      <span class="phase-badge ${PHASE_CLS[p.phase]}">Ph.${p.phase}: ${PHASES[p.phase]}</span>
      <span>${logs.length} תיעודים</span>
      <span>${esc(p.canton)}</span>
    </div>
    <div class="section-title" style="margin-top:0">דרישות השלב הנוכחי (SIA 102)</div>
    <ul class="advisor-checklist">
      ${deliverables.map(d => `<li><i class="ti ti-square"></i> ${esc(d)}</li>`).join('')}
    </ul>
    <div class="ai-box" id="advisor-ai-box" style="display:none">
      <div class="ai-box-title">
        <i class="ti ti-sparkles"></i> הערכת AI
        <span class="dot-pulse" id="advisor-spinner"></span>
      </div>
      <div class="ai-content" id="advisor-ai-content"></div>
    </div>
  `;
  openModal('modal-advisor');
}

async function runProjectAdvisor() {
  const p = state.projects.find(x => x.id === advisorId);
  if (!p) return;
  const box     = document.getElementById('advisor-ai-box');
  const out     = document.getElementById('advisor-ai-content');
  const spinner = document.getElementById('advisor-spinner');
  box.style.display = 'block';
  out.textContent = 'מנתח את הפרויקט...';
  spinner.style.display = 'inline-block';

  const deliverables = PHASE_DELIVERABLES[p.phase] || [];
  const logs = projectLogs(p);
  const logsText = logs.length
    ? logs.map(l => `- [${l.date}] ${l.desc}${l.learnings ? ' (למדתי: ' + l.learnings + ')' : ''}`).join('\n')
    : '(אין תיעודים עדיין)';
  const kb = projectKnowledge();

  const prompt = `אתה יועץ אדריכלי בכיר שעוזר למשרד בשוויץ לנהל פרויקט לפי SIA 102.

פרויקט: ${p.name}${p.number ? ' (מס׳ ' + p.number + ')' : ''}, קנטון ${p.canton}, סוג ${p.type}.
שלב נוכחי: ${p.phase} — ${PHASES[p.phase]}.

הדרישות (Leistungen) של השלב הנוכחי:
${deliverables.map(d => '- ' + d).join('\n')}

תיעודי העבודה שכבר בוצעו בפרויקט:
${logsText}
${kb ? '\nמאגר הידע של המשרד (נורמות/מנואלים רלוונטיים):\n' + kb : ''}

בהתבסס רק על מה שתועד, ענה בעברית בצורה תמציתית ומעשית:
1. ✅ מה כבר הושלם בשלב הנוכחי
2. ⚠️ מה עדיין חסר כדי לסיים את השלב
3. ➡️ הצעד הבא המומלץ (פעולה אחת קונקרטית)`;

  try {
    const result = await window.archlog.analyze(prompt);
    if (!result.ok) {
      out.innerHTML = result.error === 'NO_API_KEY'
        ? 'לא הוגדר מפתח API. <a href="#" id="adv-open-settings">פתח הגדרות</a>.'
        : 'שגיאה: ' + result.error;
      document.getElementById('adv-open-settings')?.addEventListener('click', e => {
        e.preventDefault(); openSettings();
      });
      return;
    }
    out.textContent = result.text || 'אין תשובה.';
  } catch (err) {
    out.textContent = 'שגיאה בחיבור ל-AI: ' + err.message;
  } finally {
    spinner.style.display = 'none';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function setTodayDate() {
  const el = document.getElementById('today-date');
  if (el) el.textContent = new Date().toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
