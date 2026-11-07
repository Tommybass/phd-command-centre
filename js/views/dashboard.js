/* Today dashboard */
const DashboardView = {
  render() {
    const d = Store.data;
    const welcome = Store.isEmpty() ? `<div class="banner info"><div class="grow" style="flex:1;min-width:220px"><strong>${esc(t('welcomeTitle'))}</strong><br><span class="small">${esc(t('welcomeText'))}</span></div>
      <button class="btn primary" data-action="load-sample">${esc(t('loadSample'))}</button>
      ${Store.fsSupported ? `<button class="btn" data-action="connect">${esc(t('connectFolder'))}</button>` : ''}</div>` : '';
    const storageWarn = Sync.phone ? phoneBanner() : !Store.isEmpty() && Store.dirState !== 'granted' ?`<div class="banner"><span style="flex:1;min-width:200px" class="small">${esc(Store.dirState === 'prompt' ? t('storageReconnect') : (Store.fsSupported ? t('storageBrowser') : t('noFsApi')))}</span>
      ${Store.dirState === 'prompt' ? `<button class="btn primary" data-action="reconnect">${esc(t('reconnect'))}</button>` : (Store.fsSupported ? `<button class="btn primary" data-action="connect">${esc(t('connectFolder'))}</button>` : '')}</div>` : '';
    const reviewBanner = !Store.isEmpty() && weeklyReviewDue() ? `<div class="banner info"><span style="flex:1;min-width:200px">↺ ${esc(t('weeklyDue'))}</span><a class="btn primary" href="#/reviews/weekly">${esc(t('doReview'))}</a></div>` : '';

    // Top three
    const open = d.tasks.filter(x => !x.done);
    const top = open.filter(x => x.top).slice(0, 3);
    const doneToday = d.tasks.filter(x => x.done && x.top && x.doneAt === todayISO());
    const rest = open.filter(x => !x.top).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 6);
    const taskLi = (x, star) => `<li><input type="checkbox" class="check" data-action="done" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="done">
      <div class="grow"><span class="${x.done ? 'done-text' : ''}">${esc(x.title)}</span>
        <div class="row small muted">${x.energy ? `<span class="pill">${esc(t('en_' + x.energy))}</span>` : ''}${x.projectId ? `<span>${esc(projectName(x.projectId))}</span>` : ''}${x.due ? `<span>${esc(fmtDate(x.due, { day: 'numeric', month: 'short' }))}</span> ${dueBadge(x.due)}` : ''}</div></div>
      ${star ? `<button class="star ${x.top ? 'on' : ''}" data-action="star" data-id="${x.id}" title="${esc(t('t_top'))}">★</button>` : ''}</li>`;
    const topCard = `<div class="card c7"><h2>${esc(t('top3'))} <span class="count">${top.length}/3</span></h2>
      <ul class="list">${top.map(x => taskLi(x, true)).join('')}${doneToday.map(x => taskLi(x, false)).join('')}</ul>
      ${top.length < 3 ? `<p class="small muted" style="margin:8px 0 4px">${esc(t('pickTop'))}</p>` : ''}
      <form data-form="add-task" class="row" style="margin-top:8px"><input name="title" placeholder="${esc(t('addTask'))}" style="flex:1"><button class="btn">+</button></form>
      ${rest.length ? `<details style="margin-top:10px"><summary class="small muted">${esc(t('openTasks'))} (${open.length - top.length})</summary><ul class="list">${rest.map(x => taskLi(x, true)).join('')}</ul></details>` : ''}
    </div>`;

    // Next 14 days
    const items = [
      ...d.tasks.filter(x => !x.done && x.due).map(x => ({ date: x.due, title: x.title, kind: t('qa_task') })),
      ...d.projects.filter(x => x.deadline).map(x => ({ date: x.deadline, title: x.title, kind: t('p_deadline'), href: '#/projects/list' })),
      ...d.deadlines.map(x => ({ date: x.due, title: x.title, kind: t('dk_' + x.kind), href: '#/projects/deadlines' })),
      ...d.milestones.filter(x => x.status !== 'done' && x.due).map(x => ({ date: x.due, title: x.title, kind: t('newMilestone').replace(/^\+?\s*/, ''), href: '#/projects/milestones' })),
      ...d.meetings.map(m => ({ date: m.date, title: `${meetingTitle(m)} · ${m.time || ''}`, kind: t('ek_meeting'), href: '#/meetings/' + m.id })),
      ...d.meetings.flatMap(m => (m.actions || []).filter(a => a.owner !== 'me' && a.due && !actionDone(a)).map(a => ({ date: a.due, title: `${a.text} (${a.owner})`, kind: t('action'), href: '#/meetings/' + m.id }))),
      ...d.records.filter(r => r.kind === 'document' && r.expires).map(r => ({ date: r.expires, title: `${r.title} — ${t('rf_expires').toLowerCase()}`, kind: t('rk_document'), href: '#/records/documents' })),
      ...d.records.filter(r => r.kind === 'contract' && r.end).map(r => ({ date: r.end, title: `${r.role}: ${r.title} — ${t('rf_end').toLowerCase()}`, kind: t('rk_contract'), href: '#/records/work' })),
    ].filter(x => daysUntil(x.date) <= 14 && daysUntil(x.date) >= -7).sort((a, b) => a.date.localeCompare(b.date));
    const next = `<div class="card c5"><h2>${esc(t('next14'))}</h2>${items.length ? `<ul class="list">${items.map(x => `<li><span class="small" style="width:62px;flex:none;color:var(--muted)">${esc(fmtDate(x.date, { day: 'numeric', month: 'short' }))}</span>
      <div class="grow">${x.href ? `<a href="${x.href}" style="color:var(--text)">${esc(x.title)}</a>` : esc(x.title)}<div class="small muted">${esc(x.kind)}</div></div>${dueBadge(x.date)}</li>`).join('')}</ul>` : `<p class="empty">${esc(t('noDeadlines'))}</p>`}</div>`;

    // Reading this week
    const wk = startOfWeek();
    const passes = d.sources.flatMap(s => (s.passLog || []).filter(l => l.date >= wk));
    const target = d.settings.readingTarget || 5;
    const upNext = d.sources.filter(inQueue).sort((a, b) => (b.priority - a.priority) || (b.passDone - a.passDone)).slice(0, 3);
    const reading = `<div class="card c4"><h2>${esc(t('reading'))}</h2>
      <div class="stat">${passes.length}<small> / ${target}</small></div>
      <div class="bar" style="margin:8px 0 12px"><i style="width:${Math.min(100, passes.length / target * 100)}%"></i></div>
      <p class="small muted" style="margin-bottom:4px">${esc(t('upNext'))}</p>
      <ul class="list small">${upNext.map(s => `<li>${passDots(s)}<a class="grow" href="#/source/${s.id}">${esc(sourceLabel(s))}</a></li>`).join('') || `<li class="empty">${esc(t('queueEmpty'))}</li>`}</ul></div>`;

    // Writing
    const ws = Plan.streaks();
    const hours = `<div class="card c4"><h2><a href="#/writing" style="color:inherit">${esc(t('nav_writing'))}</a></h2>
      <div class="row" style="gap:20px"><div><div class="stat">${ws.current}</div><span class="small muted">${esc(t('streakDays'))}</span></div><div><div class="stat">${Plan.weekWords().toLocaleString()}</div><span class="small muted">${esc(t('wordsThisWeek'))}</span></div></div>
      <ul class="list small" style="margin-top:8px">${d.projects.filter(p => p.wordGoal > 0).slice(0, 3).map(p => `<li><div class="grow"><div class="row"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</span><span class="faint">${Math.min(100, Math.round((p.wordCount || 0) / p.wordGoal * 100))}%</span></div><div class="bar"><i style="width:${Math.min(100, (p.wordCount || 0) / p.wordGoal * 100)}%"></i></div></div></li>`).join('')}</ul>
      </div>`;

    // Time logged and weekly capacity
    const cap = Cal.capacity();
    const todayMin = d.timeLogs.filter(l => l.start.slice(0, 10) === todayISO()).reduce((s, l) => s + l.minutes, 0);
    const byArea = {}; d.timeLogs.filter(l => l.start.slice(0, 10) >= startOfWeek()).forEach(l => byArea[l.area] = (byArea[l.area] || 0) + l.minutes);
    const timeCard = `<div class="card c6"><h2><a href="#/calendar/time" style="color:inherit">${esc(t('hours'))}</a> <button class="btn small" data-action="timer">▶ ${esc(t('focus'))}</button></h2>
      <div class="row" style="gap:20px"><div><div class="stat">${(todayMin / 60).toFixed(1)}<small> h</small></div><span class="small muted">${esc(t('today'))}</span></div><div><div class="stat">${cap.logged.toFixed(1)}<small> h</small></div><span class="small muted">${esc(t('thisWeek'))}</span></div></div>
      <div class="chip-row" style="margin:8px 0">${Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([a, m]) => `<span class="pill">${esc(t('area_' + a))} ${(m / 60).toFixed(1)} h</span>`).join('')}</div>
      <a href="#/calendar/week" style="color:inherit">${capacityBar(cap)}</a></div>`;

    // Meetings: next meeting and open action items
    const nextMeet = d.meetings.filter(m => m.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const openActs = d.meetings.flatMap(m => (m.actions || []).map(a => ({ m, a }))).filter(x => !actionDone(x.a));
    const meetCard = `<div class="card c6"><h2><a href="#/meetings" style="color:inherit">${esc(t('nav_meetings'))}</a></h2>
      ${nextMeet ? `<p><strong>${esc(meetingTitle(nextMeet))}</strong><br><span class="small muted">${esc(fmtDate(nextMeet.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(nextMeet.time || '')}</span> ${dueBadge(nextMeet.date)}</p>
        <div class="row"><a class="btn small" href="#/meetings/${nextMeet.id}">${esc(t('agenda'))} (${(nextMeet.agenda || []).length})</a><button class="btn small ai" data-action="pu" data-id="${nextMeet.id}">✦ ${esc(t('progressUpdate'))}</button></div>`
        : `<p class="small muted">${esc(t('noUpcoming'))}</p>`}
      ${openActs.length ? `<h3 class="small muted" style="margin-top:12px">${esc(t('allOpenActions'))} (${openActs.length})</h3><ul class="list small">${openActs.slice(0, 4).map(x => `<li><span class="pill ${x.a.owner === 'me' ? 'accent' : ''}">${esc(ownerLabel(x.a.owner))}</span><span class="grow">${esc(x.a.text)}</span>${x.a.due ? dueBadge(x.a.due) : ''}</li>`).join('')}</ul>` : ''}</div>`;

    // PhD roadmap: thesis milestone progress and slip warnings
    const thesis = d.projects.find(p => p.area === 'thesis');
    const tp = thesis ? Plan.projectProgress(thesis.id) : null;
    const nextMs = d.milestones.filter(m => m.status !== 'done' && m.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
    const warns = Plan.warnings();
    const pipeline = `<div class="card c4"><h2><a href="#/projects/milestones" style="color:inherit">${esc(t('roadmapCard'))}</a></h2>
      ${tp != null ? `<div class="stat">${tp}<small>%</small></div><div class="bar" style="margin:6px 0 10px"><i style="width:${tp}%"></i></div>` : `<p class="small muted">${esc(t('noRoadmap'))} <a href="#/projects/milestones">${esc(t('tmplAdd'))}</a></p>`}
      ${warns.length ? `<p class="small" style="color:var(--danger);margin-bottom:4px">⚠ ${esc(t('slipping', { n: warns.length }))}</p>` : ''}
      <ul class="list small">${nextMs.map(m => { const h = Plan.health(m); return `<li><div class="grow">${esc(m.title)}<div class="faint">${esc(fmtDate(m.due))} · ${Plan.progress(m)}%</div></div>${h.level !== 'ok' ? `<span class="pill ${HEALTH_PILL[h.level]}">${esc(t('lvl_' + h.level))}</span>` : dueBadge(m.due)}</li>`; }).join('')}</ul></div>`;

    const NA = d.projects.slice().sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
    const actions = `<div class="card c8"><h2>${esc(t('nextActions'))}</h2>${NA.length ? `<ul class="list">${NA.map(p => `<li><div style="width:38%;flex:none;min-width:0"><strong class="small">${esc(p.title)}</strong></div>
      <div class="grow small">${esc(p.nextAction || '—')}</div>${p.deadline ? dueBadge(p.deadline) : ''}</li>`).join('')}</ul>` : `<p class="empty">${esc(t('noProjects'))}</p>`}</div>`;

    const nInbox = d.notes.filter(n => n.kind === 'inbox').length;
    const notes = d.notes.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const inbox = `<div class="card c6"><h2><a href="#/journal" style="color:inherit">${esc(t('journalRecent'))}</a> ${nInbox ? `<a class="pill warn" href="#/journal" data-action="inbox-filter">${nInbox} ${esc(t('nk_inbox'))}</a>` : ''}</h2>
      ${notes.length ? `<ul class="list small">${notes.map(n => `<li><span class="kind-ico k-${n.kind}">${KIND_ICON[n.kind]}</span><div class="grow"><a href="#/journal/${n.id}" style="color:var(--text)">${esc(Links.noteTitle(n))}</a><div class="faint">${esc(t('nk_' + n.kind))} · ${esc(fmtDate(n.date))}</div></div></li>`).join('')}</ul>` : `<p class="empty">${esc(t('noEntries'))}</p>`}</div>`;
    const C = d.claims;
    const cs = { strong: 0, thin: 0, missing: 0 }; C.forEach(c => cs[Arg.status(c)]++);
    const argCard = `<div class="card c6"><h2><a href="#/argument" style="color:inherit">${esc(t('argHealth'))}</a></h2>
      ${C.length ? `<div class="row" style="gap:18px;margin-bottom:8px"><span><span class="sdot s-strong"></span> ${cs.strong} ${esc(t('as_strong'))}</span><span><span class="sdot s-thin"></span> ${cs.thin} ${esc(t('as_thin'))}</span><span><span class="sdot s-missing"></span> ${cs.missing} ${esc(t('as_missing'))}</span></div>
        <div class="bar" style="display:flex"><i style="width:${cs.strong / C.length * 100}%;background:var(--ok);border-radius:0"></i><i style="width:${cs.thin / C.length * 100}%;background:var(--warn);border-radius:0"></i></div>
        <ul class="list small" style="margin-top:8px">${C.filter(c => Arg.status(c) === 'missing').slice(0, 3).map(c => `<li><span class="sdot s-missing"></span><a class="grow" href="#/argument/${c.id}" style="color:var(--text)">${esc(c.text.slice(0, 90))}</a></li>`).join('')}</ul>`
        : `<p class="empty">${esc(t('noClaims'))}</p>`}</div>`;

    const now = new Date();
    // Study cards and admin
    const due = SRS.queue('').length;
    const unclaimed = d.records.filter(r => r.kind === 'receipt' && r.rstatus === 'notclaimed');
    const checks = d.records.filter(r => r.kind === 'check');
    const studyCard = `<div class="card c6"><h2><a href="#/cards" style="color:inherit">${esc(t('nav_cards'))}</a></h2>
      ${d.cards.length ? `<div class="row"><div class="stat">${due}</div><span class="small muted">${esc(t('cardsDue', { n: due }).replace(/^\d+\s*/, ''))}</span><span class="spacer"></span>${due ? `<a class="btn primary" href="#/cards/review">${esc(t('studyNow'))}</a>` : '✓'}</div>` : `<p class="small muted">${esc(t('noCards'))} <a href="#/cards/make">${esc(t('ct2_make'))}</a></p>`}
      <a href="#/reviews/weekly" class="small" style="display:block;margin-top:10px">↺ ${esc(t('rvt_weekly'))}${d.reviews.some(r => r.kind === 'weekly' && r.period === startOfWeek()) ? ' ✓' : ''}</a></div>`;
    const adminCard = `<div class="card c6"><h2><a href="#/records" style="color:inherit">${esc(t('adminCard'))}</a></h2><ul class="list small">
      ${checks.length ? `<li><span class="grow">${esc(t('ethicsProgress'))}</span><span>${checks.filter(c => c.done).length}/${checks.length}</span></li>` : `<li><a href="#/records/ethics">${esc(t('ethicsTmplTitle'))} →</a></li>`}
      ${unclaimed.length ? `<li><a class="grow" href="#/records/receipts">${esc(t('receiptsUnclaimed', { n: unclaimed.length, a: unclaimed.reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2) }))}</a></li>` : ''}
      ${d.records.filter(r => r.kind === 'contract' && (!r.end || r.end >= todayISO())).map(c => { const used = d.records.filter(h => h.kind === 'hours' && h.contractId === c.id).reduce((s, h) => s + Number(h.hours || 0), 0); return `<li><span class="grow">${esc(c.role)}: ${esc(c.title)}</span><span class="${c.hoursCap && used > c.hoursCap * 0.9 ? 'warn-text' : ''}">${used.toFixed(1)}${c.hoursCap ? ' / ' + c.hoursCap : ''} h</span></li>`; }).join('')}
    </ul></div>`;

    return `${welcome}${storageWarn}${reviewBanner}<div class="page-head"><div><h1>${esc(t('today'))}</h1><p class="sub">${esc(now.toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p></div></div>
      <div class="dash">${topCard}${next}${reading}${hours}${pipeline}${timeCard}${meetCard}${actions.replace('c8', 'c12')}${inbox}${argCard}${studyCard}${adminCard}</div>`;
  },
  bind(root) {
    root.addEventListener('click', async e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'done') { const x = Store.get('tasks', a.dataset.id); Store.update('tasks', x.id, { done: !x.done, doneAt: !x.done ? todayISO() : '' }); App.render(); }
      else if (act === 'star') {
        const x = Store.get('tasks', a.dataset.id);
        if (!x.top && Store.all('tasks').filter(y => y.top && !y.done).length >= 3) { toast(t('pickTop')); return; }
        Store.update('tasks', x.id, { top: !x.top }); App.render();
      }
      else if (act === 'inbox-filter') { JState.kind = 'inbox'; saveJState(); }
      else if (act === 'timer') { openTimer(); }
      else if (act === 'pu') { progressModal(Store.get('meetings', a.dataset.id)); }
      else if (act === 'load-sample') { loadSample(); }
      else if (act === 'connect') { await connectFolderFlow(); }
      else if (act === 'reconnect') { await Store.reconnect(); App.render(); }
    });
    root.addEventListener('submit', e => {
      if (e.target.dataset.form !== 'add-task') return;
      e.preventDefault();
      const title = e.target.title.value.trim(); if (!title) return;
      const topCount = Store.all('tasks').filter(y => y.top && !y.done).length;
      Store.add('tasks', { title, top: topCount < 3, done: false, energy: '', projectId: '', due: '' });
      App.render(); setTimeout(() => { const i = $('[data-form="add-task"] input'); i && i.focus(); }, 0);
    });
  },
};

async function connectFolderFlow() {
  try {
    const loaded = await Store.connectFolder();
    toast(loaded ? 'Loaded phd-data.json from your folder' : t('saved'));
    App.render();
  } catch (e) { if (e && e.name !== 'AbortError') toast(String(e.message || e)); }
}
function loadSample() {
  if (typeof buildSampleData !== 'function') { toast(t('noSampleHere')); return; }   // not shipped in the published copy
  const n = Store.mergeIn(buildSampleData()); // only adds records not already present
  const S = Store.data.settings;
  if (typeof SAMPLE_THESIS === 'object' && !S.thesisTitle) { S.thesisTitle = SAMPLE_THESIS.title; S.thesisDesign = SAMPLE_THESIS.design; Store.change(); }
  Store.all('notes').forEach(x => Links.refresh(x));
  toast(`${t('sampleLoaded')} (${n})`);
  App.render();
}
