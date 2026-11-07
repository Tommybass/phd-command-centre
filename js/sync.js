/* Phone ⇄ laptop sync through OneDrive, with no server.
   Laptop (Edge/Chrome): the main copy. It writes phd-data.json to your OneDrive folder and imports
   "phd-inbox-….json" files that the phone drops into OneDrive/…/inbox.
   Phone (iPhone Safari, installed to the home screen): opens phd-data.json from the Files app as its
   snapshot, lets you capture and edit, then sends only what changed (field by field) as an inbox file. */
const Sync = {
  phone: !Store.fsSupported,
  baseline: null,
  meta: {},
  _timer: null,

  async init() {
    try {
      if (this.phone) {
        this.baseline = (await IDB.get('baseline')) || null;
        this.meta = (await IDB.get('phoneMeta')) || {};
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
      } else {
        this.meta = (await IDB.get('inboxMeta')) || {};
      }
    } catch (e) { console.warn('sync init', e); }
  },

  /* What changed on this phone since the last snapshot or send */
  diff() {
    const base = this.baseline || emptyData(), cur = Store.data, ops = [];
    for (const c of COLLECTIONS) {
      const bm = new Map((base[c] || []).map(x => [x.id, x])), cm = new Map((cur[c] || []).map(x => [x.id, x]));
      for (const [id, o] of cm) {
        const b = bm.get(id);
        if (!b) { ops.push({ op: 'add', coll: c, obj: o }); continue; }
        const patch = {};
        for (const k of Object.keys(o)) if (k !== 'updatedAt' && JSON.stringify(o[k]) !== JSON.stringify(b[k])) patch[k] = o[k];
        if (Object.keys(patch).length) ops.push({ op: 'patch', coll: c, id, patch });
      }
      for (const id of bm.keys()) if (!cm.has(id)) ops.push({ op: 'remove', coll: c, id });
    }
    const bl = base.cardLog || {}, cl = cur.cardLog || {};
    for (const d in cl) { const n = (cl[d] || 0) - (bl[d] || 0); if (n > 0) ops.push({ op: 'cardLog', date: d, n }); }
    return ops;
  },
  pending() { return this.phone ? this.diff().length : 0; },
  async setBaseline() { this.baseline = JSON.parse(JSON.stringify(Store.data)); await IDB.set('baseline', this.baseline); },

  /* Apply operations (field-level patches, so laptop edits to other fields are kept) */
  apply(ops, target = Store.data) {
    let n = 0;
    for (const o of ops || []) {
      if (o.op === 'cardLog') { target.cardLog = target.cardLog || {}; target.cardLog[o.date] = (target.cardLog[o.date] || 0) + Number(o.n || 0); n++; continue; }
      if (!COLLECTIONS.includes(o.coll) || !Array.isArray(target[o.coll])) continue;
      const list = target[o.coll], id = o.obj ? o.obj.id : o.id, i = list.findIndex(x => x.id === id);
      if (o.op === 'add') { if (i === -1) list.push(o.obj); else Object.assign(list[i], o.obj); n++; }
      else if (o.op === 'patch' && i > -1) { Object.assign(list[i], o.patch, { updatedAt: new Date().toISOString() }); n++; }
      else if (o.op === 'remove' && i > -1) { list.splice(i, 1); n++; }
    }
    return n;
  },

  /* ---------- Phone side ---------- */
  async loadSnapshot(file) {
    const snap = JSON.parse(await file.text());
    if (!snap || !Array.isArray(snap.sources) || !snap.settings) throw new Error(t('notPhdFile'));
    const pending = this.diff();                 // keep anything not yet sent
    Store.data = Store.migrate(snap);
    await this.setBaseline();
    this.apply(pending);
    this.meta = Object.assign(this.meta, { loadedAt: new Date().toISOString(), snapshotSavedAt: snap.savedAt || '' });
    await IDB.set('phoneMeta', this.meta);
    await IDB.set('data', Store.data);
    setLang(Store.data.settings.lang); Store.emit('data'); Store.emit('status');
    return pending.length;
  },
  async send() {
    const ops = this.diff(); if (!ops.length) return 0;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `phd-inbox-${stamp}.json`;
    const body = JSON.stringify({ type: 'phd-command-centre-inbox', version: 1, createdAt: new Date().toISOString(), device: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'phone', ops });
    const file = new File([body], name, { type: 'application/json' });
    let ok = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); ok = true; }
      catch (e) { if (e && e.name === 'AbortError') return -1; }
    }
    if (!ok) { download(name, body, 'application/json'); ok = confirmBox(t('savedInboxConfirm')); }
    if (!ok) return -1;
    await this.setBaseline();
    this.meta.lastSentAt = new Date().toISOString(); this.meta.lastSentCount = ops.length;
    await IDB.set('phoneMeta', this.meta); Store.emit('status');
    return ops.length;
  },

  /* ---------- Laptop side: import phone inbox files from the OneDrive folder ---------- */
  async checkInbox(manual = false) {
    if (this.phone || !Store.dir || Store.dirState !== 'granted' || this._busy) return 0;
    this._busy = true; let changes = 0, files = 0;
    try {
      const inbox = await Store.dir.getDirectoryHandle('inbox', { create: true });
      const processed = await inbox.getDirectoryHandle('processed', { create: true });
      for (const dh of [inbox, Store.dir]) {
        const found = [];
        for await (const [name, h] of dh.entries()) if (h.kind === 'file' && /^phd-inbox-.*\.json$/i.test(name)) found.push([name, h]);
        for (const [name, h] of found.sort((a, b) => a[0].localeCompare(b[0]))) {
          try {
            const text = await (await h.getFile()).text(), j = JSON.parse(text);
            if (j.type !== 'phd-command-centre-inbox') continue;
            const done = this.meta.processed || [];
            if (!done.includes(name)) { changes += this.apply(j.ops); files++; this.meta.processed = [...done, name].slice(-300); }
            const w = await (await processed.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close();
            await dh.removeEntry(name);
          } catch (e) { console.warn('inbox file', name, e); }
        }
      }
      if (files) {
        this.meta.lastImport = new Date().toISOString(); this.meta.lastCount = changes;
        Store.data.notes.forEach(n => Links.refresh(n));
        Store.change(); Store.emit('data');
        toast(t('inboxImported', { n: changes, f: files }), 5000);
      } else if (manual) toast(t('inboxEmpty'));
      this.meta.lastCheck = new Date().toISOString();
      await IDB.set('inboxMeta', this.meta);
    } catch (e) { console.warn('inbox', e); if (manual) toast(String(e.message || e)); }
    this._busy = false;
    return files;
  },
  startLaptopWatch() {
    if (this.phone) return;
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (document.visibilityState === 'visible') this.checkInbox(); }, 120000);
    this.checkInbox();
  },
};

