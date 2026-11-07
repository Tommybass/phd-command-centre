/* Supervisor and meeting log: agenda builder, notes, decisions, action items, one-click progress update */
const MeetingsView = {
  render(params) {
    const id = params[0];
    const M = Store.all('meetings').slice().sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
    const openActs = M.flatMap(m => (m.actions || []).map(a => ({ m, a }))).filter(x => !actionDone(x.a));
    const list = M.map(m => {
      const open = (m.actions || []).filter(a => !actionDone(a)).length;
      const upcoming = m.date >= todayISO();
      return `<a class="feed-item ${m.id === id ? 'sel' : ''}" href="#/meetings/${m.id}"><span class="kind-ico ${upcoming ? 'k-idea' : 'k-feedback'}">${upcoming ? '◷' : '✓'}</span>
        <span class="grow"><strong class="ft">${esc(meetingTitle(m))}</strong><span class="small muted">${esc(fmtDate(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(m.time || '')}${m.projectId ? ' · ' + esc(projectName(m.projectId)) : ''}</span>
        ${open ? `<span class="row small"><span class="pill warn">${open} ${esc(t('openActions'))}</span></span>` : ''}</span></a>`;
    }).join('');
    const sel = id && Store.get('meetings', id);
    const left = `<div class="journal-list">
      ${openActs.length ? `<div class="card" style="margin-bottom:10px"><h3 class="small muted">${esc(t('allOpenActions'))} (${openActs.length})</h3><ul class="list small">${openActs.slice(0, 6).map(x => `<li><span class="pill ${x.a.owner === 'me' ? 'accent' : ''}">${esc(ownerLabel(x.a.owner))}</span><a class="grow" href="#/meetings/${x.m.id}" style="color:var(--text)">${esc(x.a.text)}</a>${x.a.due ? dueBadge(x.a.due) || `<span class="faint">${esc(fmtDate(x.a.due, { day: 'numeric', month: 'short' }))}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
      <div class="feed">${list || `<p class="empty">${esc(t('noMeetings'))}</p>`}</div></div>`;
    return `<div class="page-head"><div><h1>${esc(t('nav_meetings'))}</h1><p class="sub">${esc(t('meetingsSub'))}</p></div><span class="spacer"></span>
        <button class="btn primary" data-action="new-meeting">+ ${esc(t('newMeeting'))}</button></div>
      <div class="journal ${sel ? 'has-sel' : ''}">${left}<div class="journal-editor">${sel ? this.editor(sel) : `<div class="card empty hide-mobile">${esc(t('pickMeeting'))}</div>`}</div></div>`;
  },

  editor(m) {
    const P = Store.all('projects');
    const people = uniq(Store.all('meetings').flatMap(x => (x.with || '').split(/[;,]/).map(s => s.trim())).filter(Boolean));
    return `<div class="card">
      <div class="row" style="margin-bottom:10px"><a class="btn ghost small show-mobile" href="#/meetings">← ${esc(t('back'))}</a><span class="spacer"></span>
        <button class="btn ai" data-action="progress">✦ ${esc(t('progressUpdate'))}</button><button class="btn ghost small danger" data-action="del">${esc(t('delete'))}</button></div>
      <div class="grid g4">
        <label class="field"><span>${esc(t('d_kind'))}</span><select data-mf="kind">${options(MEETING_KINDS, m.kind, k => t('mk_' + k))}</select></label>
        <label class="field span2"><span>${esc(t('with'))}</span><input data-mf="with" value="${esc(m.with)}" list="mt-people" placeholder="${esc(t('withHint'))}"><datalist id="mt-people">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist></label>
        <label class="field"><span>${esc(t('t_project'))}</span><select data-mf="projectId"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), m.projectId, projectName)}</select></label>
        <label class="field"><span>${esc(t('date'))}</span><input type="date" data-mf="date" value="${esc(m.date)}"></label>
        <label class="field"><span>${esc(t('ms_start'))}</span><input type="time" data-mf="time" value="${esc(m.time)}" step="900"></label>
        <label class="field"><span>${esc(t('minutes'))}</span><input type="number" min="10" step="5" data-mf="duration" value="${esc(m.duration)}"></label>
        <label class="field"><span>${esc(t('nextMeeting'))}</span><input type="date" data-mf="nextDate" value="${esc(m.nextDate)}"></label>
      </div>

      <h3 class="sec-h">${esc(t('agenda'))} <button class="btn small" data-action="suggest-agenda">✦ ${esc(t('suggestAgenda'))}</button></h3>
      <ul class="list agenda">${(m.agenda || []).map((a, i) => `<li><input type="checkbox" class="check" data-ag="${i}" data-agk="done" ${a.done ? 'checked' : ''} aria-label="${esc(t('covered'))}"><input class="grow inline-input ${a.done ? 'done-text' : ''}" data-ag="${i}" data-agk="text" value="${esc(a.text)}">
        <button class="btn ghost small" data-action="ag-up" data-i="${i}" aria-label="${esc(t('moveUp'))}">↑</button><button class="btn ghost small danger" data-action="ag-del" data-i="${i}" aria-label="${esc(t('delete'))}">✕</button></li>`).join('')}</ul>
      <form class="row" data-form="agenda"><input name="text" placeholder="${esc(t('addAgenda'))}" style="flex:1"><button class="btn">+</button></form>

      <h3 class="sec-h">${esc(t('meetingNotes'))}</h3>
      <textarea class="mt-notes" data-mf="notes" rows="8" placeholder="${esc(t('meetingNotesHint'))}">${esc(m.notes)}</textarea>

      <h3 class="sec-h">${esc(t('decisions'))}</h3>
      <ul class="list">${(m.decisions || []).map((dc, i) => `<li><span class="kind-ico k-decision">⚖</span><input class="grow inline-input" data-dec="${i}" value="${esc(dc.text)}">
        ${dc.noteId ? `<a class="pill ok" href="#/journal/${dc.noteId}">${esc(t('inLog'))}</a>` : `<button class="btn small" data-action="dec-log" data-i="${i}">→ ${esc(t('jt_decisions'))}</button>`}
        <button class="btn ghost small danger" data-action="dec-del" data-i="${i}" aria-label="${esc(t('delete'))}">✕</button></li>`).join('')}</ul>
      <form class="row" data-form="decision"><input name="text" placeholder="${esc(t('addDecision'))}" style="flex:1"><button class="btn">+</button></form>

      <h3 class="sec-h">${esc(t('actionItems'))}</h3>
      <div class="table-wrap"><table><thead><tr><th></th><th>${esc(t('action'))}</th><th>${esc(t('owner'))}</th><th>${esc(t('t_due'))}</th><th></th></tr></thead><tbody>
      ${(m.actions || []).map((a, i) => `<tr><td><input type="checkbox" data-act="${i}" data-actk="done" ${actionDone(a) ? 'checked' : ''}></td><td><input class="inline-input ${actionDone(a) ? 'done-text' : ''}" data-act="${i}" data-actk="text" value="${esc(a.text)}"></td>
        <td><input class="inline-input" data-act="${i}" data-actk="owner" value="${esc(ownerLabel(a.owner))}" list="mt-owners" style="min-width:90px"></td><td><input type="date" data-act="${i}" data-actk="due" value="${esc(a.due)}"></td>
        <td style="white-space:nowrap">${a.taskId ? `<span class="pill accent" title="${esc(t('linkedTask'))}">✓ ${esc(t('qa_task'))}</span>` : ''}<button class="btn ghost small danger" data-action="act-del" data-i="${i}" aria-label="${esc(t('delete'))}">✕</button></td></tr>`).join('')}
      </tbody></table></div><datalist id="mt-owners"><option value="${esc(t('ownerMe'))}">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <form class="row" data-form="action" style="margin-top:8px"><input name="text" placeholder="${esc(t('addAction'))}" style="flex:2;min-width:180px"><input name="owner" list="mt-owners" value="${esc(t('ownerMe'))}" style="flex:1;min-width:100px"><input type="date" name="due" style="width:auto"><button class="btn">+</button></form>
      <p class="small faint">${esc(t('actionHint'))}</p>

      ${m.update ? `<h3 class="sec-h">${esc(t('progressUpdate'))}</h3><div class="note-preview card" style="background:var(--surface-2)">${Links.render(m.update)}</div>` : ''}
      ${m.nextDate ? `<div class="row" style="margin-top:14px"><button class="btn" data-action="create-next">${esc(t('createNext', { d: fmtDate(m.nextDate) }))}</button></div>` : ''}
    </div>`;
  },

  bind(root, params) {
    const id = params[0];
    const m = () => Store.get('meetings', id);
    const ta = $('.mt-notes', root); if (ta) Links.autocomplete(ta);
    const touch = () => { m().updatedAt = new Date().toISOString(); Store.change(); };
    root.addEventListener('input', e => {
      const el = e.target; if (!m()) return;
      if (el.dataset.mf && el.tagName !== 'SELECT' && el.type !== 'date' && el.type !== 'time') { m()[el.dataset.mf] = el.dataset.mf === 'duration' ? Number(el.value) : el.value; touch(); }
      else if (el.dataset.ag !== undefined && el.dataset.agk === 'text') { m().agenda[Number(el.dataset.ag)].text = el.value; touch(); }
      else if (el.dataset.dec !== undefined) { m().decisions[Number(el.dataset.dec)].text = el.value; touch(); }
      else if (el.dataset.act !== undefined && el.dataset.actk === 'text') { const a = m().actions[Number(el.dataset.act)]; a.text = el.value; syncActionTask(m(), a); touch(); }
    });
    root.addEventListener('change', e => {
      const el = e.target; if (!m()) return;
      if (el.dataset.mf && (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time')) { m()[el.dataset.mf] = el.value; touch(); App.render(); }
      else if (el.dataset.ag !== undefined && el.dataset.agk === 'done') { m().agenda[Number(el.dataset.ag)].done = el.checked; touch(); App.render(); }
      else if (el.dataset.act !== undefined) {
        const a = m().actions[Number(el.dataset.act)], k = el.dataset.actk;
        if (k === 'done') { a.done = el.checked; if (a.taskId) { const tk = Store.get('tasks', a.taskId); if (tk) { tk.done = el.checked; tk.doneAt = el.checked ? todayISO() : ''; } } }
        else if (k === 'owner') a.owner = parseOwner(el.value);
        else if (k === 'due') a.due = el.value;
        syncActionTask(m(), a); touch(); App.render();
      }
    });
    root.addEventListener('submit', e => {
      const f = e.target.dataset.form; if (!f || !m()) return; e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries()); const text = (fd.text || '').trim(); if (!text) return;
      if (f === 'agenda') m().agenda.push({ text, done: false });
      if (f === 'decision') m().decisions.push({ text, noteId: '' });
      if (f === 'action') { const a = { id: uid('a_'), text, owner: parseOwner(fd.owner), due: fd.due || '', done: false, taskId: '' }; m().actions.push(a); syncActionTask(m(), a); }
      touch(); App.render(); setTimeout(() => { const i = $(`[data-form="${f}"] input[name="text"]`); i && i.focus(); }, 0);
    });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action, mm = m(), i = Number(a.dataset.i);
      if (act === 'new-meeting') { const nm = Store.add('meetings', newMeeting({})); location.hash = '#/meetings/' + nm.id; return; }
      if (!mm) return;
      if (act === 'del') { if (confirmBox(t('delete') + ': ' + meetingTitle(mm) + '?')) { Store.remove('meetings', mm.id); location.hash = '#/meetings'; } }
      else if (act === 'ag-del') { mm.agenda.splice(i, 1); touch(); App.render(); }
      else if (act === 'ag-up' && i > 0) { [mm.agenda[i - 1], mm.agenda[i]] = [mm.agenda[i], mm.agenda[i - 1]]; touch(); App.render(); }
      else if (act === 'dec-del') { mm.decisions.splice(i, 1); touch(); App.render(); }
      else if (act === 'act-del') { const x = mm.actions[i]; if (x.taskId && confirmBox(t('alsoDeleteTask'))) Store.remove('tasks', x.taskId); mm.actions.splice(i, 1); touch(); App.render(); }
      else if (act === 'dec-log') {
        const dc = mm.decisions[i];
        const n = newNote({ kind: 'decision', date: mm.date, title: dc.text.slice(0, 80), body: `${t('fromMeeting')}: ${meetingTitle(mm)}, ${fmtDate(mm.date)}`, projects: mm.projectId ? [mm.projectId] : [], decision: { what: dc.text, why: '', alternatives: '' } });
        Links.refresh(n); Store.add('notes', n); dc.noteId = n.id; touch(); toast(t('addedToLog')); App.render();
      }
      else if (act === 'suggest-agenda') agendaModal(mm);
      else if (act === 'progress') progressModal(mm);
      else if (act === 'create-next') {
        const carry = (mm.actions || []).filter(x => !actionDone(x)).map(x => ({ text: `${t('followUp')}: ${x.text} (${ownerLabel(x.owner)})`, done: false }));
        const nm = Store.add('meetings', newMeeting({ date: mm.nextDate, time: mm.time, duration: mm.duration, with: mm.with, kind: mm.kind, projectId: mm.projectId, agenda: [{ text: t('progressSince'), done: false }, ...carry] }));
        location.hash = '#/meetings/' + nm.id;
      }
    });
  },
};

function newMeeting(o) { return Object.assign({ date: todayISO(), time: '10:00', duration: 60, with: '', kind: 'supervisor', projectId: (Store.all('projects').find(p => p.area === 'thesis') || {}).id || '', agenda: [], notes: '', decisions: [], actions: [], nextDate: '', update: '' }, o); }
function ownerLabel(o) { return o === 'me' ? t('ownerMe') : (o || ''); }
function parseOwner(v) { v = String(v || '').trim(); return !v || ['me', 'moi', t('ownerMe').toLowerCase()].includes(v.toLowerCase()) ? 'me' : v; }
function actionDone(a) { if (a.taskId) { const tk = Store.get('tasks', a.taskId); if (tk) return !!tk.done; } return !!a.done; }
/* My action items become tasks automatically (and stay in sync) */
function syncActionTask(m, a) {
  if (a.owner === 'me') {
    const tk = a.taskId && Store.get('tasks', a.taskId);
    if (tk) Object.assign(tk, { title: a.text, due: a.due, done: !!a.done });
    else { const n = Store.add('tasks', { title: a.text, projectId: m.projectId || '', due: a.due, energy: '', top: false, done: !!a.done, meetingId: m.id }); a.taskId = n.id; }
  } else if (a.taskId) { Store.remove('tasks', a.taskId); a.taskId = ''; }
}
function previousMeeting(m) {
  return Store.all('meetings').filter(x => x.id !== m.id && x.date < m.date && x.kind === m.kind && (!m.with || x.with === m.with)).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function agendaModal(m) {
  const prev = previousMeeting(m), items = [];
  items.push({ text: t('progressSince'), on: true });
  if (prev) (prev.actions || []).filter(a => !actionDone(a)).forEach(a => items.push({ text: `${t('followUp')}: ${a.text} (${ownerLabel(a.owner)})`, on: true }));
  Plan.warnings().filter(w => !m.projectId || w.m.projectId === m.projectId).slice(0, 4).forEach(w => items.push({ text: `${t('lvl_' + w.h.level)}: ${w.m.title} — ${w.h.msg}`, on: true }));
  Store.all('claims').filter(c => Arg.status(c) === 'missing').slice(0, 3).forEach(c => items.push({ text: `${t('askSupport')}: “${c.text.slice(0, 90)}”`, on: false }));
  Store.all('notes').filter(n => (n.tags || []).some(x => /^(ask|supervisor|question|q)$/i.test(x)) && n.date >= (prev ? prev.date : addDays(todayISO(), -60))).forEach(n => items.push({ text: `${t('question')}: ${Links.noteTitle(n)}`, on: true }));
  Store.all('notes').filter(n => n.kind === 'feedback' && n.date >= (prev ? prev.date : addDays(todayISO(), -60))).forEach(n => items.push({ text: `${t('fbFollowUp')}: ${Links.noteTitle(n)}`, on: false }));
  const have = new Set((m.agenda || []).map(a => a.text));
  const list = items.filter(x => !have.has(x.text));
  const md = modal({
    title: t('suggestAgenda'), wide: true,
    body: `<p class="small muted">${esc(prev ? t('agendaFrom', { d: fmtDate(prev.date) }) : t('agendaNoPrev'))} ${esc(t('agendaTagHint'))}</p>
      ${list.length ? list.map((x, i) => `<label class="row"><input type="checkbox" data-i="${i}" ${x.on ? 'checked' : ''}> ${esc(x.text)}</label>`).join('') : `<p class="empty">—</p>`}`,
    foot: `<button class="btn" id="ag-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ag-ok">${esc(t('addSelected'))}</button>`,
  });
  $('#ag-cancel', md.root).onclick = md.close;
  $('#ag-ok', md.root).onclick = () => { $$('[data-i]:checked', md.root).forEach(c => m.agenda.push({ text: list[Number(c.dataset.i)].text, done: false })); Store.change(); md.close(); App.render(); };
}

/* One-click progress update since the previous meeting of the same kind with the same person */
function progressUpdate(m) {
  const prev = previousMeeting(m);
  const since = prev ? prev.date : addDays(m.date, -30), until = m.date > todayISO() ? todayISO() : m.date;
  const inRange = d => d && d >= since && d <= until;
  const L = [`# ${t('progressUpdate')} — ${m.with || t('mk_' + m.kind)} — ${fmtDate(m.date)}`, '', `_${t('period')}: ${fmtDate(since)} – ${fmtDate(until)}_`, ''];
  const done = Store.all('tasks').filter(x => x.done && inRange(x.doneAt));
  const msDone = Store.all('milestones').filter(x => x.status === 'done' && inRange((x.updatedAt || '').slice(0, 10)));
  L.push(`## ${t('puDone')}`);
  if (msDone.length) msDone.forEach(x => L.push(`- ◆ ${x.title} (${projectName(x.projectId)})`));
  done.slice(0, 20).forEach(x => L.push(`- ${x.title}${x.projectId ? ` — ${projectName(x.projectId)}` : ''}`));
  if (!done.length && !msDone.length) L.push(`- ${t('puNone')}`);
  const active = Store.all('milestones').filter(x => x.status !== 'done' && (!m.projectId || x.projectId === m.projectId) && (x.start || '') <= until).slice(0, 6);
  if (active.length) { L.push('', `## ${t('puMilestones')}`); active.forEach(x => { const h = Plan.health(x); L.push(`- ${x.title}: ${Plan.progress(x)}% · ${t('lvl_' + h.level)}${h.level !== 'ok' ? ' — ' + h.msg : ''}`); }); }
  const reads = Store.all('sources').flatMap(s => (s.passLog || []).filter(l => inRange(l.date)).map(l => ({ s, l })));
  if (reads.length) { L.push('', `## ${t('puReading')}`, `- ${t('puPasses', { n: reads.length })}`); uniq(reads.map(r => r.s)).slice(0, 12).forEach(s => L.push(`  - ${sourceLabel(s)} — ${t('st_' + sourceStatus(s))}`)); }
  const wl = Store.all('writingLogs').filter(w => inRange(w.date));
  if (wl.length) {
    L.push('', `## ${t('nav_writing')}`, `- ${t('puWords', { n: wl.reduce((s, w) => s + w.words, 0).toLocaleString() })}`);
    uniq(wl.map(w => w.projectId)).forEach(pid => { const p = Store.get('projects', pid); if (p) L.push(`  - ${p.title}: +${wl.filter(w => w.projectId === pid).reduce((s, w) => s + w.words, 0).toLocaleString()}${p.wordGoal ? ` (${(p.wordCount || 0).toLocaleString()} / ${p.wordGoal.toLocaleString()})` : ''}`); });
  }
  const tl = Store.all('timeLogs').filter(l => inRange(l.start.slice(0, 10)));
  if (tl.length) { L.push('', `## ${t('puTime')}`); const by = {}; tl.forEach(l => { const k = projectName(l.projectId) || t('area_' + l.area); by[k] = (by[k] || 0) + l.minutes; }); Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`- ${k}: ${(v / 60).toFixed(1)} h`)); }
  const notes = Store.all('notes').filter(n => inRange(n.date) && ['decision', 'idea', 'reflexive'].includes(n.kind));
  if (notes.length) { L.push('', `## ${t('puJournal')}`); notes.slice(0, 10).forEach(n => L.push(`- ${t('nk_' + n.kind)}: ${n.kind === 'decision' && n.decision.what ? n.decision.what : Links.noteTitle(n)}`)); }
  if (Store.all('claims').length) { const c = { strong: 0, thin: 0, missing: 0 }; Store.all('claims').forEach(x => c[Arg.status(x)]++); L.push('', `## ${t('nav_argument')}`, `- ${c.strong} ${t('as_strong')} · ${c.thin} ${t('as_thin')} · ${c.missing} ${t('as_missing')}`); }
  if (prev && (prev.actions || []).length) { L.push('', `## ${t('puActions', { d: fmtDate(prev.date) })}`); prev.actions.forEach(a => L.push(`- [${actionDone(a) ? 'x' : ' '}] ${a.text} (${ownerLabel(a.owner)})`)); }
  const nextEnd = addDays(todayISO(), 21);
  const nxt = [...Store.all('milestones').filter(x => x.status !== 'done' && x.due && x.due >= todayISO() && x.due <= nextEnd).map(x => `◆ ${x.title} — ${fmtDate(x.due)}`),
    ...Store.all('tasks').filter(x => !x.done && x.due && x.due >= todayISO() && x.due <= nextEnd && (!m.projectId || x.projectId === m.projectId)).slice(0, 8).map(x => `${x.title} — ${fmtDate(x.due)}`)];
  if (nxt.length) { L.push('', `## ${t('puNext')}`); nxt.forEach(x => L.push(`- ${x}`)); }
  const qs = (m.agenda || []).filter(a => !a.done && !a.text.startsWith(t('progressSince')));
  if (qs.length) { L.push('', `## ${t('puInput')}`); qs.forEach(a => L.push(`- ${a.text}`)); }
  return L.join('\n');
}
function progressModal(m) {
  const text = progressUpdate(m);
  const md = modal({
    title: t('progressUpdate'), wide: true,
    body: `<p class="small muted">${esc(t('puHelp'))}</p><textarea id="pu-text" class="prompt-box" rows="18">${esc(text)}</textarea>`,
    foot: `<button class="btn ai" id="pu-prompt">✎ ${esc(t('puPrompt'))}</button><span class="spacer"></span><button class="btn" id="pu-dl">⇩ .md</button><button class="btn" id="pu-copy">${esc(t('copy'))}</button><button class="btn primary" id="pu-save">${esc(t('puSave'))}</button>`,
  });
  const r = md.root, val = () => $('#pu-text', r).value;
  $('#pu-copy', r).onclick = () => copyText(val());
  $('#pu-dl', r).onclick = () => download(`progress-update-${m.date}.md`, val(), 'text/markdown');
  $('#pu-save', r).onclick = () => { Store.update('meetings', m.id, { update: val() }); md.close(); App.render(); };
  $('#pu-prompt', r).onclick = () => copyText(`Turn these notes into a short, warm and professional progress update email to my ${m.kind === 'supervisor' ? 'doctoral supervisor' : t('mk_' + m.kind).toLowerCase()}${m.with ? ' (' + m.with + ')' : ''} before our meeting. Keep every fact exactly as given; do not add achievements, numbers or sources. Group by theme, keep it under 250 words, end with the questions where I need input. Canadian English spelling.\n\n${val()}`);
}
