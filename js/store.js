/* Data model, browser storage (IndexedDB) and file saving to a OneDrive folder */
const SCHEMA_VERSION = 5;
const COLLECTIONS = ['sources', 'themes', 'notes', 'projects', 'tasks', 'deadlines', 'claims', 'milestones', 'writingLogs', 'events', 'timeLogs', 'meetings', 'records', 'cvItems', 'reviews', 'cards'];
/* records.kind: check (ethics/Law 25/DMP checklist), storage (data storage map), course, contract (RA/TA), hours, receipt, document */
const RECEIPT_STATUS = ['notclaimed', 'submitted', 'reimbursed', 'personal'];
const RECEIPT_CATS = ['conference', 'books', 'software', 'travel', 'research', 'equipment', 'fees', 'other'];
const DOC_CATS = ['program', 'ethics', 'funding', 'employment', 'publication', 'immigration', 'relocation', 'other'];
const CV_KINDS = ['education', 'presentation', 'teaching', 'service', 'award', 'funding', 'publication', 'other'];
const PRES_TYPES = ['conference', 'invited', 'workshop', 'outreach', 'poster', 'guest'];
const EVENT_KINDS = ['class', 'meeting', 'deep', 'language', 'family', 'admin', 'other'];
const MEETING_KINDS = ['supervisor', 'committee', 'coauthor', 'team', 'other'];
const DEFAULT_SETTINGS = {
  lang: 'en', theme: 'auto', readingTarget: 5, reviewDay: 5,
  workHours: { 1: 7, 2: 7, 3: 7, 4: 7, 5: 6, 6: 2, 0: 0 },          // hours you are willing to work, by weekday (0 = Sunday)
  energyWindows: { deep: ['09:00', '12:00'], light: ['13:00', '15:30'], admin: ['15:30', '17:00'] },
  gridStart: 7, gridEnd: 22,
  cv: { name: '', title: 'PhD Student, Education', affiliation: 'Concordia University, Montréal, QC', email: '', orcid: '', website: '' },
  newCardsPerDay: 20,
  thesisTitle: '', thesisDesign: '',
};
const MS_STATUS = ['todo', 'doing', 'done'];
const NOTE_KINDS = ['inbox', 'idea', 'decision', 'reflexive', 'feedback', 'note'];
const FEEDBACK_FROM = ['supervisor', 'committee', 'peer', 'reviewer', 'instructor', 'other'];
const CLAIM_TYPES = ['claim', 'assumption', 'rebuttal'];
const STRENGTHS = ['strong', 'moderate', 'weak'];
const SOURCE_TYPES = ['article', 'book', 'chapter', 'report', 'policy', 'news', 'thesis', 'webpage', 'other'];
const PARADIGMS = ['Post-positivist', 'Interpretivist / constructivist', 'Critical / transformative', 'Pragmatist', 'Participatory', 'Not stated'];
const AREAS = ['thesis', 'publication', 'research', 'teaching', 'business', 'language', 'life'];
const STAGES = ['idea', 'planning', 'drafting', 'internal', 'submitted', 'review', 'rr', 'accepted', 'published', 'ongoing'];
const STAGE_PCT = { idea: 5, planning: 15, drafting: 35, internal: 55, submitted: 70, review: 78, rr: 85, accepted: 95, published: 100, ongoing: null };
const DEADLINE_KINDS = ['funding', 'conference', 'cfp', 'program', 'admin', 'other'];
const ENERGY = ['deep', 'light', 'admin'];

/* Fields the AI may draft and that carry an "AI draft" badge until confirmed */
const AI_FIELDS = ['type', 'authors', 'year', 'title', 'container', 'volume', 'issue', 'pages', 'doi', 'url', 'paradigm', 'framework', 'method', 'context', 'sample', 'findings', 'strengths', 'limitations', 'tags', 'quotes'];

