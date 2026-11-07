/* Weekly review, monthly progress report, end-of-term reflection */
function periodStats(from, to) {
  const inR = d => d && d >= from && d <= to;
  const tasks = Store.all('tasks').filter(x => x.done && inR(x.doneAt));
  const ms = Store.all('milestones').filter(m => m.status === 'done' && inR((m.updatedAt || '').slice(0, 10)));
  const logs = Store.all('timeLogs').filter(l => inR(l.start.slice(0, 10)));
  const byArea = {}; logs.forEach(l => byArea[l.area] = (byArea[l.area] || 0) + l.minutes);
  const words = Store.all('writingLogs').filter(w => inR(w.date)).reduce((s, w) => s + w.words, 0);
  const passes = Store.all('sources').flatMap(s => (s.passLog || []).filter(p => inR(p.date)).map(p => ({ s, p })));
  const notes = Store.all('notes').filter(n => inR(n.date));
  const meetings = Store.all('meetings').filter(m => inR(m.date) && m.date <= todayISO());
  const cardsReviewed = Object.entries(Store.data.cardLog || {}).filter(([d]) => inR(d)).reduce((s, [, n]) => s + n, 0);
  return { from, to, tasks, ms, hours: logs.reduce((s, l) => s + l.minutes, 0) / 60, byArea, words, passes, notes, meetings, cardsReviewed };
}
function statsHtml(st) {
  const n = (v, l) => `<div><div class="stat" style="font-size:1.5rem">${v}</div><span class="small muted">${esc(l)}</span></div>`;
  return `<div class="row" style="gap:22px;flex-wrap:wrap">${n(st.tasks.length, t('rv_tasks'))}${n(st.hours.toFixed(1), t('rv_hours'))}${n(st.words.toLocaleString(), t('words'))}${n(st.passes.length, t('rv_passes'))}${n(st.notes.length, t('rv_notes'))}${n(st.cardsReviewed, t('rv_cards'))}</div>
    <div class="chip-row" style="margin-top:8px">${Object.entries(st.byArea).sort((a, b) => b[1] - a[1]).map(([a, m]) => `<span class="pill">${esc(t('area_' + a))} ${(m / 60).toFixed(1)} h</span>`).join('')}</div>`;
}
function termOf(iso) { const [y, m] = iso.split('-').map(Number); const k = m >= 9 ? 'fall' : m >= 5 ? 'summer' : 'winter'; return `${y}-${k}`; }
function termRange(key) { const [y, k] = key.split('-'); return k === 'fall' ? [`${y}-09-01`, `${y}-12-31`] : k === 'winter' ? [`${y}-01-01`, `${y}-04-30`] : [`${y}-05-01`, `${y}-08-31`]; }
function termLabel(key) { const [y, k] = key.split('-'); return `${t('term_' + k)} ${y}`; }
function weeklyReviewDue() {
  const day = new Date().getDay(), rd = Number(Store.data.settings.reviewDay);
  const passed = ((day - rd + 7) % 7) <= ((0 - rd + 7) % 7);   // review day through Sunday
  return passed && !Store.all('reviews').some(r => r.kind === 'weekly' && r.period === startOfWeek());
}

