/* Writing tracker: word goals per manuscript, daily log, streaks, version notes */
const WritingView = {
  manuscripts() {
    const used = new Set(Store.all('writingLogs').map(l => l.projectId));
    return Store.all('projects').filter(p => p.wordGoal > 0 || used.has(p.id) || (p.versions || []).length);
  },
  render() {
    const st = Plan.streaks(), week = Plan.weekWords(), by = Plan.wordsByDate();
    const today = by[todayISO()] || 0;
    // 15-week heatmap, Monday rows
    const start = addDays(startOfWeek(), -14 * 7);
    let cells = '';
    for (let w = 0; w < 15; w++) for (let d = 0; d < 7; d++) {
      const iso = addDays(start, w * 7 + d); const n = by[iso] || 0;
      const lvl = iso > todayISO() ? 'f' : n === 0 ? 0 : n < 250 ? 1 : n < 500 ? 2 : n < 1000 ? 3 : 4;
      cells += `<span class="hm l${lvl}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${esc(fmtDate(iso))}: ${n} ${esc(t('words'))}"></span>`;
    }
    const P = Store.all('projects');
    const logForm = `<form class="card c12" data-form="log"><h2>${esc(t('logWriting'))}</h2><div class="grid g4">
        <label class="field"><span>${esc(t('date'))}</span><input type="date" name="date" value="${todayISO()}"></label>
        <label class="field span2"><span>${esc(t('manuscript'))}</span><select name="projectId">${options(P.map(p => p.id), (this.manuscripts()[0] || P[0] || {}).id, projectName)}</select></label>
        <label class="field"><span>${esc(t('wordsWritten'))}</span><input type="number" name="words" min="0" step="50" required></label>
        <label class="field"><span>${esc(t('minutes'))}</span><input type="number" name="minutes" min="0" step="5"></label>
        <label class="field span2"><span>${esc(t('logNote'))}</span><input name="note" placeholder="${esc(t('logNoteHint'))}"></label>
        <label class="row small" style="align-self:end"><input type="checkbox" name="add" checked> ${esc(t('addToTotal'))}</label>
      </div><div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn primary">${esc(t('save'))}</button></div></form>`;

    const cards = this.manuscripts().map(p => {
      const pct = p.wordGoal ? Math.min(100, Math.round((p.wordCount || 0) / p.wordGoal * 100)) : null;
      const pace = Plan.pace(p.id);
      const remaining = Math.max(0, (p.wordGoal || 0) - (p.wordCount || 0));
      let proj = '';
      if (p.wordGoal && remaining === 0) proj = `<span class="pill ok">${esc(t('goalReached'))}</span>`;
      else if (p.wordGoal && pace > 0) {
        const finish = addDays(todayISO(), Math.ceil(remaining / pace));
        proj = `${esc(t('projected', { d: fmtDate(finish) }))}`;
        if (p.deadline && daysUntil(p.deadline) > 0) {
          const need = Math.ceil(remaining / daysUntil(p.deadline));
          proj += ` · <span class="pill ${finish > p.deadline ? 'warn' : 'ok'}">${esc(t('needPerDay', { n: need }))}</span>`;
        }
      } else if (p.wordGoal) proj = esc(t('noPace'));
      const vs = (p.versions || []).slice().sort((a, b) => b.date.localeCompare(a.date));
      return `<div class="card c6"><div class="row"><h2 style="margin:0;flex:1">${esc(p.title)}</h2><button class="btn ghost small" data-action="edit-proj" data-id="${p.id}">${esc(t('edit'))}</button></div>
        <div class="row" style="margin:8px 0 4px"><span class="stat" style="font-size:1.5rem">${(p.wordCount || 0).toLocaleString()}</span><span class="muted small">/ ${p.wordGoal ? p.wordGoal.toLocaleString() : '—'} ${esc(t('words'))}</span></div>
        ${pct != null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : `<p class="small muted">${esc(t('setGoal'))}</p>`}
        <p class="small muted" style="margin:6px 0">${esc(t('pace', { n: Math.round(pace) }))}${proj ? ' · ' + proj : ''}</p>
        <h3 class="small muted" style="margin-top:12px">${esc(t('versions'))}</h3>
        <ul class="list small">${vs.map(v => `<li><span style="width:78px;flex:none" class="faint">${esc(fmtDate(v.date, { day: 'numeric', month: 'short', year: '2-digit' }))}</span><div class="grow"><strong>${esc(v.label)}</strong>${v.words ? ` <span class="faint">· ${Number(v.words).toLocaleString()} ${esc(t('words'))}</span>` : ''}${v.note ? `<div class="muted">${esc(v.note)}</div>` : ''}</div><button class="btn ghost small danger" data-action="del-version" data-p="${p.id}" data-v="${v.id}" aria-label="${esc(t('delete'))}">✕</button></li>`).join('') || `<li class="empty">—</li>`}</ul>
        <button class="btn small" data-action="add-version" data-id="${p.id}">+ ${esc(t('addVersion'))}</button></div>`;
    }).join('');

    const logs = Store.all('writingLogs').slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 15);
    const recent = `<div class="card c12"><h2>${esc(t('recentLog'))}</h2>${logs.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('manuscript'))}</th><th>${esc(t('words'))}</th><th class="hide-mobile">${esc(t('minutes'))}</th><th class="hide-mobile">${esc(t('logNote'))}</th><th></th></tr></thead><tbody>
      ${logs.map(l => `<tr><td style="white-space:nowrap">${esc(fmtDate(l.date))}</td><td>${esc(projectName(l.projectId))}</td><td>${Number(l.words).toLocaleString()}</td><td class="hide-mobile">${l.minutes || ''}</td><td class="small hide-mobile">${esc(l.note)}</td><td><button class="btn ghost small danger" data-action="del-log" data-id="${l.id}" aria-label="${esc(t('delete'))}">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="empty">${esc(t('noLogs'))}</p>`}</div>`;

    return `<div class="page-head"><div><h1>${esc(t('nav_writing'))}</h1><p class="sub">${esc(t('writingSub'))}</p></div></div>
      <div class="dash">
        <div class="card c4"><h2>${esc(t('streak'))}</h2><div class="stat">${st.current}<small> ${esc(t('days'))}</small></div>
          <p class="small muted" style="margin-top:6px">${esc(t('bestStreak', { n: st.best }))}${st.wroteToday ? '' : ' · ' + esc(t('writeToday'))}</p></div>
        <div class="card c4"><h2>${esc(t('thisWeek'))}</h2><div class="stat">${week.toLocaleString()}<small> ${esc(t('words'))}</small></div><p class="small muted" style="margin-top:6px">${esc(t('todayWords', { n: today.toLocaleString() }))}</p></div>
        <div class="card c4"><h2>${esc(t('last15'))}</h2><div class="heatmap">${cells}</div>
          <div class="row small faint" style="margin-top:6px;gap:4px">0 <span class="hm l1"></span><span class="hm l2"></span><span class="hm l3"></span><span class="hm l4"></span> 1000+</div></div>
        ${logForm}${cards || `<div class="card c12 empty">${esc(t('noManuscripts'))}</div>`}${recent}
      </div>`;
  },
  bind(root) {
    root.addEventListener('submit', e => {
      if (e.target.dataset.form !== 'log') return;
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const words = Number(f.words) || 0; if (!words || !f.projectId) return;
      Store.add('writingLogs', { date: f.date || todayISO(), projectId: f.projectId, words, minutes: Number(f.minutes) || 0, note: f.note || '' });
      if (f.add) { const p = Store.get('projects', f.projectId); Store.update('projects', p.id, { wordCount: (p.wordCount || 0) + words }); }
      toast(t('saved')); App.render();
    });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'edit-proj') projectModal(Store.get('projects', a.dataset.id));
      else if (act === 'del-log') { if (confirmBox(t('delete') + '?')) { Store.remove('writingLogs', a.dataset.id); App.render(); } }
      else if (act === 'del-version') { const p = Store.get('projects', a.dataset.p); Store.update('projects', p.id, { versions: p.versions.filter(v => v.id !== a.dataset.v) }); App.render(); }
      else if (act === 'add-version') {
        const p = Store.get('projects', a.dataset.id);
        const m = modal({
          title: `${t('addVersion')} — ${p.title}`,
          body: `<div class="grid g2"><label class="field span-all"><span>${esc(t('versionLabel'))}</span><input id="vf-label" placeholder="${esc(t('versionHint'))}"></label>
            <label class="field"><span>${esc(t('date'))}</span><input type="date" id="vf-date" value="${todayISO()}"></label>
            <label class="field"><span>${esc(t('words'))}</span><input type="number" id="vf-words" value="${p.wordCount || ''}"></label>
            <label class="field span-all"><span>${esc(t('versionNote'))}</span><textarea id="vf-note" rows="3"></textarea></label></div>`,
          foot: `<button class="btn" id="vf-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="vf-save">${esc(t('save'))}</button>`,
        });
        const r = m.root;
        $('#vf-cancel', r).onclick = m.close;
        $('#vf-save', r).onclick = () => {
          const label = $('#vf-label', r).value.trim(); if (!label) return;
          Store.update('projects', p.id, { versions: [...(p.versions || []), { id: uid('v_'), label, date: $('#vf-date', r).value, words: Number($('#vf-words', r).value) || 0, note: $('#vf-note', r).value }] });
          m.close(); App.render();
        };
      }
    });
  },
};
