/* Records and admin: ethics / Law 25 / data management checklist, courses, RA-TA hours, receipts, documents, living CV */
const RSCHEMA = {
  course: [['code', 'text'], ['title', 'text'], ['term', 'text'], ['credits', 'number'], ['grade', 'text'], ['cstatus', 'select', ['completed', 'inprogress', 'planned']], ['instructor', 'text']],
  contract: [['role', 'select', ['RA', 'TA', 'other']], ['title', 'text'], ['with', 'text'], ['start', 'date'], ['end', 'date'], ['hoursCap', 'number'], ['notes', 'textarea']],
  receipt: [['date', 'date'], ['vendor', 'text'], ['amount', 'number'], ['currency', 'text'], ['category', 'select', RECEIPT_CATS], ['projectId', 'project'], ['rstatus', 'select', RECEIPT_STATUS], ['funding', 'text'], ['location', 'text'], ['notes', 'textarea']],
  document: [['title', 'text'], ['category', 'select', DOC_CATS], ['date', 'date'], ['expires', 'date'], ['location', 'text'], ['notes', 'textarea']],
  storage: [['dataType', 'text'], ['location', 'text'], ['encrypted', 'select', ['yes', 'no', 'na']], ['access', 'text'], ['retention', 'text'], ['destroyBy', 'date'], ['notes', 'textarea']],
};
const recs = kind => Store.all('records').filter(r => r.kind === kind);
const yn = v => v === 'yes' ? t('yes') : v === 'no' ? t('no') : v === 'na' ? 'n/a' : '';
const locLink = loc => !loc ? '' : /^https?:\/\//.test(loc) ? `<a href="${esc(loc)}" target="_blank" rel="noopener">↗ ${esc(loc.replace(/^https?:\/\//, '').slice(0, 40))}</a>` : `<button class="btn ghost small" data-action="copy-loc" data-loc="${esc(loc)}" title="${esc(t('copyPath'))}">⧉ ${esc(loc.length > 40 ? '…' + loc.slice(-38) : loc)}</button>`;

