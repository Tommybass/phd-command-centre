/* Calendar engine: occurrences, free slots, scheduling suggestions, weekly capacity, .ics export/import; focus timer */
const toMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.round(n % 60)).padStart(2, '0')}`;
const dow = iso => parseISO(iso).getDay();
const ENERGY_DEFAULT_MIN = { deep: 120, light: 60, admin: 30, '': 60 };
const WORK_KINDS = ['class', 'meeting', 'admin', 'other'];

const Cal = {
  taskMinutes(x) { return x.estimateH ? Math.round(Number(x.estimateH) * 60) : ENERGY_DEFAULT_MIN[x.energy || '']; },

  /* Every timed or all-day item between two ISO dates (inclusive) */
  items(from, to) {
    const out = [];
    for (const ev of Store.all('events')) {
      const push = date => { if (!(ev.skip || []).includes(date)) out.push({ src: 'event', id: ev.id, ev, date, title: ev.title, kind: ev.kind, start: ev.start, end: ev.end, allDay: ev.allDay }); };
      if (!ev.date) continue;
      if (ev.recur === 'none' || !ev.recur) { if (ev.date >= from && ev.date <= to) push(ev.date); continue; }
      const days = ev.recur === 'weekly' ? (ev.byDays && ev.byDays.length ? ev.byDays.map(Number) : [dow(ev.date)]) : [0, 1, 2, 3, 4, 5, 6];
      let d = ev.date > from ? ev.date : from;
      const stop = ev.until && ev.until < to ? ev.until : to;
      while (d <= stop) { if (days.includes(dow(d))) push(d); d = addDays(d, 1); }
    }
    for (const x of Store.all('tasks')) {
      if (x.scheduled && x.scheduled.date >= from && x.scheduled.date <= to) out.push({ src: 'task', id: x.id, task: x, date: x.scheduled.date, title: x.title, kind: 'task', energy: x.energy, start: x.scheduled.start, end: x.scheduled.end, done: x.done });
      if (!x.done && x.due && x.due >= from && x.due <= to) out.push({ src: 'due', id: x.id, date: x.due, title: x.title, kind: 'due', allDay: true, href: '#/dashboard' });
    }
    for (const m of Store.all('meetings')) if (m.date >= from && m.date <= to) {
      out.push({ src: 'meeting', id: m.id, date: m.date, title: meetingTitle(m), kind: 'meeting', start: m.time || '10:00', end: fromMin(toMin(m.time || '10:00') + (Number(m.duration) || 60)), href: '#/meetings/' + m.id });
      (m.actions || []).filter(a => !a.done && a.due && a.owner !== 'me').forEach(a => { if (a.due >= from && a.due <= to) out.push({ src: 'due', id: m.id, date: a.due, title: a.text, kind: 'due', allDay: true, href: '#/meetings/' + m.id }); });
    }
    for (const m of Store.all('milestones')) if (m.status !== 'done' && m.due >= from && m.due <= to) out.push({ src: 'due', id: m.id, date: m.due, title: '◆ ' + m.title, kind: 'due', allDay: true, href: '#/projects/milestones' });
    for (const d of Store.all('deadlines')) if (d.due >= from && d.due <= to) out.push({ src: 'due', id: d.id, date: d.due, title: '⚑ ' + d.title, kind: 'due', allDay: true, href: '#/projects/deadlines' });
    for (const p of Store.all('projects')) if (p.deadline && p.deadline >= from && p.deadline <= to) out.push({ src: 'due', id: p.id, date: p.deadline, title: '⚑ ' + p.title, kind: 'due', allDay: true, href: '#/projects/list' });
    return out;
  },
  busy(date, extra = []) {
    return this.items(date, date).filter(i => !i.allDay && i.start && i.end && i.kind !== 'deep' && !(i.src === 'task' && i.done))
      .map(i => [toMin(i.start), toMin(i.end)]).concat(extra.filter(e => e.date === date).map(e => [toMin(e.start), toMin(e.end)])).sort((a, b) => a[0] - b[0]);
  },

  /* Earliest free slot in the task's energy window, within working days, avoiding everything already booked */
  suggest(task, extra = [], fromDate = todayISO()) {
    const S = Store.data.settings, win = S.energyWindows[task.energy || 'light'] || S.energyWindows.light;
    const need = this.taskMinutes(task);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    for (let i = 0; i < 21; i++) {
      const date = addDays(fromDate, i);
      if (!(Number(S.workHours[dow(date)]) > 0)) continue;
      let ws = toMin(win[0]); const we = toMin(win[1]);
      if (date === todayISO()) ws = Math.max(ws, Math.ceil((nowMin + 5) / 15) * 15);
      if (we - ws < 15) continue;
      let cursor = ws;
      const len = Math.min(need, we - ws);
      for (const [a, b] of this.busy(date, extra).concat([[we, we]])) {
        if (a - cursor >= len && cursor + len <= we) return { date, start: fromMin(cursor), end: fromMin(cursor + len), partial: len < need, late: task.due && date > task.due };
        cursor = Math.max(cursor, b);
        if (cursor >= we) break;
      }
    }
    return null;
  },
  autoPlan(fromDate = todayISO()) {
    const rank = { deep: 0, light: 1, admin: 2, '': 1 };
    const todo = Store.all('tasks').filter(x => !x.done && !x.scheduled)
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (b.top ? 1 : 0) - (a.top ? 1 : 0) || rank[a.energy || ''] - rank[b.energy || '']).slice(0, 25);
    const extra = [], out = [];
    for (const x of todo) { const s = this.suggest(x, extra, fromDate); if (s) { extra.push(s); out.push({ task: x, slot: s }); } }
    return out;
  },

  /* Weekly capacity: planned hours vs the hours you said you are willing to work */
  capacity(weekStart = startOfWeek()) {
    const S = Store.data.settings, end = addDays(weekStart, 6);
    let available = 0; for (let i = 0; i < 7; i++) available += Number(S.workHours[dow(addDays(weekStart, i))]) || 0;
    const it = this.items(weekStart, end);
    const hrs = i => Math.max(0, toMin(i.end) - toMin(i.start)) / 60;
    const fixed = it.filter(i => (i.src === 'event' && WORK_KINDS.includes(i.kind) && !i.allDay) || i.src === 'meeting').reduce((s, i) => s + hrs(i), 0);
    const language = it.filter(i => i.src === 'event' && i.kind === 'language').reduce((s, i) => s + hrs(i), 0);
    const family = it.filter(i => i.src === 'event' && i.kind === 'family').reduce((s, i) => s + hrs(i), 0);
    const deep = it.filter(i => i.src === 'event' && i.kind === 'deep').reduce((s, i) => s + hrs(i), 0);
    const tasksIn = Store.all('tasks').filter(x => !x.done && ((x.scheduled && x.scheduled.date >= weekStart && x.scheduled.date <= end) || (!x.scheduled && x.due && x.due <= end)));
    const tasks = tasksIn.reduce((s, x) => s + this.taskMinutes(x) / 60, 0);
    const unestimated = tasksIn.filter(x => !x.estimateH).length;
    const planned = fixed + language + tasks;
    const logged = Store.all('timeLogs').filter(l => l.start.slice(0, 10) >= weekStart && l.start.slice(0, 10) <= end).reduce((s, l) => s + (Number(l.minutes) || 0), 0) / 60;
    const ratio = available ? planned / available : (planned ? 9 : 0);
    return { available, fixed, language, family, deep, tasks, unestimated, nTasks: tasksIn.length, planned, logged, level: ratio > 1 ? 'over' : ratio > 0.9 ? 'tight' : 'ok', ratio };
  },

  /* ---------- .ics export (RFC 5545, floating local times so Google uses your calendar's time zone) ---------- */
  icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); },
  icsFold(line) { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); },
  icsDT(date, hm) { return date.replace(/-/g, '') + (hm ? 'T' + hm.replace(':', '') + '00' : ''); },
  exportICS(opts) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PhD Command Centre//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:PhD Command Centre'];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const ve = (uidv, summary, date, start, end, extra = []) => {
      L.push('BEGIN:VEVENT', `UID:${uidv}@phd-command-centre`, `DTSTAMP:${stamp}`);
      if (start) L.push(`DTSTART:${this.icsDT(date, start)}`, `DTEND:${this.icsDT(date, end)}`);
      else L.push(`DTSTART;VALUE=DATE:${this.icsDT(date)}`, `DTEND;VALUE=DATE:${this.icsDT(addDays(date, 1))}`);
      L.push(`SUMMARY:${this.icsEsc(summary)}`, ...extra, 'END:VEVENT');
    };
    if (opts.events) for (const e of Store.all('events').filter(e => e.source !== 'ics')) {
      const extra = [];
      if (e.recur === 'weekly') extra.push(`RRULE:FREQ=WEEKLY;BYDAY=${(e.byDays && e.byDays.length ? e.byDays : [dow(e.date)]).map(d => BYDAY[d]).join(',')}${e.until ? ';UNTIL=' + this.icsDT(e.until) + 'T235959' : ''}`);
      if (e.recur === 'daily') extra.push(`RRULE:FREQ=DAILY${e.until ? ';UNTIL=' + this.icsDT(e.until) + 'T235959' : ''}`);
      (e.skip || []).forEach(sd => extra.push(e.allDay ? `EXDATE;VALUE=DATE:${this.icsDT(sd)}` : `EXDATE:${this.icsDT(sd, e.start)}`));
      if (e.location) extra.push(`LOCATION:${this.icsEsc(e.location)}`);
      extra.push(`CATEGORIES:${this.icsEsc(t('ek_' + e.kind))}`);
      if (e.notes) extra.push(`DESCRIPTION:${this.icsEsc(e.notes)}`);
      ve(e.id, e.title, e.date, e.allDay ? '' : e.start, e.allDay ? '' : e.end, extra);
    }
    if (opts.meetings) for (const m of Store.all('meetings')) ve(m.id, meetingTitle(m), m.date, m.time || '10:00', fromMin(toMin(m.time || '10:00') + (Number(m.duration) || 60)), [`CATEGORIES:${this.icsEsc(t('ek_meeting'))}`]);
    if (opts.tasks) for (const x of Store.all('tasks').filter(x => x.scheduled && !x.done)) ve(x.id + '-block', '▸ ' + x.title, x.scheduled.date, x.scheduled.start, x.scheduled.end);
    if (opts.dues) for (const i of this.items(todayISO(), addDays(todayISO(), 400)).filter(i => i.src === 'due')) ve(i.id + '-due-' + i.date, i.title.startsWith('◆') || i.title.startsWith('⚑') ? i.title : 'Due: ' + i.title, i.date, '', '');
    L.push('END:VCALENDAR');
    return L.map(l => this.icsFold(l)).join('\r\n') + '\r\n';
  },

  /* ---------- .ics import ---------- */
  importICS(text, kind) {
    const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const evs = []; let cur = null;
    const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const parseDT = (val, params) => {
      const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
      if (!m[4] || /VALUE=DATE(?!-)/.test(params)) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
      if (m[7]) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); return { date: localISO(d), time: fromMin(d.getHours() * 60 + d.getMinutes()) }; }
      return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };   // TZID or floating: treated as local (Eastern)
    };
    for (const raw of lines) {
      if (raw === 'BEGIN:VEVENT') { cur = { skip: [] }; continue; }
      if (raw === 'END:VEVENT') { if (cur && cur.start) evs.push(cur); cur = null; continue; }
      if (!cur) continue;
      const i = raw.indexOf(':'); if (i < 0) continue;
      const head = raw.slice(0, i), val = raw.slice(i + 1), [name, ...ps] = head.split(';'), params = ps.join(';');
      const un = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
      if (name === 'SUMMARY') cur.title = un(val);
      else if (name === 'UID') cur.uid = val;
      else if (name === 'LOCATION') cur.location = un(val);
      else if (name === 'DESCRIPTION') cur.notes = un(val).slice(0, 1000);
      else if (name === 'DTSTART') cur.start = parseDT(val, params);
      else if (name === 'DTEND') cur.end = parseDT(val, params);
      else if (name === 'RRULE') cur.rrule = Object.fromEntries(val.split(';').map(p => p.split('=')));
      else if (name === 'EXDATE') val.split(',').forEach(v => { const p = parseDT(v, params); if (p) cur.skip.push(p.date); });
    }
    const out = [];
    for (const e of evs) {
      const allDay = !e.start.time;
      let recur = 'none', byDays = [], until = '';
      if (e.rrule) {
        if (e.rrule.FREQ === 'WEEKLY') { recur = 'weekly'; byDays = (e.rrule.BYDAY || '').split(',').map(d => DAYS[d.slice(-2)]).filter(d => d != null); }
        else if (e.rrule.FREQ === 'DAILY') recur = 'daily';
        else continue;    // monthly/yearly rules are skipped rather than shown wrongly
        if (e.rrule.UNTIL) { const u = parseDT(e.rrule.UNTIL, ''); until = u ? u.date : ''; }
        if (e.rrule.COUNT && recur === 'weekly') until = addDays(e.start.date, Math.ceil(Number(e.rrule.COUNT) / Math.max(1, byDays.length || 1)) * 7);
      }
      if (recur === 'none' && e.start.date < addDays(todayISO(), -60)) continue;   // skip old one-off events
      out.push({ id: 'ics_' + (e.uid || uid()).replace(/[^A-Za-z0-9]/g, '').slice(0, 40), title: e.title || '(no title)', kind, date: e.start.date, start: allDay ? '' : e.start.time, end: allDay ? '' : (e.end && e.end.time) || fromMin(toMin(e.start.time) + 60),
        allDay, recur, byDays, until, skip: e.skip, location: e.location || '', notes: e.notes || '', source: 'ics', projectId: '' });
    }
    return out;
  },
};

/* ---------- Focus timer (state lives in the data file, so it survives a reload) ---------- */
const Timer = {
  tick: null, alerted: false,
  get state() { return Store.data.timer; },
  elapsedMin() { return this.state ? (Date.now() - new Date(this.state.start)) / 60000 : 0; },
  start({ projectId, taskId, area, planMin }) {
    const p = projectId && Store.get('projects', projectId);
    Store.data.timer = { start: new Date().toISOString(), projectId: projectId || '', taskId: taskId || '', area: area || (p ? p.area : 'thesis'), planMin: Number(planMin) || 0 };
    this.alerted = false; Store.change(); this.run();
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { }
  },
  stop(save = true) {
    const s = this.state; if (!s) return null;
    const minutes = Math.round(this.elapsedMin());
    let log = null;
    if (save && minutes >= 1) log = Store.add('timeLogs', { start: s.start, end: new Date().toISOString(), minutes, projectId: s.projectId, taskId: s.taskId, area: s.area, note: '' });
    Store.data.timer = null; Store.change(); this.run();
    return log;
  },
  label() {
    const s = this.state; if (!s) return '';
    const sec = Math.floor((Date.now() - new Date(s.start)) / 1000);
    const show = s.planMin ? Math.max(0, s.planMin * 60 - sec) : sec;
    const mm = Math.floor(show / 60), ss = String(show % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  },
  run() {
    clearInterval(this.tick);
    const btn = $('#timer-btn'); if (!btn) return;
    const paint = () => {
      const s = this.state;
      if (!s) { btn.classList.remove('running'); btn.innerHTML = `▶ <span class="hide-sm">${esc(t('focus'))}</span>`; document.title = 'PhD Command Centre'; return; }
      const name = s.taskId ? (Store.get('tasks', s.taskId) || {}).title : projectName(s.projectId) || t('area_' + s.area);
      btn.classList.add('running'); btn.innerHTML = `■ <b>${this.label()}</b> <span class="hide-sm timer-name">${esc((name || '').slice(0, 28))}</span>`;
      document.title = `${this.label()} · ${name || 'Focus'}`;
      if (s.planMin && !this.alerted && this.elapsedMin() >= s.planMin) {
        this.alerted = true; toast(t('timerDone'), 6000); beep();
        try { if (window.Notification && Notification.permission === 'granted') new Notification('PhD Command Centre', { body: t('timerDone') }); } catch { }
      }
    };
    paint(); if (this.state) this.tick = setInterval(paint, 1000);
  },
};
function beep() {
  try { const A = new (window.AudioContext || window.webkitAudioContext)(); const o = A.createOscillator(), g = A.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.15, A.currentTime); g.gain.exponentialRampToValueAtTime(0.001, A.currentTime + 1.2); o.connect(g).connect(A.destination); o.start(); o.stop(A.currentTime + 1.2); } catch { }
}
function meetingTitle(m) { return `${t('mk_' + m.kind)}${m.with ? ' — ' + m.with : ''}`; }

function openTimer() {
  if (Timer.state) {
    const s = Timer.state, min = Math.round(Timer.elapsedMin());
    const m = modal({
      title: t('focus'),
      body: `<p>${esc(t('timerRunning', { n: min }))} <strong>${esc(s.taskId ? (Store.get('tasks', s.taskId) || {}).title || '' : projectName(s.projectId) || t('area_' + s.area))}</strong></p>
        <label class="field"><span>${esc(t('logNote'))}</span><input id="tm-note" placeholder="${esc(t('timerNoteHint'))}"></label>
        ${s.taskId ? `<label class="row small"><input type="checkbox" id="tm-done"> ${esc(t('markTaskDone'))}</label>` : ''}`,
      foot: `<button class="btn danger" id="tm-discard">${esc(t('discard'))}</button><span class="spacer"></span><button class="btn" id="tm-cancel">${esc(t('keepGoing'))}</button><button class="btn primary" id="tm-stop">${esc(t('stopSave'))}</button>`,
    });
    const r = m.root;
    $('#tm-cancel', r).onclick = m.close;
    $('#tm-discard', r).onclick = () => { if (confirmBox(t('discardConfirm'))) { Timer.stop(false); m.close(); App.render(); } };
    $('#tm-stop', r).onclick = () => {
      const note = $('#tm-note', r).value, done = $('#tm-done', r) && $('#tm-done', r).checked, tid = s.taskId;
      const log = Timer.stop(true); if (log && note) Store.update('timeLogs', log.id, { note });
      if (done && tid) Store.update('tasks', tid, { done: true, doneAt: todayISO() });
      toast(log ? t('timeLogged', { n: log.minutes }) : t('tooShort')); m.close(); App.render();
    };
    return;
  }
  const P = Store.all('projects'), T = Store.all('tasks').filter(x => !x.done);
  const m = modal({
    title: t('focus'),
    body: `<div class="grid g2">
      <label class="field span-all"><span>${esc(t('qa_task'))} (${esc(t('optional'))})</span><select id="tm-task"><option value="">${esc(t('none'))}</option>${T.map(x => `<option value="${x.id}">${esc(x.title.slice(0, 80))}</option>`).join('')}</select></label>
      <label class="field"><span>${esc(t('t_project'))}</span><select id="tm-proj"><option value="">${esc(t('none'))}</option>${options(P.map(p => p.id), (P.find(p => p.area === 'thesis') || {}).id, projectName)}</select></label>
      <label class="field"><span>${esc(t('p_area'))}</span><select id="tm-area">${options(AREAS, 'thesis', a => t('area_' + a))}</select></label>
      <div class="field span-all"><span class="small muted">${esc(t('duration'))}</span><div class="chip-row" style="margin-top:4px">${[25, 50, 90, 0].map((n, i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-min="${n}">${n ? n + ' min' : esc(t('openEnded'))}</button>`).join('')}</div></div>
    </div>`,
    foot: `<button class="btn" id="tm-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="tm-start">▶ ${esc(t('start'))}</button>`,
  });
  const r = m.root; let plan = 25;
  r.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { plan = Number(b.dataset.min); r.querySelectorAll('[data-min]').forEach(x => x.classList.toggle('on', x === b)); });
  const syncArea = () => { const p = Store.get('projects', $('#tm-proj', r).value); if (p) $('#tm-area', r).value = p.area; };
  $('#tm-proj', r).onchange = syncArea; syncArea();
  $('#tm-task', r).onchange = () => { const x = Store.get('tasks', $('#tm-task', r).value); if (x && x.projectId) { $('#tm-proj', r).value = x.projectId; syncArea(); } };
  $('#tm-cancel', r).onclick = m.close;
  $('#tm-start', r).onclick = () => { Timer.start({ projectId: $('#tm-proj', r).value, taskId: $('#tm-task', r).value, area: $('#tm-area', r).value, planMin: plan }); m.close(); };
}
