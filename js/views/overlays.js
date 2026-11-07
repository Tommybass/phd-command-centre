/* Quick add, search across everything, and the AI paste-in flow */
function openQuickAdd(kind = 'task') {
  const projects = Store.all('projects');
  const projSel = `<select name="projectId"><option value="">${esc(t('none'))}</option>${options(projects.map(p => p.id), '', projectName)}</select>`;
  const forms = {
    task: `<input name="title" placeholder="${esc(t('t_title'))}" autofocus>
      <div class="grid g3"><label class="field"><span>${esc(t('t_project'))}</span>${projSel}</label>
      <label class="field"><span>${esc(t('t_due'))}</span><input type="date" name="due"></label>
      <label class="field"><span>${esc(t('t_energy'))}</span><select name="energy"><option value=""></option>${options(ENERGY, '', v => t('en_' + v))}</select></label>
      <label class="field"><span>${esc(t('estimate'))}</span><input type="number" name="estimateH" min="0" step="0.25" placeholder="h"></label></div>
      <label class="row small"><input type="checkbox" name="top"> ${esc(t('t_top'))}</label>`,
    source: `<input name="title" placeholder="${esc(t('f_title'))}" autofocus>
      <input name="authors" placeholder="${esc(t('f_authors'))}: ${esc(t('f_authorsHint'))}">
      <div class="grid g3"><label class="field"><span>${esc(t('f_year'))}</span><input name="year" inputmode="numeric"></label>
      <label class="field"><span>${esc(t('f_type'))}</span><select name="type">${options(SOURCE_TYPES, 'article', v => t('type_' + v))}</select></label>
      <label class="field"><span>${esc(t('f_priority'))}</span><select name="priority">${options([3, 2, 1], 2, v => t('prio_' + v))}</select></label></div>
      <input name="doi" placeholder="DOI / URL">
      <label class="field"><span>${esc(t('t_project'))}</span>${projSel}</label>
      <button type="button" class="btn ai" data-ai>✎ ${esc(t('pasteAbstract'))}</button>`,
    note: `<textarea name="text" rows="5" placeholder="${esc(t('noteText'))}" autofocus></textarea>
      <div class="grid g2"><label class="field"><span>${esc(t('f_type'))}</span><select name="kind">${options(NOTE_KINDS, 'inbox', k => t('nk_' + k))}</select></label>
      <label class="field"><span>${esc(t('t_project'))}</span>${projSel}</label></div>`,
    deadline: `<input name="title" placeholder="${esc(t('p_title'))}" autofocus>
      <div class="grid g2"><label class="field"><span>${esc(t('d_kind'))}</span><select name="kind">${options(DEADLINE_KINDS, 'funding', v => t('dk_' + v))}</select></label>
      <label class="field"><span>${esc(t('t_due'))}</span><input type="date" name="due" required></label></div>
      <input name="url" type="url" placeholder="URL">`,
  };
  const tabs = ['task', 'source', 'note', 'deadline'];
  const m = modal({
    title: t('quickAdd'),
    body: `<div class="tabs" style="margin:-6px 0 0">${tabs.map(k => `<button type="button" class="tab ${k === kind ? 'active' : ''}" data-tab="${k}">${esc(t('qa_' + k))}</button>`).join('')}</div>
      <form id="qa-form" class="grid">${forms[kind]}</form>`,
    foot: `<span class="small faint" style="margin-right:auto">Ctrl ↵</span><button class="btn" id="qa-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="qa-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, form = $('#qa-form', r);
  r.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { m.close(); openQuickAdd(b.dataset.tab); });
  $('#qa-cancel', r).onclick = m.close;
  const ai = form.querySelector('[data-ai]'); if (ai) ai.onclick = () => { m.close(); openAIModal(); };
  const save = () => {
    const f = Object.fromEntries(new FormData(form).entries());
    if (kind === 'task') {
      if (!f.title.trim()) return;
      const topOk = Store.all('tasks').filter(y => y.top && !y.done).length < 3;
      Store.add('tasks', { title: f.title.trim(), projectId: f.projectId, due: f.due, energy: f.energy, estimateH: Number(f.estimateH) || 0, top: !!f.top && topOk, done: false });
    } else if (kind === 'source') {
      if (!f.title.trim()) return;
      const isDoi = /^(https?:\/\/(dx\.)?doi\.org\/|doi:|10\.)/i.test(f.doi.trim());
      const s = Store.add('sources', newSource({ title: f.title.trim(), authors: Cite.parseNames(f.authors), year: f.year, type: f.type, priority: Number(f.priority), doi: isDoi ? f.doi.trim() : '', url: isDoi ? '' : f.doi.trim(), projects: f.projectId ? [f.projectId] : [] }));
      m.close(); location.hash = '#/source/' + s.id; App.render(); return;
    } else if (kind === 'note') {
      if (!f.text.trim()) return;
      const n = newNote({ body: f.text.trim(), kind: f.kind || 'inbox', date: todayISO(), projects: f.projectId ? [f.projectId] : [] });
      Links.refresh(n); Store.add('notes', n);
    } else if (kind === 'deadline') {
      if (!f.title.trim() || !f.due) return;
      Store.add('deadlines', { title: f.title.trim(), kind: f.kind, due: f.due, url: f.url, notes: '' });
    }
    toast(t('saved')); m.close(); App.render();
  };
  $('#qa-save', r).onclick = save;
  form.addEventListener('submit', e => { e.preventDefault(); save(); });
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); save(); }
  });
}

function searchIndex() {
  const out = [];
  Store.all('sources').forEach(s => out.push({ kind: t('qa_source'), title: sourceLabel(s) + ' — ' + s.title, href: '#/source/' + s.id,
    hay: [s.title, Cite.namesToString(s.authors), s.year, s.container, (s.tags || []).join(' '), s.findings, s.framework, s.method, s.context, s.abstract, s.strengths, s.limitations, s.use, (s.quotes || []).map(q => q.text + ' ' + q.note).join(' '), Object.values(s.themes || {}).join(' ')].join(' ') }));
  Store.all('projects').forEach(p => out.push({ kind: t('nav_projects'), title: p.title, href: '#/projects', hay: [p.title, p.goal, p.outlet, p.collaborators, p.nextAction, p.notes].join(' ') }));
  Store.all('tasks').forEach(x => out.push({ kind: t('qa_task'), title: x.title, href: '#/dashboard', hay: x.title }));
  Store.all('notes').forEach(n => out.push({ kind: t('nk_' + n.kind), title: Links.noteTitle(n), href: '#/journal/' + n.id, hay: [n.title, n.body, n.decision.what, n.decision.why, n.decision.alternatives, n.feedback.who, n.feedback.response, (n.tags || []).join(' ')].join(' ') }));
  Store.all('milestones').forEach(m => out.push({ kind: t('ms_title'), title: m.title + (m.due ? ' · ' + fmtDate(m.due) : ''), href: '#/projects/milestones', hay: [m.title, m.notes, projectName(m.projectId)].join(' ') }));
  Store.all('writingLogs').forEach(l => l.note && out.push({ kind: t('nav_writing'), title: `${fmtDate(l.date)} · ${projectName(l.projectId)} · ${l.words}`, href: '#/writing', hay: l.note }));
  Store.all('events').forEach(e => out.push({ kind: t('ek_' + e.kind), title: `${e.title} · ${fmtDate(e.date)}${e.recur !== 'none' ? ' ↻' : ''}`, href: '#/calendar/week?d=' + e.date, hay: [e.title, e.location, e.notes].join(' ') }));
  Store.all('meetings').forEach(m => out.push({ kind: t('ek_meeting'), title: `${meetingTitle(m)} · ${fmtDate(m.date)}`, href: '#/meetings/' + m.id, hay: [m.with, m.notes, (m.agenda || []).map(a => a.text).join(' '), (m.decisions || []).map(a => a.text).join(' '), (m.actions || []).map(a => a.text).join(' ')].join(' ') }));
  Store.all('records').filter(r => !['hours'].includes(r.kind)).forEach(r => out.push({ kind: ['check', 'storage'].includes(r.kind) ? t('rt_ethics') : t('rk_' + r.kind), title: r.title || r.text || r.vendor || r.dataType || r.code || '', href: '#/records/' + ({ check: 'ethics', storage: 'ethics', course: 'courses', contract: 'work', receipt: 'receipts', document: 'documents' }[r.kind] || 'ethics'), hay: [r.title, r.text, r.note, r.notes, r.vendor, r.location, r.code, r.dataType].join(' ') }));
  Store.all('cvItems').forEach(c => out.push({ kind: t('rt_cv'), title: c.title, href: '#/records/cv', hay: [c.title, c.org, c.details].join(' ') }));
  Store.all('cards').forEach(c => out.push({ kind: t('nav_cards'), title: c.front.slice(0, 100), href: '#/cards/browse', hay: c.front + ' ' + c.back }));
  Store.all('reviews').forEach(r => out.push({ kind: t('rvt_' + r.kind), title: r.period, href: r.kind === 'weekly' ? '#/reviews/weekly?w=' + r.period : r.kind === 'monthly' ? '#/reviews/monthly?m=' + r.period : '#/reviews/term?t=' + r.period, hay: [r.wins, r.blockers, r.lessons, r.plan, r.text, r.proud, r.struggled, r.learned, r.change, r.goals].join(' ') }));
  Store.all('claims').forEach(c => out.push({ kind: t('ct_' + c.type), title: c.text.slice(0, 100), href: '#/argument/' + c.id, hay: [c.text, c.chapter, c.notes, (c.evidence || []).map(e => e.comment).join(' ')].join(' ') }));
  Store.all('deadlines').forEach(d => out.push({ kind: t('qa_deadline'), title: d.title + ' · ' + fmtDate(d.due), href: '#/projects', hay: d.title + ' ' + (d.notes || '') }));
  Store.all('themes').forEach(th => out.push({ kind: t('matrix'), title: th.name, href: '#/library/matrix', hay: th.name }));
  return out;
}
function openSearch() {
  const idx = searchIndex();
  const m = modal({ title: t('search'), body: `<input id="sq" type="search" placeholder="${esc(t('searchPlaceholder'))}" autofocus><div class="search-results" id="sr"></div>` });
  const r = m.root, input = $('#sq', r), box = $('#sr', r);
  let results = [], sel = 0;
  const snippet = (hay, terms) => {
    const low = hay.toLowerCase(); const i = low.indexOf(terms[0]); if (i < 0) return '';
    const s = Math.max(0, i - 50); return (s ? '…' : '') + hay.slice(s, i + 90).replace(/\s+/g, ' ') + '…';
  };
  const draw = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    results = terms.length ? idx.filter(x => { const h = (x.kind + ' ' + x.title + ' ' + x.hay).toLowerCase(); return terms.every(tm => h.includes(tm)); }).slice(0, 40) : [];
    sel = 0;
    box.innerHTML = results.map((x, i) => `<a href="${x.href}" class="${i === sel ? 'sel' : ''}" data-i="${i}"><span class="kind">${esc(x.kind)}</span><br>${esc(x.title)}<div class="small muted">${esc(snippet(x.hay, terms))}</div></a>`).join('')
      || (terms.length ? `<p class="empty" style="padding:8px 18px">${esc(t('noResults'))}</p>` : '');
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!results.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      box.querySelectorAll('a').forEach((a, i) => a.classList.toggle('sel', i === sel));
      box.querySelectorAll('a')[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && results[sel]) { location.hash = results[sel].href; m.close(); }
  });
  box.addEventListener('click', e => { if (e.target.closest('a')) m.close(); });
}

function openAIModal(sourceId) {
  const others = Store.all('sources').slice().sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b)));
  const m = modal({
    title: t('aiTitle'), wide: true,
    body: `<p class="small" style="color:var(--ai)">${esc(t('aiRules'))}</p>
      <label class="field"><span>${esc(t('aiStep1'))}</span><textarea id="ai-text" rows="7" autofocus></textarea></label>
      <div class="row"><span class="small muted" style="flex:1">${esc(t('aiStep2'))}</span><button class="btn ai" id="ai-copy">${esc(t('copyPrompt'))}</button></div>
      <label class="field"><span>${esc(t('aiStep3'))}</span><textarea id="ai-reply" rows="7" class="prompt-box" placeholder='{ "type": "article", … }'></textarea></label>
      <label class="field"><span>${esc(t('mergeInto'))}</span><select id="ai-target"><option value="">${esc(t('newSourceOpt'))}</option>${options(others.map(s => s.id), sourceId || '', id => { const s = Store.get('sources', id); return sourceLabel(s) + ' — ' + (s.title || '').slice(0, 60); })}</select></label>`,
    foot: `<button class="btn" id="ai-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ai-create">${esc(t('createDraft'))}</button>`,
  });
  const r = m.root;
  if (sourceId) { const s = Store.get('sources', sourceId); if (s && s.abstract) $('#ai-text', r).value = s.abstract; }
  $('#ai-cancel', r).onclick = m.close;
  $('#ai-copy', r).onclick = () => { const txt = $('#ai-text', r).value; if (!txt.trim()) { $('#ai-text', r).focus(); return; } copyText(AI.sourcePrompt(txt)); };
  $('#ai-create', r).onclick = () => {
    const text = $('#ai-text', r).value, reply = $('#ai-reply', r).value;
    let obj; try { obj = AI.parseReply(reply); } catch { toast(t('aiParseError'), 3500); return; }
    let target = $('#ai-target', r).value ? Store.get('sources', $('#ai-target', r).value) : null;
    const doi = Cite.doi(obj.doi || '').toLowerCase();
    if (!target && doi) { target = Store.all('sources').find(s => Cite.doi(s.doi).toLowerCase() === doi) || null; if (target) toast(t('duplicateDoi'), 3500); }
    if (target) { AI.applyToSource(target, obj, text); target.updatedAt = new Date().toISOString(); Store.change(); }
    else { target = AI.applyToSource(newSource(), obj, text); Store.add('sources', target); }
    m.close(); location.hash = '#/source/' + target.id; App.render();
  };
}
