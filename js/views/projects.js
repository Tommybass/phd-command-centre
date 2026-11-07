/* Projects: kanban board, list, roadmap timeline, milestones, deadlines, backward planning */
const PState = (() => { let s = { roadmapProject: '' }; try { Object.assign(s, JSON.parse(localStorage.getItem('phdcc.proj') || '{}')); } catch { } return s; })();
function savePState() { try { localStorage.setItem('phdcc.proj', JSON.stringify(PState)); } catch { } }
const HEALTH_PILL = { done: 'ok', ok: '', risk: 'warn', late: 'danger', blocked: 'danger' };

const ProjectsView = {
  render(params) {
    const tab = params[0] || 'board';
    const tabs = ['board', 'list', 'roadmap', 'milestones', 'deadlines'].map(k => `<a class="tab ${tab === k ? 'active' : ''}" href="#/projects/${k}">${esc(t('pt_' + k))}</a>`).join('');
    const warn = Plan.warnings();
    const head = `<div class="page-head"><div><h1>${esc(t('nav_projects'))}</h1><p class="sub">${esc(t('projectsSub3'))}</p></div><span class="spacer"></span>
      <div class="row"><button class="btn primary" data-action="new">+ ${esc(t('newProject'))}</button>
      <button class="btn" data-action="new-ms">+ ${esc(t('newMilestone'))}</button>
      <button class="btn" data-action="backward">⇤ ${esc(t('backwardPlan'))}</button></div></div>
      ${warn.length ? `<div class="banner"><strong>⚠ ${esc(t('slipping', { n: warn.length }))}</strong><span class="small" style="flex:1;min-width:200px">${warn.slice(0, 3).map(w => `${esc(w.m.title)} — ${esc(w.h.msg)}`).join(' · ')}</span><a class="btn small" href="#/projects/milestones">${esc(t('review'))}</a></div>` : ''}
      <nav class="tabs">${tabs}</nav>`;
    const body = tab === 'list' ? this.list() : tab === 'roadmap' ? this.roadmap() : tab === 'milestones' ? this.milestones() : tab === 'deadlines' ? this.deadlines() : this.board();
    return head + body;
  },

  card(p, compact) {
    const pct = Plan.projectProgress(p.id) ?? STAGE_PCT[p.stage];
    const wordPct = p.wordGoal ? Math.min(100, Math.round((p.wordCount || 0) / p.wordGoal * 100)) : null;
    return `<div class="card proj-card ${compact ? 'kcard' : ''}" ${compact ? `draggable="true" data-drag="${p.id}"` : ''}>
      <div class="row"><span class="pill">${esc(t('area_' + p.area))}</span>${compact ? '' : `<span class="pill accent">${esc(t('stg_' + p.stage))}</span>`}<span class="spacer"></span>
        <button class="btn ghost small" data-action="edit" data-id="${p.id}">${esc(t('edit'))}</button></div>
      <h3 style="margin-top:6px">${esc(p.title)}</h3>
      ${pct != null ? `<div class="bar" title="${pct}%"><i style="width:${pct}%"></i></div><div class="small faint" style="margin-top:2px">${pct}% ${Plan.projectProgress(p.id) != null ? esc(t('fromMilestones')) : esc(t('fromStage'))}</div>` : ''}
      <dl class="kv">
        ${!compact && p.goal ? `<dt>${esc(t('p_goal'))}</dt><dd>${esc(p.goal)}</dd>` : ''}
        ${p.outlet ? `<dt>${esc(t('p_outlet'))}</dt><dd>${esc(p.outlet)}</dd>` : ''}
        ${!compact && p.collaborators ? `<dt>${esc(t('p_collab'))}</dt><dd>${esc(p.collaborators)}</dd>` : ''}
        <dt>${esc(t('p_next'))}</dt><dd>${esc(p.nextAction || '—')}</dd>
        ${p.deadline ? `<dt>${esc(t('p_deadline'))}</dt><dd>${esc(fmtDate(p.deadline))} ${dueBadge(p.deadline)}</dd>` : ''}
        ${wordPct != null ? `<dt>${esc(t('words'))}</dt><dd>${(p.wordCount || 0).toLocaleString()} / ${p.wordGoal.toLocaleString()} (${wordPct}%)</dd>` : ''}
        ${!compact ? `<dt>${esc(t('nav_library'))}</dt><dd><a href="#/library/all?project=${p.id}">${Store.all('sources').filter(s => (s.projects || []).includes(p.id)).length} ${esc(t('sources'))}</a></dd>
        <dt>${esc(t('nav_journal_s'))}</dt><dd><a href="#/journal" data-action="journal-proj" data-id="${p.id}">${Store.all('notes').filter(n => (n.projects || []).includes(p.id) || (n.links || []).some(l => l.id === p.id)).length}</a></dd>` : ''}
      </dl>
      ${compact ? `<select class="touch-only" data-stage="${p.id}" aria-label="${esc(t('p_stage'))}">${options(STAGES, p.stage, x => t('stg_' + x))}</select>` : ''}
    </div>`;
  },
  board() {
    const P = Store.all('projects');
    if (!P.length) return `<div class="card empty">${esc(t('noProjects'))}</div>`;
    return `<p class="small muted">${esc(t('boardHint'))}</p><div class="kanban">${STAGES.map(st => {
      const list = P.filter(p => p.stage === st);
      return `<div class="kcol ${list.length ? '' : 'kempty'}" data-drop="${st}"><div class="kcol-head">${esc(t('stg_' + st))} <span class="count">${list.length}</span></div>${list.map(p => this.card(p, true)).join('')}</div>`;
    }).join('')}</div>`;
  },
  list() {
    const P = Store.all('projects').slice().sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.title.localeCompare(b.title));
    return P.length ? `<div class="proj-grid">${P.map(p => this.card(p, false)).join('')}</div>` : `<div class="card empty">${esc(t('noProjects'))}</div>`;
  },

  roadmap() {
    const P = Store.all('projects');
    const withMs = P.filter(p => Store.all('milestones').some(m => m.projectId === p.id) || p.deadline);
    const shown = PState.roadmapProject ? withMs.filter(p => p.id === PState.roadmapProject) : withMs;
    const ms = Store.all('milestones').filter(m => shown.some(p => p.id === m.projectId));
    const dl = PState.roadmapProject ? [] : Store.all('deadlines');
    const dates = [todayISO(), ...ms.flatMap(m => [m.start, m.due]), ...shown.map(p => p.deadline), ...dl.map(d => d.due)].filter(Boolean).sort();
    const filter = `<div class="filters"><select data-pstate="roadmapProject"><option value="">${esc(t('anyProject'))}</option>${options(withMs.map(p => p.id), PState.roadmapProject, projectName)}</select>
      <span class="small muted"><span class="gbar-key s-ok"></span> ${esc(t('h_ok'))} <span class="gbar-key s-risk"></span> ${esc(t('lvl_risk'))} <span class="gbar-key s-late"></span> ${esc(t('lvl_late'))} <span class="gbar-key s-done"></span> ${esc(t('h_done'))} ◆ ${esc(t('deadlines'))}</span></div>`;
    if (!ms.length && !dl.length && !shown.some(p => p.deadline)) return filter + `<div class="card empty">${esc(t('noMilestones'))}</div>`;
    const s0 = parseISO(dates[0]); s0.setDate(1);
    const e0 = parseISO(dates[dates.length - 1]); e0.setMonth(e0.getMonth() + 1, 1);
    const span = (e0 - s0) || 1;
    const pos = iso => Math.max(0, Math.min(100, (parseISO(iso) - s0) / span * 100));
    const months = []; const c = new Date(s0); while (c < e0) { months.push(new Date(c)); c.setMonth(c.getMonth() + 1); }
    const monthW = 100 / months.length;
    const ticks = months.map((m, i) => `<span class="gtick" style="left:${i * monthW}%;width:${monthW}%">${m.getMonth() === 0 || i === 0 ? `<b>${m.getFullYear()}</b> ` : ''}${m.toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short' })}</span>`).join('');
    const today = `<span class="gtoday" style="left:${pos(todayISO())}%"></span>`;
    const minW = Math.max(700, months.length * 46);
    const rows = shown.map(p => {
      const pm = ms.filter(m => m.projectId === p.id).sort((a, b) => (a.start || a.due || '').localeCompare(b.start || b.due || ''));
      const lines = pm.map(m => {
        const h = Plan.health(m); const lvl = h.level === 'blocked' ? 'late' : h.level;
        const a = m.start || m.due, b = m.due || m.start;
        const bar = a === b ? `<span class="gdia s-${lvl}" style="left:${pos(b)}%" title="${esc(m.title)} · ${esc(fmtDate(b))}">◆</span>`
          : `<span class="gbar s-${lvl}" style="left:${pos(a)}%;width:${Math.max(0.8, pos(b) - pos(a))}%" title="${esc(m.title)} · ${esc(fmtDate(a))} → ${esc(fmtDate(b))} · ${Plan.progress(m)}%"><i style="width:${Plan.progress(m)}%"></i></span>`;
        return `<div class="grow-row"><a class="glabel" href="#" data-action="edit-ms" data-id="${m.id}" title="${esc(m.title)}">${m.verify ? '⚠ ' : ''}${esc(m.title)}</a><div class="gtrack">${today}${bar}</div></div>`;
      }).join('');
      const pd = p.deadline ? `<div class="grow-row"><span class="glabel faint">${esc(t('p_deadline'))}</span><div class="gtrack">${today}<span class="gdia s-late" style="left:${pos(p.deadline)}%" title="${esc(fmtDate(p.deadline))}">◆</span></div></div>` : '';
      return `<div class="gproj">${esc(p.title)} ${Plan.projectProgress(p.id) != null ? `<span class="small muted">· ${Plan.projectProgress(p.id)}%</span>` : ''}</div>${lines}${pd}`;
    }).join('');
    const dRows = dl.length ? `<div class="gproj">${esc(t('deadlines'))}</div><div class="grow-row"><span class="glabel faint">${dl.length}</span><div class="gtrack">${today}${dl.map(d => `<span class="gdia s-risk" style="left:${pos(d.due)}%" title="${esc(d.title)} · ${esc(fmtDate(d.due))}">◆</span>`).join('')}</div></div>` : '';
    return filter + `<div class="table-wrap gantt-wrap"><div class="gantt" style="min-width:${minW}px"><div class="grow-row ghead"><span class="glabel"></span><div class="gtrack">${ticks}</div></div>${rows}${dRows}</div></div>`;
  },

  milestones() {
    const P = Store.all('projects');
    const thesis = P.find(p => p.area === 'thesis');
    const hasThesisMs = thesis && Store.all('milestones').some(m => m.projectId === thesis.id);
    const groups = P.map(p => ({ p, ms: Store.all('milestones').filter(m => m.projectId === p.id).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')) })).filter(g => g.ms.length);
    const tmpl = thesis && !hasThesisMs ? `<div class="banner info"><span style="flex:1;min-width:220px"><strong>${esc(t('tmplTitle'))}</strong><br><span class="small">${esc(t('tmplText'))}</span></span><button class="btn primary" data-action="template" data-id="${thesis.id}">${esc(t('tmplAdd'))}</button></div>` : '';
    if (!groups.length) return tmpl + `<div class="card empty">${esc(t('noMilestones'))}</div>`;
    return tmpl + groups.map(({ p, ms }) => `<div class="row" style="margin:16px 0 8px"><h2 style="margin:0">${esc(p.title)}</h2><span class="pill accent">${Plan.projectProgress(p.id)}%</span></div>
      <div class="table-wrap"><table><thead><tr><th>${esc(t('ms_title'))}</th><th class="hide-mobile">${esc(t('ms_dates'))}</th><th>${esc(t('ms_progress'))}</th><th>${esc(t('ms_health'))}</th><th></th></tr></thead><tbody>
      ${ms.map(m => { const h = Plan.health(m), pr = Plan.progress(m), deps = (m.dependsOn || []).map(id => (Store.get('milestones', id) || {}).title).filter(Boolean); const nT = Plan.msTasks(m).length;
        return `<tr><td><strong>${esc(m.title)}</strong> ${m.verify ? `<button class="pill warn" data-action="verified" data-id="${m.id}" title="${esc(t('verifyHint'))}">⚠ ${esc(t('verify'))}</button>` : ''}
          ${deps.length ? `<div class="small faint">↳ ${esc(t('dependsOn'))}: ${deps.map(esc).join(', ')}</div>` : ''}${m.notes ? `<div class="small muted">${esc(m.notes)}</div>` : ''}</td>
        <td class="hide-mobile small" style="white-space:nowrap">${esc(fmtDate(m.start) || '—')}<br>→ ${esc(fmtDate(m.due) || '—')} ${m.due ? dueBadge(m.due) : ''}</td>
        <td style="min-width:110px"><div class="bar"><i style="width:${pr}%"></i></div><span class="small faint">${pr}%${nT ? ` · ${nT} ${esc(t('tasksW'))}` : ''}</span></td>
        <td><span class="pill ${HEALTH_PILL[h.level]}">${esc(t('lvl_' + h.level))}</span><div class="small faint">${esc(h.msg)}</div></td>
        <td style="white-space:nowrap"><button class="btn ghost small" data-action="edit-ms" data-id="${m.id}">${esc(t('edit'))}</button><button class="btn ghost small" data-action="backward" data-ms="${m.id}" title="${esc(t('backwardPlan'))}">⇤</button></td></tr>`; }).join('')}
      </tbody></table></div>`).join('');
  },

  deadlines() {
    const D = Store.all('deadlines').slice().sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return `<div class="row" style="margin-bottom:10px"><span class="spacer"></span><button class="btn" data-action="new-deadline">+ ${esc(t('newDeadline'))}</button></div>
      ${D.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('t_due'))}</th><th>${esc(t('p_title'))}</th><th>${esc(t('d_kind'))}</th><th></th></tr></thead><tbody>
        ${D.map(d => `<tr><td style="white-space:nowrap">${esc(fmtDate(d.due))} ${dueBadge(d.due)}</td><td>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>` : esc(d.title)}${d.notes ? `<br><span class="small muted">${esc(d.notes)}</span>` : ''}</td>
          <td><span class="pill">${esc(t('dk_' + d.kind))}</span></td><td style="white-space:nowrap"><button class="btn ghost small" data-action="edit-deadline" data-id="${d.id}">${esc(t('edit'))}</button><button class="btn ghost small" data-action="backward" data-dl="${d.id}" title="${esc(t('backwardPlan'))}">⇤</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="card empty">${esc(t('noDeadlines'))}</div>`}`;
  },

  bind(root) {
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'journal-proj') { JState.project = a.dataset.id; JState.kind = ''; saveJState(); return; }
      e.preventDefault();
      if (act === 'new') projectModal();
      else if (act === 'edit') projectModal(Store.get('projects', a.dataset.id));
      else if (act === 'new-deadline') deadlineModal();
      else if (act === 'edit-deadline') deadlineModal(Store.get('deadlines', a.dataset.id));
      else if (act === 'new-ms') milestoneModal();
      else if (act === 'edit-ms') milestoneModal(Store.get('milestones', a.dataset.id));
      else if (act === 'verified') { Store.update('milestones', a.dataset.id, { verify: false }); App.render(); }
      else if (act === 'template') {
        if (!confirmBox(t('tmplConfirm'))) return;
        Plan.concordiaTemplate(a.dataset.id).forEach(m => Store.data.milestones.push(Object.assign({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, m)));
        Store.change(); App.render();
      }
      else if (act === 'backward') {
        if (a.dataset.ms) { const m = Store.get('milestones', a.dataset.ms); backwardModal({ title: m.title, deadline: m.due, projectId: m.projectId, milestoneId: m.id, start: m.start }); }
        else if (a.dataset.dl) { const d = Store.get('deadlines', a.dataset.dl); backwardModal({ title: d.title, deadline: d.due }); }
        else backwardModal({});
      }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.stage) { Store.update('projects', el.dataset.stage, { stage: el.value }); App.render(); }
      if (el.dataset.pstate) { PState[el.dataset.pstate] = el.value; savePState(); App.render(); }
    });
    // Kanban drag and drop
    root.addEventListener('dragstart', e => { const c = e.target.closest('[data-drag]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.drag); c.classList.add('dragging'); } });
    root.addEventListener('dragend', e => { const c = e.target.closest('[data-drag]'); if (c) c.classList.remove('dragging'); $$('.kcol.over', root).forEach(x => x.classList.remove('over')); });
    root.addEventListener('dragover', e => { const col = e.target.closest('[data-drop]'); if (col) { e.preventDefault(); $$('.kcol.over', root).forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
    root.addEventListener('drop', e => {
      const col = e.target.closest('[data-drop]'); if (!col) return; e.preventDefault();
      const id = e.dataTransfer.getData('text/plain'); if (id) { Store.update('projects', id, { stage: col.dataset.drop }); App.render(); }
    });
  },
};

function dueBadge(iso) {
  if (!iso) return '';
  const n = daysUntil(iso);
  if (n < 0) return `<span class="pill danger">${esc(t('overdue'))}</span>`;
  if (n === 0) return `<span class="pill danger">${esc(t('dueToday'))}</span>`;
  const label = n === 1 ? t('dayLeft') : t('daysLeft', { n });
  if (n <= 7) return `<span class="pill warn">${esc(label)}</span>`;
  if (n <= 14) return `<span class="pill">${esc(label)}</span>`;
  return '';
}

function projectModal(p) {
  const v = p || { title: '', goal: '', area: 'publication', stage: 'idea', outlet: '', collaborators: '', nextAction: '', deadline: '', notes: '', wordGoal: 0, wordCount: 0 };
  const m = modal({
    title: p ? t('editProject') : t('newProject'), wide: true,
    body: `<div class="grid g2">
      <label class="field span-all"><span>${esc(t('p_title'))}</span><input id="pf-title" value="${esc(v.title)}"></label>
      <label class="field span-all"><span>${esc(t('p_goal'))}</span><input id="pf-goal" value="${esc(v.goal)}"></label>
      <label class="field"><span>${esc(t('p_area'))}</span><select id="pf-area">${options(AREAS, v.area, x => t('area_' + x))}</select></label>
      <label class="field"><span>${esc(t('p_stage'))}</span><select id="pf-stage">${options(STAGES, v.stage, x => t('stg_' + x))}</select></label>
      <label class="field"><span>${esc(t('p_outlet'))}</span><input id="pf-outlet" value="${esc(v.outlet)}"></label>
      <label class="field"><span>${esc(t('p_deadline'))}</span><input type="date" id="pf-deadline" value="${esc(v.deadline)}"></label>
      <label class="field"><span>${esc(t('wordGoal'))}</span><input type="number" min="0" step="500" id="pf-wgoal" value="${esc(v.wordGoal || '')}"></label>
      <label class="field"><span>${esc(t('wordCount'))}</span><input type="number" min="0" id="pf-wcount" value="${esc(v.wordCount || '')}"></label>
      <label class="field span-all"><span>${esc(t('p_collab'))}</span><input id="pf-collab" value="${esc(v.collaborators)}" placeholder="Name (role); Name (role)"></label>
      <label class="field span-all"><span>${esc(t('p_next'))}</span><input id="pf-next" value="${esc(v.nextAction)}"></label>
      <label class="field span-all"><span>${esc(t('p_notes'))}</span><textarea id="pf-notes" rows="3">${esc(v.notes)}</textarea></label>
    </div>`,
    foot: `${p ? `<button class="btn danger" id="pf-del">${esc(t('delete'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="pf-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="pf-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r).value;
  $('#pf-cancel', r).onclick = m.close;
  $('#pf-save', r).onclick = () => {
    const data = { title: g('pf-title').trim(), goal: g('pf-goal'), area: g('pf-area'), stage: g('pf-stage'), outlet: g('pf-outlet'), deadline: g('pf-deadline'), collaborators: g('pf-collab'), nextAction: g('pf-next'), notes: g('pf-notes'), wordGoal: Number(g('pf-wgoal')) || 0, wordCount: Number(g('pf-wcount')) || 0 };
    if (!data.title) return;
    if (p) Store.update('projects', p.id, data); else Store.add('projects', Object.assign({ versions: [] }, data));
    m.close(); App.render();
  };
  if (p) $('#pf-del', r).onclick = () => { if (confirmBox(t('confirmDeleteProject', { x: p.title }))) { Store.remove('projects', p.id); Store.data.sources.forEach(s => s.projects = (s.projects || []).filter(x => x !== p.id)); Store.change(); m.close(); App.render(); } };
}

function milestoneModal(ms) {
  const P = Store.all('projects');
  const v = ms || { projectId: (P.find(p => p.area === 'thesis') || P[0] || {}).id || '', title: '', start: todayISO(), due: '', status: 'todo', percent: 0, dependsOn: [], notes: '', verify: false };
  const depList = pid => Store.all('milestones').filter(x => x.projectId === pid && (!ms || x.id !== ms.id));
  const depHtml = pid => depList(pid).map(x => `<label class="row small"><input type="checkbox" value="${x.id}" ${(v.dependsOn || []).includes(x.id) ? 'checked' : ''}> ${esc(x.title)}</label>`).join('') || `<span class="faint small">—</span>`;
  const nT = ms ? Plan.msTasks(ms).length : 0;
  const m = modal({
    title: ms ? t('editMilestone') : t('newMilestone'), wide: true,
    body: `<div class="grid g2">
      <label class="field span-all"><span>${esc(t('ms_title'))}</span><input id="mf-title" value="${esc(v.title)}"></label>
      <label class="field"><span>${esc(t('t_project'))}</span><select id="mf-proj">${options(P.map(p => p.id), v.projectId, projectName)}</select></label>
      <label class="field"><span>${esc(t('status'))}</span><select id="mf-status">${options(MS_STATUS, v.status, x => t('ms_' + x))}</select></label>
      <label class="field"><span>${esc(t('ms_start'))}</span><input type="date" id="mf-start" value="${esc(v.start)}"></label>
      <label class="field"><span>${esc(t('ms_due'))}</span><input type="date" id="mf-due" value="${esc(v.due)}"></label>
      <label class="field span-all"><span>${esc(t('ms_progress'))}: <b id="mf-pv">${esc(v.percent)}%</b> ${nT ? `<span class="faint">(${esc(t('autoFromTasks', { n: nT }))})</span>` : ''}</span><input type="range" min="0" max="100" step="5" id="mf-pct" value="${esc(v.percent)}" ${nT ? 'disabled' : ''}></label>
      <div class="field span-all"><span class="small muted">${esc(t('dependsOn'))}</span><div id="mf-deps" class="grid g2" style="gap:4px;margin-top:4px">${depHtml(v.projectId)}</div></div>
      <label class="field span-all"><span>${esc(t('p_notes'))}</span><textarea id="mf-notes" rows="3">${esc(v.notes)}</textarea></label>
      <label class="row small span-all"><input type="checkbox" id="mf-verify" ${v.verify ? 'checked' : ''}> ${esc(t('verifyHint'))}</label>
    </div>`,
    foot: `${ms ? `<button class="btn danger" id="mf-del">${esc(t('delete'))}</button><button class="btn" id="mf-back">⇤ ${esc(t('backwardPlan'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="mf-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="mf-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r).value;
  $('#mf-pct', r).oninput = e => { $('#mf-pv', r).textContent = e.target.value + '%'; };
  $('#mf-proj', r).onchange = e => { v.dependsOn = []; $('#mf-deps', r).innerHTML = depHtml(e.target.value); };
  $('#mf-cancel', r).onclick = m.close;
  const save = () => {
    const data = { title: g('mf-title').trim(), projectId: g('mf-proj'), status: g('mf-status'), start: g('mf-start'), due: g('mf-due'), percent: Number(g('mf-pct')), notes: g('mf-notes'),
      dependsOn: $$('#mf-deps input:checked', r).map(x => x.value), verify: $('#mf-verify', r).checked };
    if (!data.title) return null;
    if (data.status === 'done') data.percent = 100;
    return ms ? Store.update('milestones', ms.id, data) : Store.add('milestones', data);
  };
  $('#mf-save', r).onclick = () => { if (save()) { m.close(); App.render(); } };
  if (ms) {
    $('#mf-del', r).onclick = () => { if (confirmBox(`${t('delete')}: ${ms.title}?`)) { Store.remove('milestones', ms.id); m.close(); App.render(); } };
    $('#mf-back', r).onclick = () => { const x = save(); if (!x) return; m.close(); backwardModal({ title: x.title, deadline: x.due, projectId: x.projectId, milestoneId: x.id, start: x.start }); };
  }
}

/* Turn a deadline into weekly tasks */
function backwardModal({ title = '', deadline = '', projectId = '', milestoneId = '', start = '' }) {
  const P = Store.all('projects');
  const m = modal({
    title: t('backwardPlan'), wide: true,
    body: `<p class="small muted">${esc(t('bpHelp'))}</p><div class="grid g4">
      <label class="field span2"><span>${esc(t('bpGoal'))}</span><input id="bp-title" value="${esc(title)}"></label>
      <label class="field"><span>${esc(t('bpStart'))}</span><input type="date" id="bp-start" value="${esc(start && start > todayISO() ? start : todayISO())}"></label>
      <label class="field"><span>${esc(t('p_deadline'))}</span><input type="date" id="bp-dl" value="${esc(deadline)}"></label>
      <label class="field span2"><span>${esc(t('t_project'))}</span><select id="bp-proj"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), projectId, projectName)}</select></label>
      <label class="field"><span>${esc(t('bpHours'))}</span><input type="number" id="bp-hpw" min="1" step="0.5" value="6"></label>
      <label class="row small" style="align-self:end"><input type="checkbox" id="bp-buffer" checked> ${esc(t('bpBuffer'))}</label>
      <label class="field span-all"><span>${esc(t('bpSteps'))}</span><textarea id="bp-steps" rows="7" placeholder="${esc(t('bpStepsHint'))}"></textarea></label>
    </div><div id="bp-out"></div>`,
    foot: `<button class="btn" id="bp-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="bp-create" disabled>${esc(t('bpCreate'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r).value;
  let plan = null;
  const draw = () => {
    const dl = g('bp-dl'), steps = g('bp-steps');
    if (!dl || !steps.trim()) { $('#bp-out', r).innerHTML = ''; $('#bp-create', r).disabled = true; return; }
    plan = Plan.backward({ start: g('bp-start'), deadline: dl, steps, hoursPerWeek: g('bp-hpw'), buffer: $('#bp-buffer', r).checked });
    const hpw = Number(g('bp-hpw')) || 0;
    const over = plan.overload || plan.needed > hpw;
    $('#bp-out', r).innerHTML = `<div class="banner ${over ? '' : 'info'}" style="margin:0"><span class="small">${esc(t('bpSummary', { h: plan.total, w: plan.weeks, n: plan.needed }))}${over ? ' <strong>' + esc(t('bpOver', { h: hpw })) + '</strong>' : ''}</span></div>
      <div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>${esc(t('bpWeek'))}</th><th>${esc(t('qa_task'))}</th><th>h</th><th>${esc(t('t_due'))}</th></tr></thead><tbody>
      ${plan.rows.map(x => `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(x.weekStart, { day: 'numeric', month: 'short' }))}</td><td>${esc(x.title)}</td><td class="small">${x.hours}${x.estimated ? '' : '*'}</td><td class="small" style="white-space:nowrap">${esc(fmtDate(x.due, { weekday: 'short', day: 'numeric', month: 'short' }))}</td></tr>`).join('')}
      </tbody></table></div><p class="small faint">* ${esc(t('bpDefault'))}</p>`;
    $('#bp-create', r).disabled = !plan.rows.length;
  };
  ['bp-dl', 'bp-steps', 'bp-hpw', 'bp-start', 'bp-buffer'].forEach(id => { $('#' + id, r).addEventListener('input', draw); $('#' + id, r).addEventListener('change', draw); });
  $('#bp-cancel', r).onclick = m.close;
  $('#bp-create', r).onclick = () => {
    if (!plan) return;
    const pid = g('bp-proj'), goal = g('bp-title').trim();
    plan.rows.forEach(x => Store.add('tasks', { title: goal ? `${x.title} (${goal})` : x.title, projectId: pid, due: x.due, energy: '', estimateH: x.hours, top: false, done: false, milestoneId, week: x.weekStart }));
    toast(t('tasksCreated', { n: plan.rows.length })); m.close(); App.render();
  };
}