function emptyData() {
  return {
    schema: SCHEMA_VERSION, savedAt: null,
    sources: [], themes: [], notes: [], projects: [], tasks: [], deadlines: [], claims: [], milestones: [], writingLogs: [], events: [], timeLogs: [], meetings: [], records: [], cvItems: [], reviews: [], cards: [],
    timer: null,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  };
}
function newSource(over = {}) {
  const now = new Date().toISOString();
  return Object.assign({
    id: uid('s_'), createdAt: now, updatedAt: now,
    type: 'article', authors: [], year: '', issued: '', title: '', container: '', volume: '', issue: '', pages: '', edition: '', editors: [], publisher: '',
    doi: '', url: '', zoteroKey: '', abstract: '',
    priority: 2, targetPass: 2, passDone: 0, passLog: [], dateRead: '',
    projects: [], chapters: [], researchQuestions: [],
    paradigm: '', framework: '', method: '', context: '', sample: '', findings: '',
    quotes: [], strengths: '', limitations: '', use: '',
    tags: [], related: [], themes: {}, aiDrafted: [],
  }, over);
}

function newNote(over = {}) {
  const now = new Date().toISOString();
  const n = Object.assign({
    id: uid('n_'), createdAt: now, updatedAt: now, kind: 'idea', date: String(over.createdAt || now).slice(0, 10), title: '', body: '',
    decision: {}, feedback: {}, projects: [], tags: [], links: [],
  }, over);
  if (over.text != null && !over.body) n.body = over.text; // Stage 1 inbox notes
  delete n.text;
  n.decision = Object.assign({ what: '', why: '', alternatives: '' }, n.decision || {});
  n.feedback = Object.assign({ from: 'supervisor', who: '', response: '' }, n.feedback || {});
  return n;
}
function newClaim(over = {}) {
  const now = new Date().toISOString();
  return Object.assign({ id: uid('c_'), createdAt: now, updatedAt: now, type: 'claim', text: '', parentId: '', order: 0, chapter: '', rq: '', evidence: [], notes: '' }, over);
}

/* ---------- IndexedDB key/value ---------- */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('phd-command-centre', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async del(k) { const db = await this.open(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); }); },
};