const RecordsView = {
  render(params) {
    const tab = params[0] || 'ethics';
    const tabs = ['ethics', 'courses', 'work', 'receipts', 'documents', 'cv'].map(k => `<a class="tab ${tab === k ? 'active' : ''}" href="#/records/${k}">${esc(t('rt_' + k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_records'))}</h1><p class="sub">${esc(t('recordsSub'))} <a href="#/projects/deadlines">${esc(t('deadlinesLink'))}</a></p></div></div><nav class="tabs">${tabs}</nav>`;
    const body = { ethics: this.ethics, courses: this.courses, work: this.work, receipts: this.receipts, documents: this.documents, cv: this.cv }[tab].call(this);
    return head + body;
  },

  ethics() {
    const items = recs('check');
    const store = recs('storage');
    if (!items.length) return `<div class="banner info"><span style="flex:1;min-width:220px"><strong>${esc(t('ethicsTmplTitle'))}</strong><br><span class="small">${esc(t('ethicsTmplText'))}</span></span><button class="btn primary" data-action="ethics-template">${esc(t('tmplAdd'))}</button></div>`;
    const done = items.filter(i => i.done).length;
    const sections = uniq(items.map(i => i.section));
    return `<div class="banner"><span class="small" style="flex:1">${esc(t('ethicsWarn'))}</span></div>
      <div class="card" style="margin-bottom:14px"><div class="row"><strong>${done} / ${items.length}</strong><span class="small muted">${esc(t('checksDone'))}</span><span class="spacer"></span><button class="btn small" data-action="add-check">+ ${esc(t('addCheck'))}</button></div>
        <div class="bar" style="margin-top:8px"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div></div>
      ${sections.map(sec => `<div class="card" style="margin-bottom:12px"><h2>${esc(I18N.en['cs_' + sec] ? t('cs_' + sec) : sec)}</h2><ul class="list">
        ${items.filter(i => i.section === sec).map(i => `<li><input type="checkbox" class="check" data-check="${i.id}" ${i.done ? 'checked' : ''}><div class="grow">
          <span class="${i.done ? 'done-text' : ''}">${esc(i.text)}</span>${i.verify ? ` <span class="pill warn" title="${esc(t('verifyHint'))}">⚠ ${esc(t('verifyShort'))}</span>` : ''}
          ${i.help ? `<div class="small faint">${esc(i.help)}</div>` : ''}
          <input class="inline-input small" data-checknote="${i.id}" value="${esc(i.note || '')}" placeholder="${esc(t('checkNoteHint'))}">${i.done && i.doneAt ? `<span class="small faint">✓ ${esc(fmtDate(i.doneAt))}</span>` : ''}</div>
          <button class="btn ghost small danger" data-action="del-rec" data-id="${i.id}" aria-label="${esc(t('delete'))}">✕</button></li>`).join('')}</ul></div>`).join('')}
      <div class="row" style="margin:18px 0 8px"><h2 style="margin:0">${esc(t('storageMap'))}</h2><span class="spacer"></span><button class="btn small" data-action="new-rec" data-kind="storage">+ ${esc(t('addRow'))}</button></div>
      <p class="small muted">${esc(t('storageMapHelp'))}</p>
      ${this.table('storage', store, ['dataType', 'location', 'encrypted', 'access', 'retention', 'destroyBy'])}`;
  },

  table(kind, list, cols, extraCol) {
    if (!list.length) return `<div class="card empty">${esc(t('noRecords'))}</div>`;
    const cell = (r, k) => {
      const v = r[k];
      if (k === 'projectId') return esc(projectName(v));
      if (k === 'location') return locLink(v);
      if (k === 'encrypted') return v === 'no' ? `<span class="pill danger">${esc(yn(v))}</span>` : esc(yn(v));
      if (['date', 'start', 'end', 'destroyBy'].includes(k)) return esc(fmtDate(v));
      if (k === 'expires') return v ? `${esc(fmtDate(v))} ${dueBadge(v) || (daysUntil(v) <= 60 ? `<span class="pill warn">${esc(t('daysLeft', { n: daysUntil(v) }))}</span>` : '')}` : '';
      if (k === 'amount') return `${Number(v || 0).toFixed(2)} ${esc(r.currency || 'CAD')}`;
      if (k === 'rstatus') return `<span class="pill ${v === 'reimbursed' ? 'ok' : v === 'submitted' ? 'accent' : v === 'notclaimed' ? 'warn' : ''}">${esc(t('rs_' + v))}</span>`;
      if (k === 'cstatus') return esc(t('crs_' + v));
      if (k === 'category') return esc(t((kind === 'receipt' ? 'rc_' : 'dc_') + v));
      return esc(v);
    };
    return `<div class="table-wrap"><table><thead><tr>${cols.map(k => `<th class="${['access', 'retention', 'funding', 'notes', 'instructor', 'location'].includes(k) ? 'hide-mobile' : ''}">${esc(t('rf_' + k))}</th>`).join('')}${extraCol ? `<th>${esc(extraCol[0])}</th>` : ''}<th></th></tr></thead><tbody>
      ${list.map(r => `<tr>${cols.map(k => `<td class="small ${['access', 'retention', 'funding', 'notes', 'instructor', 'location'].includes(k) ? 'hide-mobile' : ''}">${cell(r, k)}</td>`).join('')}${extraCol ? `<td class="small">${extraCol[1](r)}</td>` : ''}
        <td style="white-space:nowrap"><button class="btn ghost small" data-action="edit-rec" data-id="${r.id}">${esc(t('edit'))}</button></td></tr>`).join('')}</tbody></table></div>`;
  },

  courses() {
    const C = recs('course').sort((a, b) => (b.term || '').localeCompare(a.term || ''));
    const cr = C.filter(c => c.cstatus === 'completed').reduce((s, c) => s + (Number(c.credits) || 0), 0);
    return `<div class="row" style="margin-bottom:10px"><span class="pill ok">${cr} ${esc(t('creditsDone'))}</span><span class="small muted">${esc(t('creditsOf'))}</span><span class="spacer"></span><button class="btn primary" data-action="new-rec" data-kind="course">+ ${esc(t('rk_course'))}</button></div>
      ${this.table('course', C, ['code', 'title', 'term', 'credits', 'grade', 'cstatus', 'instructor'])}`;
  },

  work() {
    const K = recs('contract').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    const H = recs('hours');
    const cards = K.map(c => {
      const used = H.filter(h => h.contractId === c.id).reduce((s, h) => s + (Number(h.hours) || 0), 0);
      const cap = Number(c.hoursCap) || 0, pct = cap ? Math.min(100, used / cap * 100) : 0;
      const weeksLeft = c.end ? Math.max(0, daysUntil(c.end) / 7) : 0;
      const warn = cap && used > cap ? 'danger' : cap && used > cap * 0.9 ? 'warn' : '';
      return `<div class="card c6"><div class="row"><span class="pill accent">${esc(c.role)}</span><h2 style="margin:0;flex:1">${esc(c.title)}</h2><button class="btn ghost small" data-action="edit-rec" data-id="${c.id}">${esc(t('edit'))}</button></div>
        <p class="small muted" style="margin:4px 0">${esc(c.with)} · ${esc(fmtDate(c.start))} – ${esc(fmtDate(c.end))} ${c.end ? dueBadge(c.end) : ''}</p>
        <div class="row"><span class="stat" style="font-size:1.4rem">${used.toFixed(1)}</span><span class="muted small">/ ${cap || '—'} h</span>${warn ? `<span class="pill ${warn}">${esc(t(warn === 'danger' ? 'overCap' : 'nearCap'))}</span>` : ''}</div>
        ${cap ? `<div class="bar"><i style="width:${pct}%"></i></div>${weeksLeft >= 1 && cap > used ? `<p class="small faint" style="margin-top:4px">${esc(t('hoursPerWeekLeft', { n: ((cap - used) / weeksLeft).toFixed(1) }))}</p>` : ''}` : ''}
        <form class="row" data-form="hours" data-id="${c.id}" style="margin-top:10px"><input type="date" name="date" value="${todayISO()}" style="width:auto"><input type="number" name="hours" step="0.25" min="0" placeholder="h" style="width:80px"><input name="note" placeholder="${esc(t('logNote'))}" style="flex:1;min-width:120px"><button class="btn small">+</button></form>
        <ul class="list small" style="margin-top:6px">${H.filter(h => h.contractId === c.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(h => `<li><span class="faint" style="width:80px">${esc(fmtDate(h.date, { day: 'numeric', month: 'short' }))}</span><span class="grow">${esc(h.note)}</span><b>${h.hours} h</b><button class="btn ghost small danger" data-action="del-rec" data-id="${h.id}" aria-label="${esc(t('delete'))}">✕</button></li>`).join('')}</ul></div>`;
    }).join('');
    const months = {}; H.forEach(h => { const k = (h.date || '').slice(0, 7), c = Store.get('records', h.contractId); if (!c) return; months[k] = months[k] || {}; months[k][c.role] = (months[k][c.role] || 0) + Number(h.hours || 0); });
    const mk = Object.keys(months).sort().reverse().slice(0, 12);
    return `<div class="row" style="margin-bottom:10px"><p class="small muted" style="flex:1;margin:0">${esc(t('workHelp'))}</p><button class="btn" data-action="export-hours">⇩ CSV</button><button class="btn primary" data-action="new-rec" data-kind="contract">+ ${esc(t('rk_contract'))}</button></div>
      <div class="dash">${cards || `<div class="card c12 empty">${esc(t('noRecords'))}</div>`}
      ${mk.length ? `<div class="card c12"><h2>${esc(t('byMonth'))}</h2><div class="table-wrap"><table><thead><tr><th>${esc(t('month'))}</th><th>RA</th><th>TA</th><th>${esc(t('other'))}</th></tr></thead><tbody>${mk.map(k => `<tr><td>${esc(parseISO(k + '-01').toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' }))}</td><td>${(months[k].RA || 0).toFixed(1)}</td><td>${(months[k].TA || 0).toFixed(1)}</td><td>${(months[k].other || 0).toFixed(1)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}</div>`;
  },

  receipts() {
    const R = recs('receipt').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tot = st => R.filter(r => r.rstatus === st).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return `<div class="dash" style="margin-bottom:14px">${['notclaimed', 'submitted', 'reimbursed'].map(st => `<div class="card c4"><span class="small muted">${esc(t('rs_' + st))}</span><div class="stat">${tot(st).toFixed(2)} <small>CAD</small></div></div>`).join('')}</div>
      <div class="row" style="margin-bottom:10px"><p class="small muted" style="flex:1;margin:0">${esc(t('receiptHelp'))}</p><button class="btn" data-action="export-receipts">⇩ CSV</button><button class="btn primary" data-action="new-rec" data-kind="receipt">+ ${esc(t('rk_receipt'))}</button></div>
      ${this.table('receipt', R, ['date', 'vendor', 'amount', 'category', 'projectId', 'rstatus', 'funding', 'location'])}`;
  },

  documents() {
    const D = recs('document').sort((a, b) => (a.category || '').localeCompare(b.category || '') || (b.date || '').localeCompare(a.date || ''));
    return `<div class="row" style="margin-bottom:10px"><p class="small muted" style="flex:1;margin:0">${esc(t('docHelp'))}</p><button class="btn primary" data-action="new-rec" data-kind="document">+ ${esc(t('rk_document'))}</button></div>
      ${this.table('document', D, ['title', 'category', 'date', 'expires', 'location', 'notes'])}`;
  },

  /* ---------- Living CV ---------- */
  cv() {
    const S = Store.data.settings.cv;
    const html = buildCV(true);
    return `<div class="dash"><div class="card c4"><h2>${esc(t('cvHeader'))}</h2><div class="grid">
        ${['name', 'title', 'affiliation', 'email', 'orcid', 'website'].map(k => `<label class="field"><span>${esc(t('cv_' + k))}</span><input data-cvh="${k}" value="${esc(S[k] || '')}"></label>`).join('')}
        <button class="btn" data-action="new-cv">+ ${esc(t('addCvItem'))}</button>
        <p class="small muted">${esc(t('cvHelp'))}</p>
        <div class="row"><button class="btn primary" data-action="cv-word">⇩ Word (.html)</button><button class="btn" data-action="cv-md">⇩ Markdown</button><button class="btn" data-action="cv-copy">${esc(t('copy'))}</button></div></div></div>
      <div class="card c8 cv-preview">${html}</div></div>`;
  },

  bind(root) {
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'new-rec') recordModal(a.dataset.kind);
      else if (act === 'edit-rec') { const r = Store.get('records', a.dataset.id); recordModal(r.kind, r); }
      else if (act === 'del-rec') { if (confirmBox(t('delete') + '?')) { Store.remove('records', a.dataset.id); App.render(); } }
      else if (act === 'copy-loc') copyText(a.dataset.loc);
      else if (act === 'ethics-template') { ethicsTemplate().forEach(r => Store.data.records.push(r)); Store.change(); App.render(); }
      else if (act === 'add-check') {
        const text = prompt(t('addCheck')); if (!text) return;
        Store.add('records', { kind: 'check', section: 'custom', text, done: false, note: '', verify: false });
        App.render();
      }
      else if (act === 'export-receipts') download(`receipts-${todayISO()}.csv`, recordsCSV('receipt'), 'text/csv');
      else if (act === 'export-hours') download(`ra-ta-hours-${todayISO()}.csv`, hoursCSV(), 'text/csv');
      else if (act === 'new-cv') cvModal();
      else if (act === 'edit-cv') cvModal(Store.get('cvItems', a.dataset.id));
      else if (act === 'cv-word') download(`CV-${todayISO()}.html`, `<html><head><meta charset="utf-8"><title>CV</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.35;max-width:7in;margin:auto}h1{font-size:18pt;margin:0}h2{font-size:12pt;border-bottom:1px solid #999;margin:18pt 0 6pt;text-transform:uppercase;letter-spacing:.5pt}h3{font-size:11pt;margin:8pt 0 2pt}p{margin:0 0 4pt}.hang{padding-left:.4in;text-indent:-.4in}.muted{color:#555}</style></head><body>${buildCV(false)}</body></html>`, 'text/html');
      else if (act === 'cv-md') download(`CV-${todayISO()}.md`, htmlToMd(buildCV(false)), 'text/markdown');
      else if (act === 'cv-copy') { const h = buildCV(false); copyText(htmlToMd(h), h); }
      else if (act === 'cit') { const p = Store.get('projects', a.dataset.id); const v = prompt(t('citationPrompt'), p.citation || ''); if (v != null) { Store.update('projects', p.id, { citation: v.trim() }); App.render(); } }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.check) { const r = Store.get('records', el.dataset.check); Store.update('records', r.id, { done: el.checked, doneAt: el.checked ? todayISO() : '' }); App.render(); }
    });
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.checknote) { const r = Store.get('records', el.dataset.checknote); r.note = el.value; Store.change(); }
      if (el.dataset.cvh) { Store.data.settings.cv[el.dataset.cvh] = el.value; Store.change(); debouncedCv(); }
    });
    root.addEventListener('submit', e => {
      if (e.target.dataset.form !== 'hours') return; e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries()); const h = Number(f.hours); if (!h) return;
      Store.add('records', { kind: 'hours', contractId: e.target.dataset.id, date: f.date || todayISO(), hours: h, note: f.note || '' }); App.render();
    });
  },
};
const debouncedCv = debounce(() => { const p = $('.cv-preview'); if (p) p.innerHTML = buildCV(true); }, 300);

