/* App shell: navigation, routing, shortcuts, theme, save status */
const ROUTES = { dashboard: DashboardView, library: LibraryView, source: SourceView, projects: ProjectsView, settings: SettingsView, journal: JournalView, argument: ArgumentView, writing: WritingView, calendar: CalendarView, meetings: MeetingsView, records: RecordsView, reviews: ReviewsView, cards: CardsView };
/* desk: shown in the sidebar, and under "More" on a phone */
const NAV = [
  { r: 'dashboard', ico: '◎', k: 'nav_dashboard' },
  { r: 'calendar', ico: '▦', k: 'nav_calendar' },
  { r: 'library', ico: '❒', k: 'nav_library' },
  { r: 'journal', ico: '✎', k: 'nav_journal' },
  { r: 'projects', ico: '▤', k: 'nav_projects' },
  { r: 'argument', ico: '⋔', k: 'nav_argument', desk: true },
  { r: 'writing', ico: '✍', k: 'nav_writing', desk: true },
  { r: 'meetings', ico: '☷', k: 'nav_meetings', desk: true },
  { r: 'reviews', ico: '↺', k: 'nav_reviews', desk: true },
  { r: 'cards', ico: '❏', k: 'nav_cards', desk: true },
  { r: 'records', ico: '▣', k: 'nav_records', desk: true },
  { r: 'settings', ico: '⚙', k: 'nav_settings', desk: true },
];
const SOON = [];

function applyTheme() {
  const th = Store.data.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', th);
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-btn').textContent = th === 'auto' ? '◐' : dark ? '☾' : '☀';
  $('#theme-btn').title = t('theme') + ': ' + t('theme_' + th);
}

const App = {
  current: null,
  parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    return { route: parts[0] || 'dashboard', params: parts.slice(1), query };
  },
  renderNav() {
    const { route } = this.parse();
    const active = route === 'source' ? 'library' : route;
    $('#nav').innerHTML = NAV.map(n => `<a class="nav-item ${active === n.r ? 'active' : ''} ${n.desk ? 'desk' : ''}" href="#/${n.r}"><span class="ico" aria-hidden="true">${n.ico}</span><span class="long">${esc(t(n.k))}</span><span class="short">${esc(t(n.k + '_s'))}</span></a>`).join('')
      + `<details class="nav-item more mobile-only ${NAV.some(n => n.desk && n.r === active) ? 'active' : ''}"><summary><span class="ico" aria-hidden="true">⋯</span><span class="short">${esc(t('more'))}</span></summary>
          <div class="more-pop">${NAV.filter(n => n.desk).map(n => `<a href="#/${n.r}">${n.ico} ${esc(t(n.k))}</a>`).join('')}</div></details>`
      + (SOON.length ? `<div class="nav-sep">${esc(t('nav_coming'))}</div>` : '')
      + SOON.map(([k, st]) => `<span class="nav-item soon">${esc(k === 'nav_projects' ? 'Roadmap & kanban' : t(k))}<small>${esc(t('stage'))} ${st}</small></span>`).join('');
    $('#lang-btn').textContent = LANG === 'en' ? 'FR' : 'EN';
    setLang(LANG);
    this.renderStatus();
  },
  render() {
    const { route, params, query } = this.parse();
    const view = ROUTES[route] || DashboardView;
    const old = $('#view');
    // replace the node so old listeners are dropped
    const fresh = old.cloneNode(false);
    const scroll = this.current === location.hash ? window.scrollY : 0;
    fresh.innerHTML = view.render(params, query);
    old.replaceWith(fresh);
    view.bind && view.bind(fresh, params, query);
    if (this.current !== location.hash) { window.scrollTo(0, 0); } else window.scrollTo(0, scroll);
    this.current = location.hash;
  },
  renderStatus() {
    const el = $('#save-status');
    let txt = '', warn = false;
    if (Store.status === 'saving') txt = t('saving');
    else if (Store.status === 'error') { txt = '⚠ Save error'; warn = true; }
    else if (Store.dirState === 'granted' && Store.lastFileSave) txt = '✓ ' + t('savedAt', { t: fmtTime(Store.lastFileSave) });
    else if (Store.lastBrowserSave) { txt = t('savedBrowser'); warn = Store.dirState !== 'granted'; }
    if (Sync.phone) { txt = Sync.meta.loadedAt ? '📱 ' + fmtDate(Sync.meta.loadedAt.slice(0, 10), { day: 'numeric', month: 'short' }) : ''; warn = false; }
    el.textContent = txt; el.classList.toggle('warn', warn);
    el.title = Store.dirState === 'granted' ? Store.dir.name + '/phd-data.json' : t('unsaved');
    this.renderSyncBadge();
  },
  renderSyncBadge: debounce(() => {
    const b = $('#sync-btn'); if (!b) return;
    b.hidden = !Sync.phone; if (!Sync.phone) return;
    const n = Sync.pending();
    b.innerHTML = `⇅${n ? ` <b class="sync-n">${n}</b>` : ''}`; b.title = t('phoneSync');
    b.classList.toggle('has-pending', n > 0);
  }, 600),
};