/* Phone sync window */
function openSync() {
  const n = Sync.pending(), M = Sync.meta;
  const ago = iso => iso ? `${fmtDate(iso.slice(0, 10))} ${fmtTime(new Date(iso))}` : '—';
  const m = modal({
    title: t('phoneSync'),
    body: `<p class="small muted">${esc(t('phoneSyncHelp'))}</p>
      <div class="card" style="box-shadow:none"><h3>① ${esc(t('getLatest'))}</h3>
        <p class="small muted">${esc(M.loadedAt ? t('lastLoaded', { t: ago(M.loadedAt), s: ago(M.snapshotSavedAt) }) : t('neverLoaded'))}</p>
        <button class="btn primary" id="sy-load">⇣ ${esc(t('chooseDataFile'))}</button></div>
      <div class="card" style="box-shadow:none"><h3>② ${esc(t('sendChangesTitle'))}</h3>
        <p class="small muted">${esc(n ? t('pendingChanges', { n }) : t('noChanges'))}${M.lastSentAt ? ' · ' + esc(t('lastSent', { t: ago(M.lastSentAt) })) : ''}</p>
        <button class="btn primary" id="sy-send" ${n ? '' : 'disabled'}>⇡ ${esc(t('sendChanges', { n }))}</button></div>
      <p class="small faint">${esc(t('installHint'))}</p>`,
    foot: `<button class="btn" id="sy-close">${esc(t('close'))}</button>`,
  });
  const r = m.root;
  $('#sy-close', r).onclick = m.close;
  $('#sy-load', r).onclick = async () => {
    const f = await pickFile('.json,application/json'); if (!f) return;
    try { const kept = await Sync.loadSnapshot(f); toast(t('snapshotLoaded', { n: kept }), 4000); m.close(); App.render(); }
    catch (e) { toast(String(e.message || e), 5000); }
  };
  $('#sy-send', r).onclick = async () => { const k = await Sync.send(); if (k > 0) { toast(t('sentOk', { n: k }), 4000); m.close(); App.render(); } };
}
function phoneBanner() {
  if (!Sync.phone) return '';
  const M = Sync.meta, n = Sync.pending();
  if (!M.loadedAt) return `<div class="banner info"><span style="flex:1;min-width:200px">📱 ${esc(t('phoneBannerFirst'))}</span><button class="btn primary" data-action="open-sync">${esc(t('getLatest'))}</button></div>`;
  if (n) return `<div class="banner"><span style="flex:1;min-width:200px">⇡ ${esc(t('phoneBannerPending', { n }))}</span><button class="btn primary" data-action="open-sync">${esc(t('sendChanges', { n }))}</button></div>`;
  if (daysUntil(M.loadedAt.slice(0, 10)) < -1) return `<div class="banner"><span style="flex:1;min-width:200px">${esc(t('phoneBannerOld', { d: fmtDate(M.loadedAt.slice(0, 10)) }))}</span><button class="btn" data-action="open-sync">${esc(t('getLatest'))}</button></div>`;
  return '';
}