const ReviewsView = {
  render(params, query) {
    const tab = params[0] || 'weekly';
    const tabs = ['weekly', 'monthly', 'term'].map(k => `<a class="tab ${tab === k ? 'active' : ''}" href="#/reviews/${k}">${esc(t('rvt_' + k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_reviews'))}</h1><p class="sub">${esc(t('reviewsSub'))}</p></div></div><nav class="tabs">${tabs}</nav>`;
    return head + (tab === 'monthly' ? this.monthly(query) : tab === 'term' ? this.term(query) : this.weekly(query));
  },

  weekly(q) {
    const ws = q.w || startOfWeek(), we = addDays(ws, 6);
    const r = Store.all('reviews').find(x => x.kind === 'weekly' && x.period === ws) || { wins: '', blockers: '', lessons: '', plan: '', energy: 3 };
    const st = periodStats(ws, we);
    const overdue = Store.all('tasks').filter(x => !x.done && x.due && x.due < todayISO());
    const risks = Plan.warnings();
    const nextDue = Store.all('tasks').filter(x => !x.done && x.due && x.due > we && x.due <= addDays(we, 7));
    const nextMs = Store.all('milestones').filter(m => m.status !== 'done' && m.due && m.due > we && m.due <= addDays(we, 14));
    const sugg = (field, lines) => lines.length ? `<button class="btn small" data-fill="${field}" data-lines="${esc(JSON.stringify(lines))}">+ ${esc(t('insertSuggestions', { n: lines.length }))}</button>` : '';
    const past = Store.all('reviews').filter(x => x.kind === 'weekly').sort((a, b) => b.period.localeCompare(a.period));
    const F = (k, label, hint, extra) => `<label class="field"><span>${esc(label)} ${extra || ''}</span><textarea data-rv="${k}" rows="4" placeholder="${esc(hint)}">${esc(r[k] || '')}</textarea></label>`;
    return `<div class="row" style="margin-bottom:12px"><a class="btn icon" href="#/reviews/weekly?w=${addDays(ws, -7)}">‹</a><strong>${esc(t('weekOf', { d: fmtDate(ws, { day: 'numeric', month: 'long', year: 'numeric' }) }))}</strong><a class="btn icon" href="#/reviews/weekly?w=${addDays(ws, 7)}">›</a>
        <span class="spacer"></span>${r.id ? `<span class="pill ok">✓ ${esc(t('saved'))} ${esc(fmtDate(r.date))}</span>` : `<span class="pill warn">${esc(t('notDone'))}</span>`}</div>
      <div class="dash"><div class="card c8"><h2>${esc(t('inNumbers'))}</h2>${statsHtml(st)}</div>
        <div class="card c4"><h2>${esc(t('rv_energy'))}</h2><div class="chip-row">${[1, 2, 3, 4, 5].map(n => `<button class="chip ${Number(r.energy) === n ? 'on' : ''}" data-energy="${n}">${'●'.repeat(n)}</button>`).join('')}</div><p class="small faint" style="margin-top:6px">${esc(t('rv_energyHint'))}</p></div>
        <div class="card c12"><form data-form="review" class="grid g2">
          ${F('wins', t('rv_wins'), t('rv_winsHint'), sugg('wins', [...st.ms.map(m => '◆ ' + m.title), ...st.tasks.map(x => x.title)]))}
          ${F('blockers', t('rv_blockers'), t('rv_blockersHint'), sugg('blockers', [...overdue.map(x => `${t('overdue')}: ${x.title}`), ...risks.map(w => `${w.m.title} — ${w.h.msg}`)]))}
          ${F('lessons', t('rv_lessons'), t('rv_lessonsHint'))}
          ${F('plan', t('rv_plan'), t('rv_planHint'), sugg('plan', [...nextMs.map(m => `◆ ${m.title} (${fmtDate(m.due)})`), ...nextDue.map(x => `${x.title} (${fmtDate(x.due)})`)]))}
          <div class="span-all row"><a class="btn" href="#/calendar/week?d=${addDays(ws, 7)}">▦ ${esc(t('planNextWeek'))}</a><span class="spacer"></span><button class="btn primary">${esc(t('saveReview'))}</button></div>
        </form></div>
        ${past.length ? `<div class="card c12"><h2>${esc(t('pastReviews'))}</h2><ul class="list small">${past.slice(0, 12).map(p => `<li><a href="#/reviews/weekly?w=${p.period}" style="width:150px;flex:none">${esc(fmtDate(p.period, { day: 'numeric', month: 'short', year: 'numeric' }))}</a><span class="grow muted">${esc((p.wins || '').split('\n')[0].slice(0, 120))}</span><span class="faint">${'●'.repeat(Number(p.energy) || 0)}</span></li>`).join('')}</ul></div>` : ''}
      </div>`;
  },

  monthly(q) {
    const m = q.m || todayISO().slice(0, 7);
    const from = m + '-01', last = parseISO(from); last.setMonth(last.getMonth() + 1, 0); const to = localISO(last);
    const saved = Store.all('reviews').find(x => x.kind === 'monthly' && x.period === m);
    const text = saved ? saved.text : monthlyReport(m, from, to);
    const prev = shiftMonth(from, -1).slice(0, 7), next = shiftMonth(from, 1).slice(0, 7);
    return `<div class="row" style="margin-bottom:12px"><a class="btn icon" href="#/reviews/monthly?m=${prev}">‹</a><strong>${esc(parseISO(from).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' }))}</strong><a class="btn icon" href="#/reviews/monthly?m=${next}">›</a>
      <span class="spacer"></span>${saved ? `<span class="pill ok">✓ ${esc(t('saved'))}</span>` : `<span class="pill">${esc(t('draftGenerated'))}</span>`}</div>
      <div class="card"><p class="small muted">${esc(t('monthlyHelp'))}</p><textarea id="mr-text" class="prompt-box" rows="22">${esc(text)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn" data-action="mr-regen">↻ ${esc(t('regenerate'))}</button><button class="btn ai" data-action="mr-prompt">✎ ${esc(t('mrPrompt'))}</button><span class="spacer"></span>
        <button class="btn" data-action="mr-copy">${esc(t('copy'))}</button><button class="btn" data-action="mr-dl">⇩ .md</button><button class="btn primary" data-action="mr-save" data-m="${m}">${esc(t('save'))}</button></div></div>`;
  },

  term(q) {
    const key = q.t || termOf(todayISO()), [from, to] = termRange(key);
    const r = Store.all('reviews').find(x => x.kind === 'term' && x.period === key) || {};
    const st = periodStats(from, to);
    const [y, k] = key.split('-'), order = ['winter', 'summer', 'fall'], i = order.indexOf(k);
    const prev = i === 0 ? `${Number(y) - 1}-fall` : `${y}-${order[i - 1]}`, next = i === 2 ? `${Number(y) + 1}-winter` : `${y}-${order[i + 1]}`;
    const msDone = Store.all('milestones').filter(m => m.status === 'done' && (m.updatedAt || '').slice(0, 10) >= from && (m.updatedAt || '').slice(0, 10) <= to);
    const F = (f, rows = 3) => `<label class="field"><span>${esc(t('tr_' + f))}</span><textarea data-tr="${f}" rows="${rows}" placeholder="${esc(t('tr_' + f + 'Hint'))}">${esc(r[f] || '')}</textarea></label>`;
    return `<div class="row" style="margin-bottom:12px"><a class="btn icon" href="#/reviews/term?t=${prev}">‹</a><strong>${esc(termLabel(key))}</strong> <span class="small muted">${esc(fmtDate(from))} – ${esc(fmtDate(to))}</span><a class="btn icon" href="#/reviews/term?t=${next}">›</a>
      <span class="spacer"></span>${r.id ? `<span class="pill ok">✓ ${esc(t('saved'))}</span>` : ''}</div>
      <div class="dash"><div class="card c12"><h2>${esc(t('inNumbers'))}</h2>${statsHtml(st)}${msDone.length ? `<p class="small" style="margin-top:8px">◆ ${msDone.map(m => esc(m.title)).join(' · ')}</p>` : ''}</div>
      <form class="card c12 grid g2" data-form="term" data-key="${key}">${F('proud')}${F('struggled')}${F('learned')}${F('change')}${F('goals', 4)}${F('wellbeing')}
        <div class="span-all row"><button class="btn" type="button" data-action="tr-dl" data-key="${key}">⇩ .md</button><span class="spacer"></span><button class="btn primary">${esc(t('saveReview'))}</button></div></form></div>`;
  },

  bind(root, params, query) {
    const tab = params[0] || 'weekly';
    root.addEventListener('click', e => {
      const f = e.target.closest('[data-fill]');
      if (f) { e.preventDefault(); const ta = $(`[data-rv="${f.dataset.fill}"]`, root); const lines = JSON.parse(f.dataset.lines); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + lines.map(l => '- ' + l).join('\n'); ta.focus(); return; }
      const en = e.target.closest('[data-energy]');
      if (en) { e.preventDefault(); $$('[data-energy]', root).forEach(x => x.classList.toggle('on', x === en)); root.dataset.energy = en.dataset.energy; return; }
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action, ta = $('#mr-text', root);
      if (act === 'mr-regen') { const m = query.m || todayISO().slice(0, 7); const from = m + '-01', l = parseISO(from); l.setMonth(l.getMonth() + 1, 0); ta.value = monthlyReport(m, from, localISO(l)); }
      else if (act === 'mr-copy') copyText(ta.value);
      else if (act === 'mr-dl') download(`monthly-report-${query.m || todayISO().slice(0, 7)}.md`, ta.value, 'text/markdown');
      else if (act === 'mr-prompt') copyText(`Edit this monthly progress report from my PhD records into a concise, professional summary I can share with my supervisor (max 300 words). Keep every fact and number exactly; do not add achievements or sources. Use Canadian English spelling.\n\n${ta.value}`);
      else if (act === 'mr-save') { saveReview('monthly', a.dataset.m, { text: ta.value }); toast(t('saved')); App.render(); }
      else if (act === 'tr-dl') { const r = Store.all('reviews').find(x => x.kind === 'term' && x.period === a.dataset.key) || {}; download(`term-reflection-${a.dataset.key}.md`, `# ${t('rvt_term')} — ${termLabel(a.dataset.key)}\n\n` + ['proud', 'struggled', 'learned', 'change', 'goals', 'wellbeing'].map(f => `## ${t('tr_' + f)}\n\n${r[f] || ''}\n`).join('\n'), 'text/markdown'); }
    });
    root.addEventListener('submit', e => {
      const f = e.target.dataset.form; if (!f) return; e.preventDefault();
      if (f === 'review') {
        const ws = query.w || startOfWeek(), data = {}; $$('[data-rv]', root).forEach(x => data[x.dataset.rv] = x.value);
        const old = Store.all('reviews').find(x => x.kind === 'weekly' && x.period === ws);
        data.energy = Number(root.dataset.energy || (old && old.energy) || 3);
        saveReview('weekly', ws, data);
        // Lessons are also worth keeping in the journal
        toast(t('reviewSaved')); App.render();
      } else if (f === 'term') {
        const data = {}; $$('[data-tr]', root).forEach(x => data[x.dataset.tr] = x.value);
        saveReview('term', e.target.dataset.key, data); toast(t('saved')); App.render();
      }
    });
  },
};
function saveReview(kind, period, data) {
  const old = Store.all('reviews').find(x => x.kind === kind && x.period === period);
  if (old) Store.update('reviews', old.id, Object.assign(data, { date: todayISO() }));
  else Store.add('reviews', Object.assign({ kind, period, date: todayISO() }, data));
}
function monthlyReport(m, from, to) {
  const st = periodStats(from, to), label = parseISO(from).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });
  const L = [`# ${t('rvt_monthly')} — ${label}`, '', `## ${t('inNumbers')}`,
    `- ${t('rv_tasks')}: ${st.tasks.length}`, `- ${t('rv_hours')}: ${st.hours.toFixed(1)} h (${Object.entries(st.byArea).sort((a, b) => b[1] - a[1]).map(([a, mm]) => `${t('area_' + a)} ${(mm / 60).toFixed(1)} h`).join(', ') || '—'})`,
    `- ${t('words')}: ${st.words.toLocaleString()}`, `- ${t('rv_passes')}: ${st.passes.length}`, `- ${t('rv_notes')}: ${st.notes.length}`, `- ${t('nav_meetings')}: ${st.meetings.length}`, ''];
  if (st.ms.length) { L.push(`## ${t('puMilestones')}`); st.ms.forEach(x => L.push(`- ◆ ${x.title} (${projectName(x.projectId)})`)); L.push(''); }
  const thesis = Store.all('projects').find(p => p.area === 'thesis');
  if (thesis && Plan.projectProgress(thesis.id) != null) L.push(`## ${t('roadmapCard')}`, `- ${thesis.title}: ${Plan.projectProgress(thesis.id)}%`, ...Plan.warnings().map(w => `- ⚠ ${w.m.title} — ${w.h.msg}`), '');
  const pubs = Store.all('projects').filter(p => p.area === 'publication');
  if (pubs.length) { L.push(`## ${t('pipeline')}`); pubs.forEach(p => L.push(`- ${p.title}: ${t('stg_' + p.stage)}${p.wordGoal ? ` · ${(p.wordCount || 0).toLocaleString()}/${p.wordGoal.toLocaleString()} ${t('words')}` : ''}`)); L.push(''); }
  const reads = uniq(st.passes.map(x => x.s));
  if (reads.length) { L.push(`## ${t('puReading')}`); reads.forEach(s => L.push(`- ${sourceLabel(s)} — ${t('st_' + sourceStatus(s))}`)); L.push(''); }
  const dec = st.notes.filter(n => n.kind === 'decision');
  if (dec.length) { L.push(`## ${t('jt_decisions')}`); dec.forEach(n => L.push(`- ${n.decision.what || Links.noteTitle(n)}`)); L.push(''); }
  const weekly = Store.all('reviews').filter(r => r.kind === 'weekly' && r.period >= addDays(from, -6) && r.period <= to).sort((a, b) => a.period.localeCompare(b.period));
  if (weekly.length) {
    const pick = (f) => weekly.flatMap(r => (r[f] || '').split('\n').map(x => x.replace(/^\s*-\s*/, '').trim()).filter(Boolean));
    L.push(`## ${t('rv_wins')}`, ...pick('wins').map(x => '- ' + x), '', `## ${t('rv_blockers')}`, ...pick('blockers').map(x => '- ' + x), '', `## ${t('rv_lessons')}`, ...pick('lessons').map(x => '- ' + x), '');
  }
  L.push(`## ${t('puNext')}`, ...Store.all('milestones').filter(x => x.status !== 'done' && x.due && x.due > to && x.due <= addDays(to, 31)).map(x => `- ◆ ${x.title} — ${fmtDate(x.due)}`));
  return L.join('\n');
}
