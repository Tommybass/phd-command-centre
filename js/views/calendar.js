/* Calendar: day, week and month views, weekly capacity, scheduling suggestions, time logged, .ics */
const HOUR_PX = 44;
const CalendarView = {
  render(params, query) {
    let view = params[0] || (window.innerWidth < 760 ? 'day' : 'week');
    const d = query.d || todayISO();
    const S = Store.data.settings;
    const step = { day: 1, week: 7, month: 0, time: 7 }[view];
    const prev = view === 'month' ? shiftMonth(d, -1) : addDays(d, -step), next = view === 'month' ? shiftMonth(d, 1) : addDays(d, step);
    const ws = startOfWeek(d);
    const range = view === 'day' ? fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'month' ? parseISO(d).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' })
        : `${fmtDate(ws, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(ws, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const tabs = ['day', 'week', 'month', 'time'].map(k => `<a class="tab ${view === k ? 'active' : ''}" href="#/calendar/${k}?d=${d}">${esc(t('cv_' + k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_calendar'))}</h1><p class="sub">${esc(range)}</p></div><span class="spacer"></span>
      <div class="row"><a class="btn icon" href="#/calendar/${view}?d=${prev}" aria-label="‹">‹</a><a class="btn" href="#/calendar/${view}?d=${todayISO()}">${esc(t('today'))}</a><a class="btn icon" href="#/calendar/${view}?d=${next}" aria-label="›">›</a>
      <button class="btn primary" data-action="new-event" data-date="${d}">+ ${esc(t('newEvent'))}</button>
      <button class="btn" data-action="autoplan">✦ ${esc(t('autoPlan'))}</button>
      <details class="menu"><summary class="btn">⋯</summary><div class="menu-pop">
        <button class="btn ghost" data-action="availability">${esc(t('availability'))}</button>
        <button class="btn ghost" data-action="export-ics">⇩ ${esc(t('exportIcs'))}</button>
        <button class="btn ghost" data-action="import-ics">⇧ ${esc(t('importIcs'))}</button></div></details></div></div>
      <nav class="tabs">${tabs}</nav>`;
    if (view === 'time') return head + this.timeView(d);
    const cap = Cal.capacity(ws);
    const capBar = view !== 'month' ? capacityBar(cap) : '';
    if (view === 'month') return head + this.month(d);
    if (view === 'day') return head + capBar + `<div class="day-layout"><div>${this.grid([d])}</div>${this.dayPanel(d)}</div>`;
    return head + capBar + `<div class="table-wrap cal-wrap">${this.grid(Array.from({ length: 7 }, (_, i) => addDays(ws, i)))}</div>`;
  },

  grid(days) {
    const S = Store.data.settings, g0 = Number(S.gridStart) || 7, g1 = Number(S.gridEnd) || 22, H = (g1 - g0) * HOUR_PX;
    const all = Cal.items(days[0], days[days.length - 1]);
    const hours = Array.from({ length: g1 - g0 }, (_, i) => `<div class="hr" style="top:${i * HOUR_PX}px">${String(g0 + i).padStart(2, '0')}:00</div>`).join('');
    const top = hm => (toMin(hm) - g0 * 60) / 60 * HOUR_PX;
    const cols = days.map(day => {
      const items = all.filter(i => i.date === day);
      const allDay = items.filter(i => i.allDay);
      const timed = items.filter(i => !i.allDay && i.start).sort((a, b) => toMin(a.start) - toMin(b.start));
      const laneEnd = []; timed.forEach(i => { let l = laneEnd.findIndex(e => e <= toMin(i.start)); if (l === -1) { l = laneEnd.length; laneEnd.push(0); } laneEnd[l] = toMin(i.end); i.lane = l; });
      const lanes = Math.max(1, laneEnd.length);
      const workDay = Number(S.workHours[dow(day)]) > 0;
      const bands = workDay ? ['deep'].map(k => { const w = S.energyWindows[k]; return `<div class="eband" style="top:${top(w[0])}px;height:${top(w[1]) - top(w[0])}px" title="${esc(t('en_' + k))}"></div>`; }).join('') : '';
      const ev = timed.map(i => {
        const y = Math.max(0, top(i.start)), h = Math.max(18, Math.min(H, top(i.end)) - y);
        const cls = i.kind === 'task' ? `k-task e-${i.energy || 'none'} ${i.done ? 'done' : ''}` : `k-${i.kind}`;
        return `<a class="cev ${cls}" href="${i.href || '#'}" data-item="${i.src}" data-id="${i.id}" data-date="${i.date}" style="top:${y}px;height:${h}px;left:calc(${i.lane / lanes * 100}% + 2px);width:calc(${100 / lanes}% - 4px)" title="${esc(i.title)} · ${i.start}–${i.end}">
          <b>${esc(i.title)}</b><span>${i.start}–${i.end}</span></a>`;
      }).join('');
      const now = day === todayISO() ? (() => { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); return m >= g0 * 60 && m <= g1 * 60 ? `<div class="nowline" style="top:${(m - g0 * 60) / 60 * HOUR_PX}px"></div>` : ''; })() : '';
      return { day, allDay, html: `<div class="ccol ${day === todayISO() ? 'today' : ''} ${workDay ? '' : 'off'}" data-day="${day}" style="height:${H}px">${bands}${ev}${now}</div>` };
    });
    const headRow = cols.map(c => `<a class="chead ${c.day === todayISO() ? 'today' : ''}" href="#/calendar/day?d=${c.day}"><span>${esc(parseISO(c.day).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short' }))}</span> <b>${parseISO(c.day).getDate()}</b></a>`).join('');
    const adRow = cols.map(c => `<div class="callday">${c.allDay.map(i => `<a class="cad" href="${i.href || '#'}" title="${esc(i.title)}" ${i.src === 'event' ? `data-item="event" data-id="${i.id}" data-date="${i.date}"` : ''}>${esc(i.title)}</a>`).join('')}</div>`).join('');
    const gc = `grid-template-columns:52px repeat(${days.length}, minmax(${days.length > 1 ? 96 : 200}px, 1fr))`;
    return `<div class="calgrid" style="${gc}"><div></div>${headRow}<div class="small faint" style="padding:4px">${esc(t('allDay'))}</div>${adRow}
      <div class="hours" style="height:${H}px">${hours}</div>${cols.map(c => c.html).join('')}</div>`;
  },

  dayPanel(d) {
    const open = Store.all('tasks').filter(x => !x.done && !x.scheduled).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const sched = Store.all('tasks').filter(x => x.scheduled && x.scheduled.date === d);
    return `<aside class="card day-panel"><h2>${esc(t('unscheduled'))} <span class="count">${open.length}</span></h2>
      <p class="small muted">${esc(t('suggestHelp'))}</p>
      <ul class="list small">${open.slice(0, 12).map(x => `<li><div class="grow">${esc(x.title)}<div class="row faint">${x.energy ? `<span class="pill e-${x.energy}">${esc(t('en_' + x.energy))}</span>` : ''}<span>${Math.round(Cal.taskMinutes(x))} min${x.estimateH ? '' : '*'}</span>${x.due ? `<span>${esc(fmtDate(x.due, { day: 'numeric', month: 'short' }))}</span>` : ''}</div>
        <div class="sugg" data-sugg="${x.id}"></div></div><button class="btn small" data-action="suggest" data-id="${x.id}">${esc(t('suggestTime'))}</button></li>`).join('') || `<li class="empty">${esc(t('allScheduled'))}</li>`}</ul>
      ${open.length ? `<p class="small faint">* ${esc(t('defaultEst'))}</p>` : ''}
      ${sched.length ? `<h3 class="small muted" style="margin-top:12px">${esc(t('scheduledToday'))}</h3><ul class="list small">${sched.map(x => `<li><span class="faint">${x.scheduled.start}</span><span class="grow ${x.done ? 'done-text' : ''}">${esc(x.title)}</span></li>`).join('')}</ul>` : ''}
    </aside>`;
  },

  month(d) {
    const first = parseISO(d); first.setDate(1);
    const start = startOfWeek(localISO(first));
    const items = Cal.items(start, addDays(start, 41));
    const month = first.getMonth();
    const names = Array.from({ length: 7 }, (_, i) => `<div class="mhead">${esc(parseISO(addDays(start, i)).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short' }))}</div>`).join('');
    const cells = Array.from({ length: 42 }, (_, i) => {
      const day = addDays(start, i), its = items.filter(x => x.date === day).sort((a, b) => (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || toMin(a.start) - toMin(b.start));
      return `<div class="mcell ${parseISO(day).getMonth() !== month ? 'other' : ''} ${day === todayISO() ? 'today' : ''}"><a class="mday" href="#/calendar/day?d=${day}">${parseISO(day).getDate()}</a>
        ${its.slice(0, 3).map(x => `<a class="mev k-${x.kind === 'task' ? 'task e-' + (x.energy || 'none') : x.kind}" href="${x.href || '#/calendar/day?d=' + day}">${x.allDay ? '' : `<span class="faint">${x.start}</span> `}${esc(x.title)}</a>`).join('')}
        ${its.length > 3 ? `<a class="small faint" href="#/calendar/day?d=${day}">+${its.length - 3}</a>` : ''}</div>`;
    }).join('');
    return `<div class="table-wrap"><div class="mgrid">${names}${cells}</div></div>`;
  },

  timeView(d) {
    const ws = startOfWeek(d), we = addDays(ws, 6);
    const m0 = d.slice(0, 7);
    const logs = Store.all('timeLogs');
    const sum = (list, key) => { const o = {}; list.forEach(l => { const k = key(l); o[k] = (o[k] || 0) + (Number(l.minutes) || 0); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    const block = (label, list) => {
      const tot = list.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
      const byP = sum(list, l => l.projectId ? projectName(l.projectId) || '—' : t('noProject')), byA = sum(list, l => t('area_' + (l.area || 'life')));
      const bars = rows => rows.map(([k, v]) => `<div style="margin-bottom:6px"><div class="row small"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><span class="muted">${(v / 60).toFixed(1)} h</span></div><div class="bar"><i style="width:${tot ? v / tot * 100 : 0}%"></i></div></div>`).join('') || `<p class="empty">—</p>`;
      return `<div class="card c6"><h2>${esc(label)} <span class="count">${(tot / 60).toFixed(1)} h</span></h2><div class="grid g2"><div><h3 class="small muted">${esc(t('projects'))}</h3>${bars(byP)}</div><div><h3 class="small muted">${esc(t('p_area'))}</h3>${bars(byA)}</div></div></div>`;
    };
    const wk = logs.filter(l => l.start.slice(0, 10) >= ws && l.start.slice(0, 10) <= we), mo = logs.filter(l => l.start.slice(0, 7) === m0);
    const recent = logs.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 25);
    const P = Store.all('projects');
    return `<div class="dash">${block(t('weekOf', { d: fmtDate(ws, { day: 'numeric', month: 'short' }) }), wk)}${block(parseISO(d).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' }), mo)}
      <form class="card c12" data-form="manual-log"><h2>${esc(t('addSession'))}</h2><div class="grid g4">
        <label class="field"><span>${esc(t('date'))}</span><input type="date" name="date" value="${todayISO()}"></label>
        <label class="field"><span>${esc(t('ms_start'))}</span><input type="time" name="start" value="09:00"></label>
        <label class="field"><span>${esc(t('minutes'))}</span><input type="number" name="minutes" min="1" step="5" value="60"></label>
        <label class="field"><span>${esc(t('t_project'))}</span><select name="projectId"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), '', projectName)}</select></label>
        <label class="field"><span>${esc(t('p_area'))}</span><select name="area">${options(AREAS, 'thesis', a => t('area_' + a))}</select></label>
        <label class="field span2"><span>${esc(t('logNote'))}</span><input name="note"></label>
        <div style="align-self:end"><button class="btn primary">${esc(t('save'))}</button></div></div></form>
      <div class="card c12"><h2>${esc(t('sessions'))}</h2>${recent.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('minutes'))}</th><th>${esc(t('t_project'))}</th><th class="hide-mobile">${esc(t('p_area'))}</th><th class="hide-mobile">${esc(t('logNote'))}</th><th></th></tr></thead><tbody>
        ${recent.map(l => `<tr><td style="white-space:nowrap">${esc(fmtDate(l.start.slice(0, 10)))} <span class="faint">${esc(fmtTime(new Date(l.start)))}</span></td><td>${l.minutes}</td><td>${esc(projectName(l.projectId) || '—')}${l.taskId ? `<div class="small faint">${esc((Store.get('tasks', l.taskId) || {}).title || '')}</div>` : ''}</td><td class="hide-mobile">${esc(t('area_' + l.area))}</td><td class="small hide-mobile">${esc(l.note)}</td>
          <td><button class="btn ghost small danger" data-action="del-log" data-id="${l.id}" aria-label="${esc(t('delete'))}">✕</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${esc(t('noSessions'))}</p>`}</div></div>`;
  },

  bind(root, params, query) {
    const d = query.d || todayISO();
    root.addEventListener('click', e => {
      const it = e.target.closest('[data-item]');
      if (it && (it.dataset.item === 'event' || it.dataset.item === 'task')) { e.preventDefault(); it.dataset.item === 'event' ? eventModal(Store.get('events', it.dataset.id), it.dataset.date) : taskBlockModal(Store.get('tasks', it.dataset.id)); return; }
      const col = e.target.closest('.ccol');
      if (col && e.target === col || (col && e.target.classList.contains('eband'))) {
        const S = Store.data.settings, y = e.clientY - col.getBoundingClientRect().top;
        const min = Math.round(((Number(S.gridStart) || 7) * 60 + y / HOUR_PX * 60) / 30) * 30;
        eventModal(null, col.dataset.day, fromMin(min)); return;
      }
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'new-event') eventModal(null, a.dataset.date);
      else if (act === 'autoplan') autoPlanModal();
      else if (act === 'availability') availabilityModal();
      else if (act === 'export-ics') exportIcsModal();
      else if (act === 'import-ics') importIcsModal();
      else if (act === 'del-log') { if (confirmBox(t('delete') + '?')) { Store.remove('timeLogs', a.dataset.id); App.render(); } }
      else if (act === 'suggest') {
        const x = Store.get('tasks', a.dataset.id), s = Cal.suggest(x, [], d < todayISO() ? todayISO() : d), box = $(`[data-sugg="${x.id}"]`, root);
        box.innerHTML = s ? `<div class="sugg-box">${esc(fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${s.start}–${s.end}${s.partial ? ' · ' + esc(t('partial')) : ''}${s.late ? ' · <span style="color:var(--danger)">' + esc(t('afterDue')) + '</span>' : ''}
          <button class="btn small primary" data-action="accept" data-id="${x.id}" data-s='${JSON.stringify(s)}'>${esc(t('accept'))}</button></div>` : `<div class="small" style="color:var(--warn)">${esc(t('noSlot'))}</div>`;
      }
      else if (act === 'accept') { const s = JSON.parse(a.dataset.s); Store.update('tasks', a.dataset.id, { scheduled: { date: s.date, start: s.start, end: s.end } }); toast(t('scheduled')); App.render(); }
    });
    root.addEventListener('submit', e => {
      if (e.target.dataset.form !== 'manual-log') return; e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const start = new Date(parseISO(f.date)); const [h, m] = f.start.split(':').map(Number); start.setHours(h, m);
      const mins = Number(f.minutes) || 0; if (!mins) return;
      Store.add('timeLogs', { start: start.toISOString(), end: new Date(start.getTime() + mins * 60000).toISOString(), minutes: mins, projectId: f.projectId, area: f.projectId ? (Store.get('projects', f.projectId) || {}).area || f.area : f.area, taskId: '', note: f.note });
      toast(t('saved')); App.render();
    });
  },
};
function shiftMonth(iso, n) { const x = parseISO(iso); x.setDate(1); x.setMonth(x.getMonth() + n); return localISO(x); }

function capacityBar(c) {
  const pct = v => c.available ? Math.min(100, v / Math.max(c.available, c.planned) * 100) : 0;
  const msg = c.level === 'over' ? t('capOver', { p: c.planned.toFixed(1), a: c.available.toFixed(1) }) : c.level === 'tight' ? t('capTight') : t('capOk');
  return `<div class="card cap ${c.level}"><div class="row"><strong>${esc(t('capacity'))}</strong><span class="small">${esc(t('capLine', { p: c.planned.toFixed(1), a: c.available.toFixed(1), l: c.logged.toFixed(1) }))}</span><span class="spacer"></span><span class="pill ${c.level === 'over' ? 'danger' : c.level === 'tight' ? 'warn' : 'ok'}">${esc(msg)}</span></div>
    <div class="capbar" title="${esc(t('capLegend'))}"><i class="c-fixed" style="width:${pct(c.fixed)}%"></i><i class="c-lang" style="width:${pct(c.language)}%"></i><i class="c-task" style="width:${pct(c.tasks)}%"></i>${c.available ? `<span class="caplimit" style="left:${Math.min(100, c.available / Math.max(c.available, c.planned) * 100)}%"></span>` : ''}</div>
    <div class="row small muted" style="gap:14px"><span><i class="key c-fixed"></i> ${esc(t('capFixed'))} ${c.fixed.toFixed(1)} h</span><span><i class="key c-lang"></i> ${esc(t('ek_language'))} ${c.language.toFixed(1)} h</span><span><i class="key c-task"></i> ${esc(t('capTasks', { n: c.nTasks }))} ${c.tasks.toFixed(1)} h${c.unestimated ? ` (${esc(t('capUnest', { n: c.unestimated }))})` : ''}</span><span>${esc(t('ek_family'))}: ${c.family.toFixed(1)} h ${esc(t('protected'))}</span></div></div>`;
}

function eventModal(ev, date, start) {
  const v = ev || { title: '', kind: 'deep', date: date || todayISO(), start: start || '09:00', end: start ? fromMin(toMin(start) + 60) : '10:00', allDay: false, recur: 'none', byDays: [], until: '', projectId: '', location: '', notes: '', skip: [] };
  const P = Store.all('projects');
  const dayNames = [1, 2, 3, 4, 5, 6, 0].map(i => `<label class="row small"><input type="checkbox" value="${i}" ${(v.byDays || []).map(Number).includes(i) || (!(v.byDays || []).length && dow(v.date) === i) ? 'checked' : ''}> ${esc(new Date(2024, 0, 7 + i).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short' }))}</label>`).join('');
  const m = modal({
    title: ev ? t('editEvent') : t('newEvent'), wide: true,
    body: `${ev && ev.source === 'ics' ? `<p class="small" style="color:var(--warn)">${esc(t('icsNote'))}</p>` : ''}<div class="grid g4">
      <label class="field span2"><span>${esc(t('p_title'))}</span><input id="ef-title" value="${esc(v.title)}" placeholder="${esc(t('eventHint'))}"></label>
      <label class="field span2"><span>${esc(t('d_kind'))}</span><select id="ef-kind">${options(EVENT_KINDS, v.kind, k => t('ek_' + k))}</select></label>
      <label class="field"><span>${esc(t('date'))}</span><input type="date" id="ef-date" value="${esc(v.date)}"></label>
      <label class="field"><span>${esc(t('ms_start'))}</span><input type="time" id="ef-start" value="${esc(v.start)}" step="900"></label>
      <label class="field"><span>${esc(t('endTime'))}</span><input type="time" id="ef-end" value="${esc(v.end)}" step="900"></label>
      <label class="row small" style="align-self:end"><input type="checkbox" id="ef-allday" ${v.allDay ? 'checked' : ''}> ${esc(t('allDay'))}</label>
      <label class="field"><span>${esc(t('repeat'))}</span><select id="ef-recur">${options(['none', 'weekly', 'daily'], v.recur, k => t('rp_' + k))}</select></label>
      <label class="field"><span>${esc(t('until'))}</span><input type="date" id="ef-until" value="${esc(v.until)}"></label>
      <div class="field span2" id="ef-days-wrap"><span class="small muted">${esc(t('onDays'))}</span><div class="row" id="ef-days">${dayNames}</div></div>
      <label class="field span2"><span>${esc(t('t_project'))}</span><select id="ef-proj"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), v.projectId, projectName)}</select></label>
      <label class="field span2"><span>${esc(t('location'))}</span><input id="ef-loc" value="${esc(v.location)}"></label>
      <label class="field span-all"><span>${esc(t('p_notes'))}</span><textarea id="ef-notes" rows="2">${esc(v.notes)}</textarea></label>
    </div>`,
    foot: `${ev ? `${ev.recur !== 'none' ? `<button class="btn danger" id="ef-skip">${esc(t('delOccurrence'))}</button>` : ''}<button class="btn danger" id="ef-del">${esc(ev.recur !== 'none' ? t('delSeries') : t('delete'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="ef-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ef-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r);
  const sync = () => { g('ef-days-wrap').style.display = g('ef-recur').value === 'weekly' ? '' : 'none'; g('ef-until').disabled = g('ef-recur').value === 'none'; g('ef-start').disabled = g('ef-end').disabled = g('ef-allday').checked; };
  ['ef-recur', 'ef-allday'].forEach(id => g(id).onchange = sync); sync();
  g('ef-start').onchange = () => { if (toMin(g('ef-end').value) <= toMin(g('ef-start').value)) g('ef-end').value = fromMin(toMin(g('ef-start').value) + 60); };
  g('ef-cancel').onclick = m.close;
  g('ef-save').onclick = () => {
    const data = { title: g('ef-title').value.trim() || t('ek_' + g('ef-kind').value), kind: g('ef-kind').value, date: g('ef-date').value, start: g('ef-start').value, end: g('ef-end').value, allDay: g('ef-allday').checked,
      recur: g('ef-recur').value, byDays: $$('#ef-days input:checked', r).map(x => Number(x.value)), until: g('ef-until').value, projectId: g('ef-proj').value, location: g('ef-loc').value, notes: g('ef-notes').value };
    if (!data.date || (!data.allDay && toMin(data.end) <= toMin(data.start))) { toast(t('checkTimes')); return; }
    if (ev) Store.update('events', ev.id, data); else Store.add('events', Object.assign({ skip: [], source: 'local' }, data));
    m.close(); App.render();
  };
  if (ev) {
    g('ef-del').onclick = () => { if (confirmBox(t('delete') + ': ' + ev.title + '?')) { Store.remove('events', ev.id); m.close(); App.render(); } };
    if (g('ef-skip')) g('ef-skip').onclick = () => { Store.update('events', ev.id, { skip: uniq([...(ev.skip || []), date]) }); m.close(); App.render(); };
  }
}

function taskBlockModal(x) {
  const m = modal({
    title: x.title,
    body: `<div class="grid g3"><label class="field"><span>${esc(t('date'))}</span><input type="date" id="tb-date" value="${x.scheduled.date}"></label>
      <label class="field"><span>${esc(t('ms_start'))}</span><input type="time" id="tb-start" value="${x.scheduled.start}" step="900"></label>
      <label class="field"><span>${esc(t('endTime'))}</span><input type="time" id="tb-end" value="${x.scheduled.end}" step="900"></label></div>
      <p class="small muted">${x.projectId ? esc(projectName(x.projectId)) + ' · ' : ''}${x.energy ? esc(t('en_' + x.energy)) : ''}${x.due ? ' · ' + esc(t('t_due')) + ' ' + esc(fmtDate(x.due)) : ''}</p>`,
    foot: `<button class="btn" id="tb-unsched">${esc(t('unschedule'))}</button><button class="btn" id="tb-focus">▶ ${esc(t('focus'))}</button><button class="btn" id="tb-done">✓ ${esc(t('markTaskDone'))}</button><span class="spacer"></span><button class="btn primary" id="tb-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r);
  g('tb-save').onclick = () => { Store.update('tasks', x.id, { scheduled: { date: g('tb-date').value, start: g('tb-start').value, end: g('tb-end').value } }); m.close(); App.render(); };
  g('tb-unsched').onclick = () => { Store.update('tasks', x.id, { scheduled: null }); m.close(); App.render(); };
  g('tb-done').onclick = () => { Store.update('tasks', x.id, { done: true, doneAt: todayISO() }); m.close(); App.render(); };
  g('tb-focus').onclick = () => { m.close(); Timer.start({ taskId: x.id, projectId: x.projectId, planMin: Math.min(90, Cal.taskMinutes(x)) }); };
}

function autoPlanModal() {
  const plan = Cal.autoPlan();
  const m = modal({
    title: t('autoPlan'), wide: true,
    body: `<p class="small muted">${esc(t('autoPlanHelp'))}</p>${plan.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>${esc(t('qa_task'))}</th><th>${esc(t('t_energy'))}</th><th>${esc(t('suggested'))}</th></tr></thead><tbody>
      ${plan.map((p, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td>${esc(p.task.title)}${p.task.due ? `<div class="small faint">${esc(t('t_due'))} ${esc(fmtDate(p.task.due))}</div>` : ''}</td><td>${p.task.energy ? `<span class="pill e-${p.task.energy}">${esc(t('en_' + p.task.energy))}</span>` : '—'}</td>
        <td class="small" style="white-space:nowrap">${esc(fmtDate(p.slot.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${p.slot.start}–${p.slot.end}${p.slot.partial ? `<div class="faint">${esc(t('partial'))}</div>` : ''}${p.slot.late ? `<div style="color:var(--danger)">${esc(t('afterDue'))}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${esc(t('allScheduled'))}</p>`}`,
    foot: `<button class="btn" id="ap-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ap-ok" ${plan.length ? '' : 'disabled'}>${esc(t('scheduleSelected'))}</button>`,
  });
  const r = m.root;
  $('#ap-cancel', r).onclick = m.close;
  $('#ap-ok', r).onclick = () => {
    let n = 0; $$('[data-i]:checked', r).forEach(c => { const p = plan[Number(c.dataset.i)]; p.task.scheduled = { date: p.slot.date, start: p.slot.start, end: p.slot.end }; n++; });
    Store.change(); toast(t('scheduledN', { n })); m.close(); App.render();
  };
}

function availabilityModal() {
  const S = Store.data.settings;
  const days = [1, 2, 3, 4, 5, 6, 0];
  const m = modal({
    title: t('availability'), wide: true,
    body: `<p class="small muted">${esc(t('availHelp'))}</p>
      <div class="grid g4">${days.map(i => `<label class="field"><span>${esc(new Date(2024, 0, 7 + i).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long' }))}</span><input type="number" min="0" max="16" step="0.5" data-wh="${i}" value="${S.workHours[i]}"></label>`).join('')}</div>
      <h3 class="small muted" style="margin-top:8px">${esc(t('energyWindows'))}</h3>
      <div class="grid g3">${ENERGY.map(k => `<div class="field"><span class="small muted">${esc(t('en_' + k))}</span><div class="row"><input type="time" data-ew="${k}" data-i="0" value="${S.energyWindows[k][0]}" step="900" style="flex:1"> – <input type="time" data-ew="${k}" data-i="1" value="${S.energyWindows[k][1]}" step="900" style="flex:1"></div></div>`).join('')}</div>
      <div class="grid g4"><label class="field"><span>${esc(t('gridStart'))}</span><input type="number" min="0" max="12" id="av-g0" value="${S.gridStart}"></label><label class="field"><span>${esc(t('gridEnd'))}</span><input type="number" min="13" max="24" id="av-g1" value="${S.gridEnd}"></label></div>`,
    foot: `<button class="btn" id="av-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="av-save">${esc(t('save'))}</button>`,
  });
  const r = m.root;
  $('#av-cancel', r).onclick = m.close;
  $('#av-save', r).onclick = () => {
    $$('[data-wh]', r).forEach(x => S.workHours[x.dataset.wh] = Number(x.value) || 0);
    $$('[data-ew]', r).forEach(x => S.energyWindows[x.dataset.ew][Number(x.dataset.i)] = x.value);
    S.gridStart = Number($('#av-g0', r).value) || 7; S.gridEnd = Number($('#av-g1', r).value) || 22;
    Store.change(); m.close(); App.render();
  };
}

function exportIcsModal() {
  const m = modal({
    title: t('exportIcs'),
    body: `<p class="small muted">${esc(t('icsExportHelp'))}</p>
      ${['events', 'meetings', 'tasks', 'dues'].map(k => `<label class="row"><input type="checkbox" data-k="${k}" checked> ${esc(t('ics_' + k))}</label>`).join('')}`,
    foot: `<button class="btn" id="ix-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ix-ok">⇩ .ics</button>`,
  });
  const r = m.root;
  $('#ix-cancel', r).onclick = m.close;
  $('#ix-ok', r).onclick = () => {
    const o = {}; $$('[data-k]', r).forEach(c => o[c.dataset.k] = c.checked);
    download(`phd-command-centre-${todayISO()}.ics`, Cal.exportICS(o), 'text/calendar'); m.close();
  };
}
function importIcsModal() {
  const m = modal({
    title: t('importIcs'),
    body: `<p class="small muted">${esc(t('icsImportHelp'))}</p><label class="field"><span>${esc(t('importAs'))}</span><select id="ii-kind">${options(EVENT_KINDS, 'meeting', k => t('ek_' + k))}</select></label>`,
    foot: `<button class="btn" id="ii-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ii-ok">${esc(t('chooseFile'))}</button>`,
  });
  const r = m.root;
  $('#ii-cancel', r).onclick = m.close;
  $('#ii-ok', r).onclick = async () => {
    const f = await pickFile('.ics,text/calendar'); if (!f) return;
    const list = Cal.importICS(await f.text(), $('#ii-kind', r).value);
    const ids = new Set(list.map(e => e.id));
    Store.data.events = Store.data.events.filter(e => !ids.has(e.id)).concat(list.map(e => Object.assign({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, e)));
    Store.change(); toast(t('icsImported', { n: list.length }), 4000); m.close(); App.render();
  };
}
