/* Library: reading queue, all sources, synthesis matrix, timeline, tags */
const LibState = (() => {
  let s = { q: '', project: '', status: '', type: '', tag: '', matrixProject: '' };
  try { Object.assign(s, JSON.parse(localStorage.getItem('phdcc.lib') || '{}')); } catch { }
  return s;
})();
function saveLibState() { try { localStorage.setItem('phdcc.lib', JSON.stringify(LibState)); } catch { } }

function passDots(s) {
  let h = '<span class="passes" title="' + esc(t('st_' + sourceStatus(s))) + '">';
  for (let i = 1; i <= 3; i++) {
    const cls = i <= s.passDone ? 'done' : (i <= s.targetPass ? 'target' : 'off');
    h += `<span class="pass ${cls}">${i}</span>`;
  }
  return h + '</span>';
}
function prioDots(p) { p = Number(p) || 1; return `<span class="prio" title="${esc(t('prio_' + p))}">${'●'.repeat(p)}<span class="o">${'●'.repeat(3 - p)}</span></span>`; }
function aiPill(s) { const n = (s.aiDrafted || []).length; return n ? `<span class="pill ai" title="${esc(t('aiFieldsLeft', { n }))}">✎ ${n}</span>` : ''; }

const LibraryView = {
  render(params, query) {
    const tab = params[0] || 'queue';
    if (query.tag !== undefined) { LibState.tag = query.tag; }
    if (query.project !== undefined) { LibState.project = query.project; }
    const tabs = ['queue', 'all', 'matrix', 'timeline', 'tags'].map(k =>
      `<a class="tab ${tab === k ? 'active' : ''}" href="#/library/${k}">${esc(t(k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_library'))}</h1><p class="sub">${Store.all('sources').length} ${esc(t('sources'))}</p></div>
      <span class="spacer"></span>
      <div class="row">
        <button class="btn" data-action="lib-new">+ ${esc(t('addSource'))}</button>
        <button class="btn ai" data-action="ai-source">✎ ${esc(t('pasteAbstract'))}</button>
        <button class="btn" data-action="lib-import">${esc(t('importZotero'))}</button>
      </div></div>
      <nav class="tabs">${tabs}</nav>`;
    let body = '';
    if (tab === 'queue' || tab === 'all') body = this.list(tab);
    else if (tab === 'matrix') body = this.matrix();
    else if (tab === 'timeline') body = this.timeline();
    else body = this.tagView();
    return head + body;
  },

  filtered(tab) {
    const q = LibState.q.toLowerCase();
    let list = Store.all('sources').filter(s =>
      (!LibState.project || (s.projects || []).includes(LibState.project)) &&
      (!LibState.type || s.type === LibState.type) &&
      (!LibState.tag || (s.tags || []).includes(LibState.tag)) &&
      (!LibState.status || sourceStatus(s) === LibState.status) &&
      (!q || [s.title, Cite.namesToString(s.authors), s.year, s.container, (s.tags || []).join(' '), s.findings, s.framework].join(' ').toLowerCase().includes(q)));
    if (tab === 'queue') {
      list = list.filter(inQueue).sort((a, b) => (b.priority - a.priority) || (b.passDone - a.passDone) || a.createdAt.localeCompare(b.createdAt));
    } else {
      list.sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b)));
    }
    return list;
  },

  filterBar(tab) {
    const projects = Store.all('projects');
    const tags = uniq(Store.all('sources').flatMap(s => s.tags || [])).sort();
    return `<div class="filters">
      <input type="search" data-filter="q" value="${esc(LibState.q)}" placeholder="${esc(t('filterText'))}">
      <select data-filter="project"><option value="">${esc(t('anyProject'))}</option>${options(projects.map(p => p.id), LibState.project, projectName)}</select>
      ${tab === 'all' ? `<select data-filter="status"><option value="">${esc(t('anyPass'))}</option>${options(['toread', 'pass1', 'pass2', 'pass3', 'complete'], LibState.status, v => t('st_' + v))}</select>` : ''}
      <select data-filter="type"><option value="">${esc(t('anyType'))}</option>${options(SOURCE_TYPES, LibState.type, v => t('type_' + v))}</select>
      <select data-filter="tag"><option value="">${esc(t('anyTag'))}</option>${options(tags, LibState.tag)}</select>
    </div>`;
  },

  list(tab) {
    const list = this.filtered(tab);
    const total = tab === 'queue' ? Store.all('sources').filter(inQueue).length : Store.all('sources').length;
    const rows = list.map(s => `<tr class="clickable" data-href="#/source/${s.id}">
      <td class="hide-mobile">${prioDots(s.priority)}</td>
      <td>${passDots(s)}</td>
      <td class="title-cell"><strong>${esc(sourceLabel(s))}</strong> ${aiPill(s)}<br><span class="muted small">${esc(s.title)}</span></td>
      <td class="hide-mobile small">${esc(t('type_' + s.type))}</td>
      <td class="hide-mobile small">${(s.projects || []).map(id => `<span class="pill accent">${esc(projectName(id))}</span>`).join(' ')}</td>
      <td class="hide-mobile small">${(s.tags || []).slice(0, 4).map(x => `<span class="pill">${esc(x)}</span>`).join(' ')}</td>
    </tr>`).join('');
    return `${this.filterBar(tab)}
      <div class="row" style="margin-bottom:8px"><span class="muted small">${esc(t('showing', { n: list.length, t: total }))}</span><span class="spacer"></span>
        <span class="small muted">${esc(t('export'))}:</span>
        <button class="btn small" data-action="exp-apa">${esc(t('exportAPA'))}</button>
        <button class="btn small" data-action="exp-csv">${esc(t('exportCSV'))}</button>
        <button class="btn small" data-action="exp-ris">${esc(t('exportRIS'))}</button>
        <button class="btn small" data-action="exp-bib">${esc(t('exportBib'))}</button>
      </div>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th class="hide-mobile">${esc(t('priority'))}</th><th>${esc(t('status'))}</th><th>${esc(t('reference'))}</th><th class="hide-mobile">${esc(t('type'))}</th><th class="hide-mobile">${esc(t('projects'))}</th><th class="hide-mobile">${esc(t('tags'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="card empty">${esc(tab === 'queue' && total === 0 && Store.all('sources').length ? t('queueEmpty') : t('noSources'))}</div>`}`;
  },

  matrixSources() {
    return Store.all('sources').filter(s => !LibState.matrixProject || (s.projects || []).includes(LibState.matrixProject))
      .sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b)));
  },
  matrix() {
    const themes = Store.all('themes').slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const sources = this.matrixSources();
    const projects = Store.all('projects');
    const tools = `<div class="filters">
      <select data-filter="matrixProject"><option value="">${esc(t('anyProject'))}</option>${options(projects.map(p => p.id), LibState.matrixProject, projectName)}</select>
      <button class="btn" data-action="theme-add">+ ${esc(t('addTheme'))}</button>
      <span class="spacer"></span>
      <button class="btn ai" data-action="connections">✎ ${esc(t('connections'))}</button>
      <button class="btn ai" data-action="outline">✎ ${esc(t('copyOutline'))}</button>
    </div><p class="muted small">${esc(t('matrixHint'))}</p>`;
    if (!themes.length) return tools + `<div class="card empty">${esc(t('noThemes'))}</div>`;
    const head = themes.map(th => `<th><div class="th-theme"><span><span class="kind">${esc(t('kind_' + (th.kind || 'theme')))}</span>${esc(th.name)}</span>
      <button class="btn ghost small" data-action="theme-edit" data-id="${th.id}" aria-label="${esc(t('edit'))}">⋯</button></div></th>`).join('');
    const rows = sources.map(s => `<tr><td><a href="#/source/${s.id}"><strong>${esc(sourceLabel(s))}</strong></a><br><span class="small muted">${esc((s.title || '').slice(0, 70))}</span></td>
      ${themes.map(th => { const v = (s.themes || {})[th.id]; return `<td class="cell ${v ? '' : 'emptycell'}" data-action="cell" data-s="${s.id}" data-t="${th.id}">${v ? esc(v.length > 140 ? v.slice(0, 140) + '…' : v) : '·'}</td>`; }).join('')}</tr>`).join('');
    const gaps = themes.map(th => {
      const n = sources.filter(s => (s.themes || {})[th.id]).length;
      const cls = n === 0 ? 'danger' : n < 2 ? 'warn' : 'ok';
      const lbl = n === 0 ? t('gap') : n < 2 ? t('thin') : '';
      return `<td><span class="pill ${cls}">${n} ${esc(n === 1 ? t('source1') : t('sources'))}${lbl ? ' · ' + esc(lbl) : ''}</span></td>`;
    }).join('');
    return tools + `<div class="table-wrap"><table class="matrix"><thead><tr><th>${esc(t('reference'))}</th>${head}</tr></thead>
      <tbody><tr class="gaps"><td><strong>${esc(t('gapsRow'))}</strong></td>${gaps}</tr>${rows}</tbody></table></div>`;
  },

  timeline() {
    const groups = {};
    Store.all('sources').forEach(s => { const y = s.year || t('noYear'); (groups[y] = groups[y] || []).push(s); });
    const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    if (!years.length) return `<div class="card empty">${esc(t('noSources'))}</div>`;
    return years.map(y => `<div class="timeline-year">${esc(y)} <span class="small muted">· ${groups[y].length}</span></div>
      <div class="card"><ul class="list">${groups[y].sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b))).map(s =>
      `<li><span>${passDots(s)}</span><div class="grow"><a href="#/source/${s.id}" class="apa-link" style="color:var(--text)">${Cite.apa(s)}</a></div></li>`).join('')}</ul></div>`).join('');
  },

  tagView() {
    const counts = {};
    Store.all('sources').forEach(s => (s.tags || []).forEach(x => { counts[x] = (counts[x] || 0) + 1; }));
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    if (!tags.length) return `<div class="card empty">${esc(t('noSources'))}</div>`;
    return `<div class="card"><div class="chip-row">${tags.map(x => `<a class="chip" href="#/library/all?tag=${encodeURIComponent(x)}">${esc(x)}<span class="n">${counts[x]}</span></a>`).join('')}</div></div>`;
  },

  bind(root, params) {
    const tab = params[0] || 'queue';
    root.addEventListener('input', e => {
      const f = e.target.dataset.filter; if (!f) return;
      LibState[f] = e.target.value; saveLibState();
      if (f === 'q') { debouncedRerender(); } else App.render();
    });
    root.addEventListener('click', async e => {
      const tr = e.target.closest('tr[data-href]');
      if (tr && !e.target.closest('a,button')) { location.hash = tr.dataset.href; return; }
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      const list = () => (tab === 'queue' || tab === 'all') ? this.filtered(tab) : Store.all('sources');
      if (act === 'lib-new') { const s = Store.add('sources', newSource()); location.hash = '#/source/' + s.id; }
      else if (act === 'ai-source') openAIModal();
      else if (act === 'lib-import') importZotero();
      else if (act === 'exp-apa') { const { html, text } = Cite.apaList(list()); copyText(text, html); download(`references-apa-${todayISO()}.html`, html, 'text/html'); }
      else if (act === 'exp-csv') download(`sources-${todayISO()}.csv`, Cite.csv(list()), 'text/csv');
      else if (act === 'exp-ris') download(`sources-${todayISO()}.ris`, Cite.ris(list()), 'application/x-research-info-systems');
      else if (act === 'exp-bib') download(`sources-${todayISO()}.bib`, Cite.bibtex(list()), 'application/x-bibtex');
      else if (act === 'theme-add') themeModal();
      else if (act === 'theme-edit') themeModal(Store.get('themes', a.dataset.id));
      else if (act === 'cell') cellModal(a.dataset.s, a.dataset.t);
      else if (act === 'outline') promptModal(t('outlineTitle'), t('outlineHelp'), AI.outlinePrompt(Store.all('themes').slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0)), this.matrixSources()));
      else if (act === 'connections') connectionsModal();
    });
  },
};
const debouncedRerender = debounce(() => {
  const el = document.activeElement; const pos = el && el.selectionStart;
  App.render();
  const f = $('[data-filter="q"]'); if (f) { f.focus(); try { f.setSelectionRange(pos, pos); } catch { } }
}, 250);

async function importZotero() {
  toast(t('zoteroHelp'), 5000);
  const file = await pickFile('.json,.ris,.txt');
  if (!file) return;
  const text = await file.text();
  let list = [];
  try {
    if (/^\s*[\[{]/.test(text)) { const j = JSON.parse(text); list = Cite.fromCSL(Array.isArray(j) ? j : (j.items || [j])); }
    else list = Cite.fromRIS(text);
  } catch (e) { toast('Could not read that file.'); return; }
  const r = Cite.addImported(list);
  toast(t('imported', { n: r.n, d: r.d }), 4000);
  App.render();
}

function themeModal(th) {
  const m = modal({
    title: th ? t('renameTheme') : t('addTheme'),
    body: `<label class="field"><span>${esc(t('themeName'))}</span><input id="th-name" value="${esc(th ? th.name : '')}"></label>
      <label class="field"><span>${esc(t('themeKind'))}</span><select id="th-kind">${options(['theme', 'rq'], th ? th.kind : 'theme', v => t('kind_' + v))}</select></label>`,
    foot: `${th ? `<button class="btn danger" id="th-del">${esc(t('deleteTheme'))}</button><span class="spacer"></span>` : ''}<button class="btn" data-close2>${esc(t('cancel'))}</button><button class="btn primary" id="th-save">${esc(t('save'))}</button>`,
  });
  const r = m.root;
  r.querySelector('[data-close2]').onclick = m.close;
  const save = () => {
    const name = $('#th-name', r).value.trim(); if (!name) return;
    const kind = $('#th-kind', r).value;
    if (th) Store.update('themes', th.id, { name, kind });
    else Store.add('themes', { name, kind, order: Store.all('themes').length });
    m.close(); App.render();
  };
  $('#th-save', r).onclick = save;
  $('#th-name', r).onkeydown = e => { if (e.key === 'Enter') save(); };
  if (th) $('#th-del', r).onclick = () => { if (confirmBox(`${t('deleteTheme')}: ${th.name}?`)) { Store.remove('themes', th.id); m.close(); App.render(); } };
}

function cellModal(sid, tid) {
  const s = Store.get('sources', sid), th = Store.get('themes', tid);
  const m = modal({
    title: t('cellTitle', { s: sourceLabel(s), t: th.name }),
    body: `<textarea id="cell-v" rows="6">${esc((s.themes || {})[tid] || '')}</textarea>
      ${s.findings ? `<div class="small muted"><strong>${esc(t('f_findings'))}:</strong> ${esc(s.findings)}</div>` : ''}`,
    foot: `<button class="btn" data-close2>${esc(t('cancel'))}</button><button class="btn primary" id="cell-save">${esc(t('save'))} <kbd>Ctrl ↵</kbd></button>`,
  });
  const save = () => {
    const v = $('#cell-v', m.root).value.trim();
    const themes = Object.assign({}, s.themes || {});
    if (v) themes[tid] = v; else delete themes[tid];
    Store.update('sources', sid, { themes }); m.close(); App.render();
  };
  m.root.querySelector('[data-close2]').onclick = m.close;
  $('#cell-save', m.root).onclick = save;
  $('#cell-v', m.root).onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); };
}

function promptModal(title, help, prompt) {
  const m = modal({
    title, wide: true,
    body: `<p class="muted small">${esc(help)}</p><textarea class="prompt-box" rows="14" readonly>${esc(prompt)}</textarea>`,
    foot: `<button class="btn" data-close2>${esc(t('close'))}</button><button class="btn primary" id="pm-copy">${esc(t('copyPrompt'))}</button>`,
  });
  m.root.querySelector('[data-close2]').onclick = m.close;
  $('#pm-copy', m.root).onclick = () => copyText(prompt);
}

function suggestConnections() {
  const S = Store.all('sources'); const out = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const a = S[i], b = S[j];
    if ((a.related || []).includes(b.id) || (b.related || []).includes(a.id)) continue;
    const tags = (a.tags || []).filter(x => (b.tags || []).includes(x));
    const th = Object.keys(a.themes || {}).filter(k => (b.themes || {})[k]).map(k => (Store.get('themes', k) || {}).name).filter(Boolean);
    const fw = a.framework && b.framework && a.framework.toLowerCase() === b.framework.toLowerCase() ? [a.framework] : [];
    const score = tags.length + th.length * 1.5 + fw.length;
    if (score >= 2) out.push({ a, b, score, why: [...tags.map(x => '#' + x), ...th, ...fw] });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 20);
}
function connectionsModal() {
  const list = suggestConnections();
  const m = modal({
    title: t('connTitle'), wide: true,
    body: `<p class="muted small">${esc(t('connHelp'))}</p>
      ${list.length ? `<ul class="list">${list.map((c, i) => `<li><div class="grow"><strong>${esc(sourceLabel(c.a))}</strong> ↔ <strong>${esc(sourceLabel(c.b))}</strong><br><span class="small muted">${c.why.map(esc).join(' · ')}</span></div>
        <button class="btn small" data-link="${i}">${esc(t('link'))}</button></li>`).join('')}</ul>` : `<p class="empty">${esc(t('noConn'))}</p>`}`,
    foot: `<button class="btn ai" id="cn-prompt">✎ ${esc(t('connPrompt'))}</button><span class="spacer"></span><button class="btn" data-close2>${esc(t('close'))}</button>`,
  });
  m.root.querySelector('[data-close2]').onclick = () => { m.close(); App.render(); };
  m.root.addEventListener('click', e => {
    const b = e.target.closest('[data-link]'); if (!b) return;
    const c = list[Number(b.dataset.link)];
    c.a.related = uniq([...(c.a.related || []), c.b.id]); c.b.related = uniq([...(c.b.related || []), c.a.id]);
    Store.change(); b.textContent = t('linked'); b.disabled = true;
  });
  $('#cn-prompt', m.root).onclick = () => copyText(AI.connectionsPrompt(Store.all('sources'), Store.all('themes')));
}
