/* Milestone progress, slip warnings, backward planning, writing statistics, roadmap template */
const Plan = {
  msTasks(m) { return Store.all('tasks').filter(x => x.milestoneId === m.id); },
  progress(m) {
    if (m.status === 'done') return 100;
    const tk = this.msTasks(m);
    if (tk.length) return Math.round(tk.filter(x => x.done).length / tk.length * 100);
    return Math.max(0, Math.min(100, Number(m.percent) || 0));
  },
  /* level: done | ok | risk | late | blocked */
  health(m) {
    if (m.status === 'done') return { level: 'done', msg: t('h_done') };
    const today = todayISO();
    const deps = (m.dependsOn || []).map(id => Store.get('milestones', id)).filter(Boolean);
    const conflict = deps.find(d => d.status !== 'done' && d.due && m.due && d.due > m.due);
    if (conflict) return { level: 'blocked', msg: t('h_conflict', { x: conflict.title }) };
    if (m.due && m.due < today) return { level: 'late', msg: t('h_late', { n: -daysUntil(m.due) }) };
    const waiting = deps.find(d => d.status !== 'done');
    if (waiting && (m.status === 'doing' || (m.start && m.start <= today))) return { level: 'blocked', msg: t('h_waiting', { x: waiting.title }) };
    const p = this.progress(m);
    if (m.start && m.due && m.start <= today && m.due > m.start) {
      const used = Math.round((daysUntil(m.start) * -1) / ((parseISO(m.due) - parseISO(m.start)) / 86400000) * 100);
      if (p < used - 20) return { level: 'risk', msg: t('h_behind', { p, u: Math.min(used, 100) }) };
    }
    if (m.due && daysUntil(m.due) <= 14 && p < 50) return { level: 'risk', msg: t('h_soon', { n: daysUntil(m.due), p }) };
    return { level: 'ok', msg: t('h_ok') };
  },
  projectProgress(pid) {
    const ms = Store.all('milestones').filter(m => m.projectId === pid);
    if (!ms.length) return null;
    return Math.round(ms.reduce((s, m) => s + this.progress(m), 0) / ms.length);
  },
  warnings() {
    return Store.all('milestones').map(m => ({ m, h: this.health(m) })).filter(x => ['late', 'risk', 'blocked'].includes(x.h.level))
      .sort((a, b) => (a.m.due || '9999').localeCompare(b.m.due || '9999'));
  },

  /* Backward planning: spread steps (with optional "~6h" estimates) over the weeks before a deadline */
  backward({ start, deadline, steps, hoursPerWeek, buffer }) {
    const parsed = steps.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/~\s*(\d+(?:[.,]\d+)?)\s*h\b/i);
      return { title: l.replace(/~\s*\d+(?:[.,]\d+)?\s*h\b/i, '').replace(/^[-*]\s*/, '').trim(), hours: m ? Number(m[1].replace(',', '.')) : 3, estimated: !!m };
    });
    const weeks = []; let w = startOfWeek(start < todayISO() ? todayISO() : start);
    const last = startOfWeek(deadline);
    while (w <= last) { weeks.push(w); w = addDays(w, 7); }
    let usable = weeks.slice();
    if (buffer && usable.length > 1) usable = usable.slice(0, -1);
    const total = parsed.reduce((s, x) => s + x.hours, 0);
    const cap = Math.max(0.5, Number(hoursPerWeek) || 5);
    const rows = []; let wi = 0, left = cap, overload = false;
    for (const st of parsed) {
      let need = st.hours;
      while (need > 0) {
        if (wi >= usable.length) { overload = true; wi = usable.length - 1; left = Infinity; }
        const take = Math.min(need, left); need -= take; left -= take;
        if (need > 0) { wi++; left = cap; }
      }
      const weekStart = usable[Math.max(0, wi)] || weeks[0];
      let due = addDays(weekStart, 4); if (due > deadline) due = deadline;
      rows.push({ title: st.title, hours: st.hours, estimated: st.estimated, weekStart, due });
      if (left <= 0) { wi++; left = cap; }
    }
    return { rows, weeks: usable.length, total, needed: usable.length ? Math.ceil(total / usable.length * 10) / 10 : total, overload };
  },

  /* ---------- Writing ---------- */
  wordsByDate() { const m = {}; Store.all('writingLogs').forEach(l => { m[l.date] = (m[l.date] || 0) + (Number(l.words) || 0); }); return m; },
  streaks() {
    const by = this.wordsByDate();
    let cur = 0, d = todayISO();
    if (!(by[d] > 0)) d = addDays(d, -1);
    while (by[d] > 0) { cur++; d = addDays(d, -1); }
    const days = Object.keys(by).filter(k => by[k] > 0).sort();
    let best = 0, run = 0, prev = null;
    for (const k of days) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    return { current: cur, best, wroteToday: by[todayISO()] > 0 };
  },
  weekWords() { const wk = startOfWeek(); return Store.all('writingLogs').filter(l => l.date >= wk).reduce((s, l) => s + (Number(l.words) || 0), 0); },
  pace(pid, days = 14) {
    const from = addDays(todayISO(), -days + 1);
    const w = Store.all('writingLogs').filter(l => l.projectId === pid && l.date >= from).reduce((s, l) => s + (Number(l.words) || 0), 0);
    return w / days;
  },

  /* Concordia PhD in Education roadmap (from the Graduate Calendar, EDUC 8090/8091/8092). Dates are placeholders. */
  concordiaTemplate(pid) {
    const m0 = todayISO(), M = n => { const d = parseISO(m0); d.setMonth(d.getMonth() + n); return localISO(d); };
    const cal = 'Concordia Graduate Calendar, Education PhD courses (EDUC 8090–8092). Check the department handbook for procedures.';
    const L = [
      ['course', 'Coursework complete', '', m0, 'done', 'Required courses, research methods and tutorial (EDUC 8000, 8001, 8010 + methods).', []],
      ['compq', 'Comprehensive exam: receive question from supervisory committee', M(2), M(4), 'todo', 'EDUC 8090 (6 cr). Ideally within two terms of finishing coursework. ' + cal, ['course']],
      ['compw', 'Comprehensive exam: written response (one month)', M(4), M(5), 'todo', 'Written answer over a one-month period.', ['compq']],
      ['compo', 'Comprehensive exam: oral defence → candidacy', M(5), M(6), 'todo', 'Must be passed before submitting the proposal. A second failure means withdrawal.', ['compw']],
      ['propw', 'Doctoral proposal: written proposal to supervisor and committee', M(6), M(11), 'todo', 'EDUC 8091 (9 cr). Ideally within two terms after the comprehensive exam. Rationale, literature, methods, research agenda.', ['compo']],
      ['propo', 'Doctoral proposal: oral defence', M(11), M(12), 'todo', 'May be accepted, returned for modifications, or rejected.', ['propw']],
      ['ethics', 'Research ethics approval (Concordia and participating CEGEPs)', M(12), M(15), 'todo', 'Check whether each participating CEGEP requires its own ethics review. Include Law 25 data plan.', ['propo']],
      ['dataq', 'Data collection: quantitative strand', M(15), M(20), 'todo', '', ['ethics']],
      ['dataql', 'Data collection: embedded qualitative strand', M(16), M(22), 'todo', '', ['ethics']],
      ['analysis', 'Analysis and integration', M(20), M(27), 'todo', '', ['dataq', 'dataql']],
      ['chapters', 'Chapter drafts', M(12), M(34), 'todo', 'Track words in the Writing tracker.', ['propo']],
      ['full', 'Full thesis draft to supervisor', M(34), M(38), 'todo', '', ['chapters', 'analysis']],
      ['submit', 'Thesis submission', M(38), M(42), 'todo', 'EDUC 8092 (60 cr). See the thesis regulations in the Graduate Calendar.', ['full']],
      ['defence', 'Oral defence', M(42), M(45), 'todo', '', ['submit']],
    ];
    const ids = {}; L.forEach(r => ids[r[0]] = uid('m_'));
    return L.map(([k, title, start, due, status, notes, deps]) => ({ id: ids[k], projectId: pid, title, start, due, status, percent: status === 'done' ? 100 : 0, notes, dependsOn: deps.map(d => ids[d]), verify: k !== 'course' }));
  },
};
