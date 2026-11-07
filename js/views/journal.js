/* Research journal and linked notes */
const JState = (() => {
  let s = { kind: '', project: '', q: '' };
  try { Object.assign(s, JSON.parse(localStorage.getItem('phdcc.journal') || '{}')); } catch { }
  return s;
})();
function saveJState() { try { localStorage.setItem('phdcc.journal', JSON.stringify(JState)); } catch { } }

const KIND_ICON = { inbox: '⇣', idea: '✦', decision: '⚖', reflexive: '◐', feedback: '✉', note: '¶' };
const KIND_HINT = {
  idea: 'hint_idea', decision: 'hint_decision', reflexive: 'hint_reflexive', feedback: 'hint_feedback', note: 'hint_note', inbox: 'hint_inbox',
};

const JournalView = {
  filtered() {
    const q = JState.q.toLowerCase();
    return Store.all('notes').filter(n =>
      (!JState.kind || n.kind === JState.kind) &&
      (!JState.project || (n.projects || []).includes(JState.project)) &&
      (!q || [n.title, n.body, n.decision.what, n.decision.why, n.decision.alternatives, n.feedback.who, n.feedback.response, (n.tags || []).join(' ')].join(' ').toLowerCase().includes(q))
    ).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
  },

  render(params, query) {
    const tab = query.tab || 'entries';
    const id = params[0];
    const tabs = ['entries', 'decisions', 'feedback'].map(k => `<a class="tab ${tab === k ? 'active' : ''}" href="#/journal?tab=${k}">${esc(t('jt_' + k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_journal'))}</h1><p class="sub">${esc(t('journalSub'))}</p></div><span class="spacer"></span>
      <div class="row"><button class="btn primary" data-action="new-note">+ ${esc(t('newEntry'))}</button>
      <button class="btn small" data-action="export-md">⇩ ${esc(t('exportMd'))}</button></div></div><nav class="tabs">${tabs}</nav>`;
    if (tab === 'decisions') return head + this.decisionTable();
    if (tab === 'feedback') return head + this.feedbackTable();

    const list = this.filtered();
    const counts = {}; Store.all('notes').forEach(n => counts[n.kind] = (counts[n.kind] || 0) + 1);
    const projects = Store.all('projects');
    const filters = `<div class="chip-row" style="margin-bottom:8px">
        <button class="chip ${!JState.kind ? 'on' : ''}" data-kind="">${esc(t('allKinds'))}<span class="n">${Store.all('notes').length}</span></button>
        ${NOTE_KINDS.map(k => `<button class="chip ${JState.kind === k ? 'on' : ''}" data-kind="${k}">${KIND_ICON[k]} ${esc(t('nk_' + k))}<span class="n">${counts[k] || 0}</span></button>`).join('')}</div>
      <div class="filters"><input type="search" data-jfilter="q" value="${esc(JState.q)}" placeholder="${esc(t('filterText'))}">
        <select data-jfilter="project"><option value="">${esc(t('anyProject'))}</option>${options(projects.map(p => p.id), JState.project, projectName)}</select></div>`;
    let lastDate = '';
    const feed = list.map(n => {
      const dh = n.date !== lastDate ? `<div class="feed-date">${esc(fmtDate(n.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</div>` : '';
      lastDate = n.date;
      const snippet = (n.kind === 'decision' && n.decision.what) ? n.decision.what : (n.body || '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ');
      return `${dh}<a class="feed-item ${n.id === id ? 'sel' : ''}" href="#/journal/${n.id}" data-id="${n.id}">
        <span class="kind-ico k-${n.kind}" title="${esc(t('nk_' + n.kind))}">${KIND_ICON[n.kind]}</span>
        <span class="grow"><strong class="ft">${esc(Links.noteTitle(n))}</strong><span class="small muted fs">${esc(snippet.slice(0, 110))}</span>
        <span class="row small">${(n.projects || []).map(p => `<span class="pill accent">${esc(projectName(p))}</span>`).join('')}${(n.links || []).length ? `<span class="faint">↗ ${n.links.length}</span>` : ''}${Links.backlinks(n.id).length ? `<span class="faint">↙ ${Links.backlinks(n.id).length}</span>` : ''}</span></span></a>`;
    }).join('');
    const left = `<div class="journal-list">${filters}<div class="feed">${feed || `<p class="empty">${esc(t('noEntries'))}</p>`}</div></div>`;
    const n = id && Store.get('notes', id);
    const right = n ? this.editor(n) : `<div class="card empty hide-mobile">${esc(t('pickEntry'))}</div>`;
    return head + `<div class="journal ${n ? 'has-sel' : ''}">${left}<div class="journal-editor">${right}</div></div>`;
  },

  editor(n) {
    const projects = Store.all('projects');
    const back = Links.backlinks(n.id);
    const claims = Store.all('claims').filter(c => (c.evidence || []).some(e => e.id === n.id));
    const kindFields = n.kind === 'decision' ? `<div class="grid">
        <label class="field"><span>${esc(t('dec_what'))}</span><textarea data-sub="decision.what" rows="2">${esc(n.decision.what)}</textarea></label>
        <label class="field"><span>${esc(t('dec_why'))}</span><textarea data-sub="decision.why" rows="3">${esc(n.decision.why)}</textarea></label>
        <label class="field"><span>${esc(t('dec_alt'))}</span><textarea data-sub="decision.alternatives" rows="2">${esc(n.decision.alternatives)}</textarea></label></div>`
      : n.kind === 'feedback' ? `<div class="grid g2">
        <label class="field"><span>${esc(t('fb_from'))}</span><select data-sub="feedback.from">${options(FEEDBACK_FROM, n.feedback.from, v => t('fb_' + v))}</select></label>
        <label class="field"><span>${esc(t('fb_who'))}</span><input data-sub="feedback.who" value="${esc(n.feedback.who)}"></label>
        <label class="field span-all"><span>${esc(t('fb_response'))}</span><textarea data-sub="feedback.response" rows="3" placeholder="- ${esc(t('fb_respHint'))}">${esc(n.feedback.response)}</textarea></label>
        <div class="span-all"><button class="btn small" data-action="to-tasks">${esc(t('fb_toTasks'))}</button></div></div>` : '';
    return `<div class="card">
      <div class="row" style="margin-bottom:10px"><a class="btn ghost small show-mobile" href="#/journal">← ${esc(t('back'))}</a>
        <select data-nf="kind" style="width:auto">${options(NOTE_KINDS, n.kind, k => KIND_ICON[k] + ' ' + t('nk_' + k))}</select>
        <input type="date" data-nf="date" value="${esc(n.date)}" style="width:auto">
        <span class="spacer"></span>
        <button class="btn small" data-action="toggle-preview" aria-pressed="false">${esc(t('preview'))}</button>
        <button class="btn ghost small danger" data-action="del-note">${esc(t('delete'))}</button></div>
      <input class="note-title" data-nf="title" value="${esc(n.title)}" placeholder="${esc(t('noteTitle'))}">
      <p class="small faint" style="margin:6px 0">${esc(t(KIND_HINT[n.kind]))}</p>
      <textarea class="note-body" data-nf="body" rows="10" placeholder="${esc(t('noteBodyHint'))}">${esc(n.body)}</textarea>
      <div class="note-preview" id="note-preview" hidden></div>
      ${kindFields}
      <div class="grid g2" style="margin-top:12px">
        <div class="field span-all"><span class="small muted">${esc(t('f_projects'))}</span><div class="chip-row" style="margin-top:4px">
          ${projects.map(p => `<button type="button" class="chip ${(n.projects || []).includes(p.id) ? 'on' : ''}" data-action="toggle-project" data-id="${p.id}">${esc(p.title)}</button>`).join('')}</div></div>
        <label class="field span-all"><span>${esc(t('f_tags'))} (${esc(t('commaHint'))})</span><input data-nlist="tags" value="${esc((n.tags || []).join(', '))}"></label>
      </div>
      <div class="grid g2 links-panel" style="margin-top:14px">
        <div><h3 class="small muted">${esc(t('linksOut'))}</h3><ul class="list small" id="links-out">${this.outLinks(n)}</ul></div>
        <div><h3 class="small muted">${esc(t('sec_backlinks'))}</h3><ul class="list small">
          ${back.map(b => `<li><span class="kind-ico k-${b.kind}">${KIND_ICON[b.kind]}</span><a href="#/journal/${b.id}">${esc(Links.noteTitle(b))}</a></li>`).join('')}
          ${claims.map(c => `<li><span class="pill">${esc(t('lt_claim'))}</span><a href="#/argument/${c.id}">${esc(c.text.slice(0, 80))}</a></li>`).join('')}
          ${!back.length && !claims.length ? `<li class="empty">${esc(t('noBacklinks'))}</li>` : ''}</ul></div>
      </div>
      <p class="small faint" style="margin-top:10px">${esc(t('wikiHint'))}</p>
    </div>`;
  },
  outLinks(n) {
    return (n.links || []).map(l => `<li><span class="pill">${esc(t('lt_' + l.type))}</span><a href="${Links.href(l)}">${esc(Links.label(l))}</a></li>`).join('') || `<li class="empty">—</li>`;
  },

  decisionTable() {
    const D = Store.all('notes').filter(n => n.kind === 'decision').sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="row" style="margin-bottom:10px"><p class="muted small" style="flex:1;margin:0">${esc(t('decSub'))}</p><button class="btn small" data-action="export-dec">⇩ CSV</button></div>
      ${D.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('dec_what'))}</th><th>${esc(t('dec_why'))}</th><th class="hide-mobile">${esc(t('dec_alt'))}</th><th class="hide-mobile">${esc(t('projects'))}</th></tr></thead><tbody>
      ${D.map(n => `<tr class="clickable" data-href="#/journal/${n.id}"><td style="white-space:nowrap">${esc(fmtDate(n.date))}</td><td><strong>${esc(n.decision.what || Links.noteTitle(n))}</strong></td><td class="small">${esc(unlink(n.decision.why))}</td><td class="small hide-mobile">${esc(unlink(n.decision.alternatives))}</td><td class="hide-mobile">${(n.projects || []).map(p => `<span class="pill accent">${esc(projectName(p))}</span>`).join(' ')}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="card empty">${esc(t('noEntries'))}</div>`}`;
  },
  feedbackTable() {
    const F = Store.all('notes').filter(n => n.kind === 'feedback').sort((a, b) => b.date.localeCompare(a.date));
    return `<p class="muted small">${esc(t('fbSub'))}</p>
      ${F.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('fb_from'))}</th><th>${esc(t('fb_feedback'))}</th><th class="hide-mobile">${esc(t('fb_response'))}</th></tr></thead><tbody>
      ${F.map(n => `<tr class="clickable" data-href="#/journal/${n.id}"><td style="white-space:nowrap">${esc(fmtDate(n.date))}</td><td><span class="pill">${esc(t('fb_' + n.feedback.from))}</span><br><span class="small">${esc(n.feedback.who)}</span></td>
        <td><strong>${esc(Links.noteTitle(n))}</strong><div class="small muted">${esc(unlink(n.body).slice(0, 160))}</div></td><td class="small hide-mobile" style="white-space:pre-line">${esc(unlink(n.feedback.response))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="card empty">${esc(t('noEntries'))}</div>`}`;
  },

  bind(root, params) {
    const id = params[0];
    const note = () => Store.get('notes', id);
    const body = $('.note-body', root);
    if (body) { Links.autocomplete(body); $$('[data-sub$="what"],[data-sub$="why"],[data-sub$="alternatives"],[data-sub$="response"]', root).forEach(el => Links.autocomplete(el)); }
    const sync = () => {
      const n = note(); Links.refresh(n); n.updatedAt = new Date().toISOString(); Store.change();
      const out = $('#links-out', root); if (out) out.innerHTML = this.outLinks(n);
      const it = $(`.feed-item[data-id="${n.id}"] .ft`, root); if (it) it.textContent = Links.noteTitle(n);
      const pv = $('#note-preview', root); if (pv && !pv.hidden) pv.innerHTML = Links.render(n.body);
    };
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.jfilter) { JState[el.dataset.jfilter] = el.value; saveJState(); if (el.dataset.jfilter === 'q') journalRerender(); else App.render(); return; }
      if (!note()) return;
      if (el.dataset.nf && el.tagName !== 'SELECT') { note()[el.dataset.nf] = el.value; sync(); }
      else if (el.dataset.sub && el.tagName !== 'SELECT') { const [a, b] = el.dataset.sub.split('.'); note()[a][b] = el.value; sync(); }
      else if (el.dataset.nlist) { note()[el.dataset.nlist] = splitList(el.value); sync(); }
    });
    root.addEventListener('change', e => {
      const el = e.target; if (!note() || el.tagName !== 'SELECT') return;
      if (el.dataset.nf) { note()[el.dataset.nf] = el.value; sync(); App.render(); }
      else if (el.dataset.sub) { const [a, b] = el.dataset.sub.split('.'); note()[a][b] = el.value; sync(); }
    });
    root.addEventListener('click', e => {
      const tr = e.target.closest('tr[data-href]'); if (tr) { location.hash = tr.dataset.href; return; }
      const k = e.target.closest('[data-kind]'); if (k) { JState.kind = k.dataset.kind; saveJState(); App.render(); return; }
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action, n = note();
      if (act === 'new-note') { const nn = Store.add('notes', newNote({ kind: JState.kind && JState.kind !== 'inbox' ? JState.kind : 'idea', date: todayISO(), projects: JState.project ? [JState.project] : [] })); location.hash = '#/journal/' + nn.id; setTimeout(() => { const ti = $('.note-title'); ti && ti.focus(); }, 30); }
      else if (act === 'toggle-project') { const s = new Set(n.projects || []); s.has(a.dataset.id) ? s.delete(a.dataset.id) : s.add(a.dataset.id); n.projects = [...s]; sync(); App.render(); }
      else if (act === 'toggle-preview') { const pv = $('#note-preview', root), ta = $('.note-body', root); const on = pv.hidden; pv.hidden = !on; ta.hidden = on; a.setAttribute('aria-pressed', on); a.textContent = on ? t('edit') : t('preview'); if (on) pv.innerHTML = Links.render(n.body) || `<p class="faint">—</p>`; }
      else if (act === 'del-note') { if (confirmBox(t('confirmDeleteNote'))) { Store.remove('notes', n.id); location.hash = '#/journal'; } }
      else if (act === 'to-tasks') {
        const lines = (n.feedback.response || '').split('\n').map(l => unlink(l.replace(/^\s*[-*]\s*/, '')).trim()).filter(Boolean)
          .filter(title => !Store.all('tasks').some(x => x.noteId === n.id && x.title === title)); // no duplicates on a second click
        lines.forEach(title => Store.add('tasks', { title, projectId: (n.projects || [])[0] || '', due: '', energy: '', top: false, done: false, noteId: n.id }));
        toast(t('tasksCreated', { n: lines.length }));
      }
      else if (act === 'export-md') download(`journal-${todayISO()}.md`, journalMarkdown(this.filtered()), 'text/markdown');
      else if (act === 'export-dec') download(`decision-log-${todayISO()}.csv`, decisionCSV(), 'text/csv');
    });
  },
};
const journalRerender = debounce(() => {
  const pos = document.activeElement && document.activeElement.selectionStart;
  App.render(); const f = $('[data-jfilter="q"]'); if (f) { f.focus(); try { f.setSelectionRange(pos, pos); } catch { } }
}, 250);

function journalMarkdown(notes) {
  return `# Research journal — exported ${todayISO()}\n\n` + notes.slice().sort((a, b) => a.date.localeCompare(b.date)).map(n => {
    let s = `## ${n.date} · ${t('nk_' + n.kind)} · ${Links.noteTitle(n)}\n\n`;
    if ((n.projects || []).length) s += `Projects: ${n.projects.map(projectName).join(', ')}\n\n`;
    if (n.body) s += n.body + '\n\n';
    if (n.kind === 'decision') s += `**Decision:** ${n.decision.what}\n\n**Why:** ${n.decision.why}\n\n**Alternatives considered:** ${n.decision.alternatives}\n\n`;
    if (n.kind === 'feedback') s += `**From:** ${t('fb_' + n.feedback.from)} ${n.feedback.who}\n\n**My response / actions:**\n${n.feedback.response}\n\n`;
    if ((n.tags || []).length) s += `Tags: ${n.tags.join(', ')}\n\n`;
    return s;
  }).join('---\n\n');
}
function decisionCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = Store.all('notes').filter(n => n.kind === 'decision').sort((a, b) => a.date.localeCompare(b.date))
    .map(n => [n.date, n.decision.what || Links.noteTitle(n), n.decision.why, n.decision.alternatives, (n.projects || []).map(projectName).join('; '), n.body].map(q).join(','));
  return '﻿date,decision,why,alternatives,projects,notes\r\n' + rows.join('\r\n');
}
const unlink = s => String(s || '').replace(/\[\[([^\]]+)\]\]/g, '$1');