function recordModal(kind, rec) {
  const sch = RSCHEMA[kind], v = rec || { kind, currency: 'CAD', rstatus: 'notclaimed', cstatus: 'completed', role: 'RA', encrypted: 'yes' };
  const P = Store.all('projects');
  const field = ([k, type, opts]) => {
    const lab = `<span>${esc(t('rf_' + k))}</span>`;
    const val = v[k] ?? '';
    if (type === 'select') {
      const pre = { category: kind === 'receipt' ? 'rc_' : 'dc_', rstatus: 'rs_', cstatus: 'crs_' }[k];
      return `<label class="field">${lab}<select data-rk="${k}">${options(opts, val, o => pre ? t(pre + o) : k === 'encrypted' ? yn(o) : o)}</select></label>`;
    }
    if (type === 'project') return `<label class="field">${lab}<select data-rk="${k}"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), val, projectName)}</select></label>`;
    if (type === 'textarea') return `<label class="field span-all">${lab}<textarea data-rk="${k}" rows="2">${esc(val)}</textarea></label>`;
    return `<label class="field ${k === 'title' || k === 'location' || k === 'vendor' || k === 'dataType' ? 'span-all' : ''}">${lab}<input type="${type}" data-rk="${k}" value="${esc(val)}" ${type === 'number' ? 'step="any"' : ''}></label>`;
  };
  const m = modal({
    title: (rec ? t('edit') : '+') + ' ' + t('rk_' + kind), wide: true,
    body: `${kind === 'document' || kind === 'receipt' ? `<p class="small muted">${esc(t('locationHelp'))}</p>` : ''}<div class="grid g2">${sch.map(field).join('')}</div>`,
    foot: `${rec ? `<button class="btn danger" id="rm-del">${esc(t('delete'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="rm-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="rm-save">${esc(t('save'))}</button>`,
  });
  const r = m.root;
  $('#rm-cancel', r).onclick = m.close;
  $('#rm-save', r).onclick = () => {
    const data = { kind }; $$('[data-rk]', r).forEach(x => data[x.dataset.rk] = x.type === 'number' ? (x.value === '' ? '' : Number(x.value)) : x.value);
    const main = sch[0][0]; if (!String(data[main] || '').trim() && main !== 'date') { toast(t('fillFirst')); return; }
    if (rec) Store.update('records', rec.id, data); else Store.add('records', data);
    m.close(); App.render();
  };
  if (rec) $('#rm-del', r).onclick = () => { if (confirmBox(t('delete') + '?')) { if (kind === 'contract') Store.data.records = Store.data.records.filter(h => h.contractId !== rec.id); Store.remove('records', rec.id); m.close(); App.render(); } };
}

function recordsCSV(kind) {
  const cols = RSCHEMA[kind].map(c => c[0]), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + cols.map(c => t('rf_' + c)).map(q).join(',') + '\r\n' + recs(kind).map(r => cols.map(c => c === 'projectId' ? projectName(r[c]) : r[c]).map(q).join(',')).join('\r\n');
}
function hoursCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿date,role,contract,hours,note\r\n' + recs('hours').sort((a, b) => a.date.localeCompare(b.date)).map(h => { const c = Store.get('records', h.contractId) || {}; return [h.date, c.role, c.title, h.hours, h.note].map(q).join(','); }).join('\r\n');
}

/* Ethics, Law 25 and data management checklist. Wording is general guidance; verify every item with Concordia's Office of Research. */
function ethicsTemplate() {
  const S = (section, text, help = '', verify = true) => ({ id: uid('r_'), kind: 'check', section, text, help, verify, done: false, note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return [
    S('approvals', 'TCPS 2: CORE tutorial completed (keep the certificate in Documents)', 'Tri-Council Policy Statement on ethical conduct for research involving humans.', false),
    S('approvals', 'Concordia research ethics application submitted and approved', 'Check the current form, review level and timelines with the Office of Research.'),
    S('approvals', 'Approval or authorization from each participating CEGEP', 'Colleges may have their own research ethics board or require institutional permission; confirm for each one.'),
    S('approvals', 'Supervisor has reviewed the protocol, instruments and consent forms', '', false),
    S('approvals', 'Amendments filed before any change to procedures, instruments or recruitment', '', false),
    S('approvals', 'Annual renewal or progress report before approval expires; final report at the end', 'Add the expiry date as a Document so it shows in your reminders.'),
    S('consent', 'Consent forms in plain language, in French and English', '', false),
    S('consent', 'Consent explains purpose, what participants do, risks, benefits, and the right to withdraw (and until when data can be withdrawn)', '', false),
    S('consent', 'Separate consent for audio or video recording, and for any secondary or future use of data', '', false),
    S('consent', 'Consent explains how data are stored, who can access them, how long they are kept and when they are destroyed', '', false),
    S('consent', 'Consent explains any use of AI or transcription tools on participant data', 'Only tools approved for the data’s sensitivity; no personal information in public AI tools.'),
    S('consent', 'Rules checked for any participants under 18', 'Some CEGEP students are minors; confirm the applicable consent requirements.'),
    S('consent', 'Teachers’ participation is voluntary and kept separate from evaluation by their employer', '', false),
    S('law25', 'Personal information mapped: what you collect, why, and that each item is necessary', 'Québec’s privacy law (as modernized by Law 25) expects minimal, purpose-limited collection.'),
    S('law25', 'Check whether any personal information leaves Québec (cloud survey, transcription, storage or AI tools hosted elsewhere) and whether a privacy impact assessment is required', ''),
    S('law25', 'Data de-identified or pseudonymized as early as possible; the re-identification key stored separately', '', false),
    S('law25', 'You know how to report a confidentiality incident (lost laptop, wrong recipient, breach) and to whom', 'Write the contact in the note field.'),
    S('law25', 'Retention period and destruction method stated, with a destruction date', '', false),
    S('dmp', 'Data management plan written (e.g., with the Digital Research Alliance of Canada’s DMP Assistant)', ''),
    S('dmp', 'Raw data stored only in approved, encrypted institutional storage; not on personal cloud accounts', 'Fill in the storage map below.'),
    S('dmp', 'Survey platform approved, with data hosting location known', ''),
    S('dmp', 'Backups of research data are encrypted and follow the same rules', '', false),
    S('dmp', 'Access list kept: who can see identifiable data', '', false),
    S('dmp', 'Plan for sharing or depositing de-identified data (if consented), e.g., a Canadian repository', ''),
    S('dmp', 'This PhD Command Centre file contains no participant data', 'It records where data live, never the data themselves.', false),
  ];
}

/* ---------- Living CV: built from projects, contracts, records and CV items ---------- */
function cvByKind(k) { return Store.all('cvItems').filter(c => c.kind === k).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
function buildCV(editable) {
  const S = Store.data.settings.cv, E = esc;
  const ed = c => editable ? ` <button class="btn ghost small no-print" data-action="edit-cv" data-id="${c.id}">${E(t('edit'))}</button>` : '';
  const yr = d => d ? d.slice(0, 4) : '';
  const sec = (title, body) => body ? `<h2>${E(title)}</h2>${body}` : '';
  const hang = (html) => `<p class="hang">${html}</p>`;
  let out = `<h1>${E(S.name || t('cvYourName'))}</h1><p class="muted">${[S.title, S.affiliation].filter(Boolean).map(E).join(' · ')}</p><p class="muted">${[S.email, S.orcid ? 'ORCID ' + S.orcid : '', S.website].filter(Boolean).map(E).join(' · ')}</p>`;
  out += sec(t('cvs_education'), cvByKind('education').map(c => hang(`<b>${E(c.title)}</b>, ${E(c.org || '')} ${c.date ? `(${E(c.date.slice(0, 4))}–${c.end ? E(c.end.slice(0, 4)) : E(t('inProgress'))})` : `(${E(t('inProgress'))})`}${c.details ? `. ${E(c.details)}` : ''}${ed(c)}`)).join(''));
  // Publications from projects
  const pubs = Store.all('projects').filter(p => ['publication', 'research'].includes(p.area) || p.citation);
  const cit = p => (p.citation ? E(p.citation) : `${E(p.title)}${p.outlet ? `. <i>${E(p.outlet)}</i>` : ''}`) + (editable ? ` <button class="btn ghost small no-print" data-action="cit" data-id="${p.id}">${E(p.citation ? t('edit') : t('addCitation'))}</button>` : '');
  const grp = (stages, label) => { const l = pubs.filter(p => stages.includes(p.stage)); return l.length ? `<h3>${E(label)}</h3>${l.map(p => hang(cit(p))).join('')}` : ''; };
  out += sec(t('cvs_publications'), grp(['published', 'accepted'], t('cvg_published')) + grp(['submitted', 'review', 'rr'], t('cvg_review')) + grp(['drafting', 'internal'], t('cvg_prep'))
    + cvByKind('publication').map(c => hang(`${E(c.title)}${ed(c)}`)).join(''));
  out += sec(t('cvs_presentations'), cvByKind('presentation').map(c => hang(`${E(c.authors || S.name || '')}${c.authors || S.name ? ' ' : ''}(${E(c.date ? fmtDateAPA(c.date) : 'n.d.')}). <i>${E(c.title)}</i> [${E(t('pt2_' + (c.ptype || 'conference')))}]. ${E(c.org || '')}${c.location ? ', ' + E(c.location) : ''}.${ed(c)}`)).join(''));
  const K = recs('contract').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  out += sec(t('cvs_experience'), K.map(c => hang(`<b>${E(c.role === 'RA' ? t('cvRA') : c.role === 'TA' ? t('cvTA') : c.title)}</b>${c.role !== 'other' ? ', ' + E(c.title) : ''}${c.with ? ` (${E(c.with)})` : ''}, ${E(yr(c.start))}${c.end && yr(c.end) !== yr(c.start) ? '–' + E(yr(c.end)) : ''}`)).join('')
    + cvByKind('teaching').map(c => hang(`<b>${E(c.title)}</b>, ${E(c.org || '')} (${E(yr(c.date))})${c.details ? `. ${E(c.details)}` : ''}${ed(c)}`)).join(''));
  out += sec(t('cvs_awards'), [...cvByKind('award'), ...cvByKind('funding')].map(c => hang(`<b>${E(c.title)}</b>, ${E(c.org || '')} (${E(yr(c.date))})${c.amount ? `, ${E(c.amount)}` : ''}${ed(c)}`)).join(''));
  out += sec(t('cvs_service'), cvByKind('service').map(c => hang(`${E(c.title)}, ${E(c.org || '')} (${E(yr(c.date))})${ed(c)}`)).join(''));
  out += sec(t('cvs_other'), cvByKind('other').map(c => hang(`${E(c.title)}${c.org ? ', ' + E(c.org) : ''}${c.date ? ` (${E(yr(c.date))})` : ''}${ed(c)}`)).join(''));
  return out;
}
function fmtDateAPA(iso) { const [y, m, d] = iso.split('-').map(Number); const mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]; return `${y}, ${mo}${d ? ' ' + d : ''}`; }
function htmlToMd(h) {
  return h.replace(/<button[^>]*>.*?<\/button>/g, '').replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n').replace(/<h2>(.*?)<\/h2>/g, '\n## $1\n\n').replace(/<h3>(.*?)<\/h3>/g, '\n### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n').replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<i>(.*?)<\/i>/g, '*$1*').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function cvModal(c) {
  const v = c || { kind: 'presentation', title: '', org: '', date: todayISO(), end: '', location: '', ptype: 'conference', authors: '', details: '', amount: '' };
  const m = modal({
    title: c ? t('edit') : t('addCvItem'), wide: true,
    body: `<div class="grid g2">
      <label class="field"><span>${esc(t('d_kind'))}</span><select id="cf-kind">${options(CV_KINDS, v.kind, k => t('cvk_' + k))}</select></label>
      <label class="field"><span>${esc(t('date'))}</span><input type="date" id="cf-date" value="${esc(v.date)}"></label>
      <label class="field span-all"><span>${esc(t('p_title'))}</span><input id="cf-title" value="${esc(v.title)}" placeholder="${esc(t('cvTitleHint'))}"></label>
      <label class="field span-all"><span>${esc(t('cvOrg'))}</span><input id="cf-org" value="${esc(v.org)}"></label>
      <label class="field" data-only="presentation"><span>${esc(t('cvPtype'))}</span><select id="cf-ptype">${options(PRES_TYPES, v.ptype, k => t('pt2_' + k))}</select></label>
      <label class="field" data-only="presentation"><span>${esc(t('location'))}</span><input id="cf-loc" value="${esc(v.location)}"></label>
      <label class="field span-all" data-only="presentation"><span>${esc(t('cvAuthors'))}</span><input id="cf-authors" value="${esc(v.authors)}" placeholder="${esc(t('cvAuthorsHint'))}"></label>
      <label class="field" data-only="education"><span>${esc(t('cvEnd'))}</span><input type="date" id="cf-end" value="${esc(v.end)}"></label>
      <label class="field" data-only="award funding"><span>${esc(t('cvAmount'))}</span><input id="cf-amount" value="${esc(v.amount)}"></label>
      <label class="field span-all"><span>${esc(t('cvDetails'))}</span><textarea id="cf-details" rows="2">${esc(v.details)}</textarea></label></div>`,
    foot: `${c ? `<button class="btn danger" id="cf-del">${esc(t('delete'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="cf-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="cf-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r).value;
  const sync = () => $$('[data-only]', r).forEach(x => x.style.display = x.dataset.only.split(' ').includes(g('cf-kind')) ? '' : 'none');
  $('#cf-kind', r).onchange = sync; sync();
  $('#cf-cancel', r).onclick = m.close;
  $('#cf-save', r).onclick = () => {
    const data = { kind: g('cf-kind'), title: g('cf-title').trim(), org: g('cf-org'), date: g('cf-date'), end: g('cf-end'), location: g('cf-loc'), ptype: g('cf-ptype'), authors: g('cf-authors'), details: g('cf-details'), amount: g('cf-amount') };
    if (!data.title) return;
    if (c) Store.update('cvItems', c.id, data); else Store.add('cvItems', data);
    m.close(); App.render();
  };
  if (c) $('#cf-del', r).onclick = () => { if (confirmBox(t('delete') + '?')) { Store.remove('cvItems', c.id); m.close(); App.render(); } };
}