const Store = {
  data: emptyData(),
  dir: null,            // FileSystemDirectoryHandle
  dirState: 'none',     // none | granted | prompt | unsupported
  status: 'idle',       // idle | saving | saved | error
  lastFileSave: null,
  lastBrowserSave: null,
  listeners: new Set(),
  fsSupported: typeof window.showDirectoryPicker === 'function',

  async init() {
    try {
      const saved = await IDB.get('data');
      if (saved) this.data = this.migrate(saved);
    } catch (e) { console.warn('IndexedDB unavailable', e); }
    if (!this.fsSupported) { this.dirState = 'unsupported'; return; }
    try {
      this.dir = await IDB.get('dir');
      if (this.dir) {
        const p = await this.dir.queryPermission({ mode: 'readwrite' });
        this.dirState = p === 'granted' ? 'granted' : 'prompt';
        if (this.dirState === 'granted') await this.loadNewerFromFile();
      }
    } catch (e) { console.warn(e); this.dirState = 'none'; }
  },

  migrate(d) {
    const base = emptyData();
    const out = Object.assign(base, d);
    out.settings = Object.assign(emptyData().settings, d.settings || {});
    for (const c of COLLECTIONS) if (!Array.isArray(out[c])) out[c] = [];
    out.sources = out.sources.map(s => newSource(s));
    out.notes = out.notes.map(n => newNote(n));
    out.claims = out.claims.map(c => newClaim(c));
    out.projects = out.projects.map(p => Object.assign({ wordGoal: 0, wordCount: 0, versions: [] }, p));
    out.events = out.events.map(e => Object.assign({ title: '', kind: 'other', date: '', start: '09:00', end: '10:00', allDay: false, recur: 'none', byDays: [], until: '', skip: [], projectId: '', location: '', notes: '', source: 'local' }, e));
    out.meetings = out.meetings.map(m => Object.assign({ date: '', time: '10:00', duration: 60, with: '', kind: 'supervisor', projectId: '', agenda: [], notes: '', decisions: [], actions: [], nextDate: '', update: '' }, m));
    out.cards = out.cards.map(c => Object.assign({ front: '', back: '', deck: 'Comprehensive exam', tags: [], ease: 2.5, interval: 0, reps: 0, lapses: 0, due: todayISO(), from: null, ai: false, lastReview: '' }, c));
    out.projects = out.projects.map(p => Object.assign({ citation: '' }, p));
    for (const k of ['workHours', 'energyWindows', 'cv']) out.settings[k] = Object.assign({}, DEFAULT_SETTINGS[k], (d.settings || {})[k] || {});
    out.milestones = out.milestones.map(m => Object.assign({ projectId: '', title: '', start: '', due: '', status: 'todo', percent: 0, dependsOn: [], notes: '', verify: false }, m));
    out.schema = SCHEMA_VERSION;
    return out;
  },

  /* If the file in OneDrive is newer than the browser copy (e.g. restored backup), use it */
  async loadNewerFromFile() {
    try {
      const fh = await this.dir.getFileHandle('phd-data.json');
      const file = await fh.getFile();
      const fromFile = JSON.parse(await file.text());
      if (fromFile && (!this.data.savedAt || (fromFile.savedAt && fromFile.savedAt > this.data.savedAt))) {
        this.data = this.migrate(fromFile);
        await IDB.set('data', this.data);
        return true;
      }
    } catch (e) { /* no file yet */ }
    return false;
  },

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(kind) { this.listeners.forEach(fn => fn(kind)); },

  /* Call after any mutation */
  change() {
    this.data.savedAt = new Date().toISOString();
    this.status = 'saving'; this.emit('status');
    this._saveBrowser(); this._saveFile();
  },
  _saveBrowser: debounce(async function () {
    try { await IDB.set('data', Store.data); Store.lastBrowserSave = new Date(); if (Store.dirState !== 'granted') { Store.status = 'saved'; Store.emit('status'); } }
    catch (e) { Store.status = 'error'; Store.emit('status'); }
  }, 250),
  _saveFile: debounce(() => Store.writeFile(), 1200),

  async writeFile() {
    if (!this.dir || this.dirState !== 'granted') return;
    try {
      const json = JSON.stringify(this.data, null, 1);
      const fh = await this.dir.getFileHandle('phd-data.json', { create: true });
      const w = await fh.createWritable(); await w.write(json); await w.close();
      // daily backup (overwritten through the day, so it holds that day's last state)
      const bdir = await this.dir.getDirectoryHandle('backups', { create: true });
      const bh = await bdir.getFileHandle(`phd-data-${todayISO()}.json`, { create: true });
      const bw = await bh.createWritable(); await bw.write(json); await bw.close();
      await this.pruneBackups(bdir, 30);
      this.lastFileSave = new Date(); this.status = 'saved';
    } catch (e) {
      console.error(e); this.status = 'error';
      if (e && e.name === 'NotAllowedError') this.dirState = 'prompt';
    }
    this.emit('status');
  },
  async pruneBackups(bdir, keep) {
    const names = [];
    for await (const [name] of bdir.entries()) if (/^phd-data-\d{4}-\d{2}-\d{2}\.json$/.test(name)) names.push(name);
    names.sort();
    for (const n of names.slice(0, Math.max(0, names.length - keep))) await bdir.removeEntry(n);
  },

  async connectFolder() {
    const dir = await window.showDirectoryPicker({ id: 'phd-cc', mode: 'readwrite', startIn: 'documents' });
    this.dir = dir; this.dirState = 'granted';
    await IDB.set('dir', dir);
    const loaded = await this.loadNewerFromFile();
    if (!loaded) await this.writeFile();
    this.emit('data');
    return loaded;
  },
  async reconnect() {
    if (!this.dir) return;
    const p = await this.dir.requestPermission({ mode: 'readwrite' });
    this.dirState = p === 'granted' ? 'granted' : 'prompt';
    if (this.dirState === 'granted') { const loaded = await this.loadNewerFromFile(); if (!loaded) await this.writeFile(); this.emit('data'); }
    this.emit('status');
  },
  async disconnect() { this.dir = null; this.dirState = 'none'; await IDB.del('dir'); this.emit('status'); },

  /* ---------- CRUD helpers ---------- */
  all(coll) { return this.data[coll]; },
  get(coll, id) { return this.data[coll].find(x => x.id === id); },
  add(coll, obj) {
    const now = new Date().toISOString();
    if (!obj.id) obj.id = uid(coll[0] + '_');
    obj.createdAt = obj.createdAt || now; obj.updatedAt = now;
    this.data[coll].push(obj); this.change(); return obj;
  },
  update(coll, id, patch) {
    const o = this.get(coll, id); if (!o) return null;
    Object.assign(o, patch, { updatedAt: new Date().toISOString() }); this.change(); return o;
  },
  remove(coll, id) {
    this.data[coll] = this.data[coll].filter(x => x.id !== id);
    if (coll === 'sources') this.data.sources.forEach(s => { s.related = (s.related || []).filter(r => r !== id); });
    if (coll === 'themes') this.data.sources.forEach(s => { if (s.themes) delete s.themes[id]; });
    if (coll === 'sources' || coll === 'notes') this.data.claims.forEach(c => { c.evidence = (c.evidence || []).filter(e => e.id !== id); });
    if (coll === 'claims') this.data.claims.forEach(c => { if (c.parentId === id) c.parentId = ''; });
    if (coll === 'milestones') { this.data.milestones.forEach(m => { m.dependsOn = (m.dependsOn || []).filter(x => x !== id); }); this.data.tasks.forEach(x => { if (x.milestoneId === id) x.milestoneId = ''; }); }
    if (coll === 'projects') { this.data.milestones = this.data.milestones.filter(m => m.projectId !== id); this.data.writingLogs = this.data.writingLogs.filter(w => w.projectId !== id); }
    this.change();
  },

  exportJSON() { return JSON.stringify(this.data, null, 1); },
  replaceAll(d) { this.data = this.migrate(d); this.change(); this.emit('data'); },
  mergeIn(d) {
    const inc = this.migrate(d); let n = 0;
    for (const c of COLLECTIONS) {
      const have = new Set(this.data[c].map(x => x.id));
      for (const item of inc[c]) if (!have.has(item.id)) { this.data[c].push(item); n++; }
    }
    this.change(); this.emit('data'); return n;
  },
  isEmpty() { return COLLECTIONS.every(c => this.data[c].length === 0); },
  hasSample() { return COLLECTIONS.some(c => this.data[c].some(x => x.isSample)); },
  removeSample() { for (const c of COLLECTIONS) this.data[c] = this.data[c].filter(x => !x.isSample); this.change(); this.emit('data'); },
  safetyDownload(label = 'safety-copy') { download(`phd-data-${label}-${todayISO()}.json`, this.exportJSON(), 'application/json'); },
};

/* ---------- Derived helpers ---------- */
function sourceStatus(s) {
  if (s.passDone >= s.targetPass) return 'complete';
  return ['toread', 'pass1', 'pass2', 'pass3'][s.passDone] || 'toread';
}
function inQueue(s) { return s.passDone < s.targetPass; }
function sourceLabel(s) {
  const a = s.authors && s.authors[0];
  const name = a ? (a.literal || a.family || '') : '';
  const etal = s.authors && s.authors.length > 2 ? ' et al.' : (s.authors && s.authors.length === 2 ? ' & ' + (s.authors[1].literal || s.authors[1].family) : '');
  return `${name || (s.title || 'Untitled').slice(0, 40)}${name ? etal : ''} (${s.year || 'n.d.'})`;
}
function projectName(id) { const p = Store.get('projects', id); return p ? p.title : ''; }