/* Keyboard shortcuts */
let gPending = false, gTimer;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (closeTopModal()) e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!modalStack.length) openSearch(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); Store.writeFile(); toast(t('saved')); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey || modalStack.length) return;
  const k = e.key.toLowerCase();
  if (gPending) {
    gPending = false; clearTimeout(gTimer);
    const map = { d: '#/dashboard', l: '#/library/queue', m: '#/library/matrix', p: '#/projects', k: '#/projects/board', t: '#/projects/roadmap', w: '#/writing', s: '#/settings', j: '#/journal', a: '#/argument', r: '#/journal?tab=decisions', c: '#/calendar', o: '#/meetings', h: '#/calendar/time', e: '#/records', v: '#/reviews', y: '#/cards' };
    if (map[k]) { e.preventDefault(); location.hash = map[k]; }
    return;
  }
  if (k === 'g') { gPending = true; gTimer = setTimeout(() => gPending = false, 1200); return; }
  if (k === 'f') { e.preventDefault(); openTimer(); return; }
  if (k === 'e') { e.preventDefault(); eventModal(null, todayISO()); return; }
  if (k === 'q') { e.preventDefault(); openQuickAdd('task'); }
  else if (k === 't') { e.preventDefault(); openQuickAdd('task'); }
  else if (k === 's') { e.preventDefault(); openQuickAdd('source'); }
  else if (k === 'n') { e.preventDefault(); openQuickAdd('note'); }
  else if (k === '/') { e.preventDefault(); openSearch(); }
});

/* Clicking a dotted [[link]] to a note that does not exist yet creates it */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-new-note]'); if (!a) return;
  e.preventDefault();
  const n = Store.add('notes', newNote({ kind: 'note', title: a.dataset.newNote.replace(/&amp;/g, '&'), date: todayISO() }));
  Store.all('notes').forEach(x => Links.refresh(x)); Store.change();
  location.hash = '#/journal/' + n.id;
});

/* Header buttons */
document.addEventListener('click', e => {
  const a = e.target.closest('.topbar [data-action]'); if (!a) return;
  const act = a.dataset.action;
  if (act === 'timer') openTimer();
  else if (act === 'open-sync') openSync();
  else if (act === 'open-search') openSearch();
  else if (act === 'quick-add') openQuickAdd('task');
  else if (act === 'toggle-lang') { Store.data.settings.lang = LANG === 'en' ? 'fr' : 'en'; Store.change(); setLang(Store.data.settings.lang); App.renderNav(); App.render(); }
  else if (act === 'toggle-theme') {
    const order = ['auto', 'light', 'dark'];
    Store.data.settings.theme = order[(order.indexOf(Store.data.settings.theme) + 1) % 3]; Store.change(); applyTheme();
  }
});

window.addEventListener('hashchange', () => { App.renderNav(); App.render(); $$('details.menu[open]').forEach(x => { x.open = false; }); });
window.addEventListener('beforeunload', e => { if (Store.status === 'saving') { e.preventDefault(); e.returnValue = ''; } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
Store.subscribe(kind => { if (kind === 'status') App.renderStatus(); if (kind === 'data') { setLang(Store.data.settings.lang); applyTheme(); App.renderNav(); App.render(); Timer.run(); } });
/* When you come back to the tab, pick up a newer file (e.g. a backup you restored by hand) */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && Store.dirState === 'granted' && Store.status !== 'saving') {
    if (await Store.loadNewerFromFile()) { App.render(); toast('Loaded newer phd-data.json'); }
    Sync.checkInbox();
  }
});
/* Buttons outside the top bar that open the phone sync window (dashboard banner, settings) */
document.addEventListener('click', e => { const a = e.target.closest('[data-action="open-sync"]'); if (a && !a.closest('.topbar')) { e.preventDefault(); openSync(); } });

/* Installable app with offline support (only over https or localhost, not file://) */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));
}

(async function boot() {
  await Store.init();
  await Sync.init();
  if (Store.dirState === 'granted') Sync.startLaptopWatch();
  Store.subscribe(kind => { if (kind === 'data' && Store.dirState === 'granted' && !Sync._timer) Sync.startLaptopWatch(); });
  setLang(Store.data.settings.lang);
  applyTheme();
  App.renderNav();
  App.render();
  App.renderStatus();
  Timer.run();
})();
