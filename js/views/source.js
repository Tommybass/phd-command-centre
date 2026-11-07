/* Source detail: every library field, AI-draft badges, quotations, links, matrix cells */
const SourceView = {
  render(params) {
    const s = Store.get('sources', params[0]);
    if (!s) return `<div class="card empty">Source not found. <a href="#/library/all">${esc(t('back'))}</a></div>`;
    const ai = new Set(s.aiDrafted || []);
    const badge = k => ai.has(k) ? `<span class="ai-badge">✎ ${esc(t('aiDraft'))}<button type="button" data-action="confirm" data-k="${k}">${esc(t('confirm'))}</button></span>` : '';
    const F = (k, label, inner, cls = '') => `<label class="field ${ai.has(k) ? 'is-ai' : ''} ${cls}"><span>${esc(label)} ${badge(k)}</span>${inner}</label>`;
    const txt = (k, label, cls = '', type = 'text', extra = '') => F(k, label, `<input type="${type}" data-field="${k}" value="${esc(s[k])}" ${extra}>`, cls);
    const area = (k, label, rows = 3, cls = 'span-all') => F(k, label, `<textarea data-field="${k}" rows="${rows}">${esc(s[k])}</textarea>`, cls);
    const list = (k, label, hint, cls = '') => F(k, label + (hint ? ` (${hint})` : ''), `<input data-list="${k}" value="${esc((s[k] || []).join(', '))}">`, cls);
    const containerLabel = { article: t('f_container'), chapter: t('f_container_chapter'), news: t('f_container_news'), webpage: t('f_container_webpage'), thesis: t('f_container_thesis') }[s.type] || t('f_container_report');
    const T = s.type;

    const reference = `<section class="card section"><h2>${esc(t('sec_reference'))}</h2><div class="grid g4">
      ${F('type', t('f_type'), `<select data-field="type">${options(SOURCE_TYPES, s.type, v => t('type_' + v))}</select>`)}
      ${txt('year', t('f_year'), '', 'text', 'inputmode="numeric" placeholder="2024"')}
      ${(T === 'news' || T === 'webpage') ? txt('issued', t('f_issued'), 'span2', 'date') : '<span class="span2 hide-mobile"></span>'}
      ${F('authors', t('f_authors'), `<input data-names="authors" value="${esc(Cite.namesToString(s.authors))}" placeholder="${esc(t('f_authorsHint'))}">`, 'span-all')}
      ${txt('title', t('f_title'), 'span-all')}
      ${T !== 'book' ? txt('container', containerLabel, T === 'article' ? 'span2' : 'span-all') : ''}
      ${T === 'article' ? txt('volume', t('f_volume')) + txt('issue', t('f_issue')) : ''}
      ${T === 'report' || T === 'policy' ? txt('issue', 'Report no.') : ''}
      ${T === 'chapter' ? F('editors', t('f_editors'), `<input data-names="editors" value="${esc(Cite.namesToString(s.editors))}" placeholder="${esc(t('f_authorsHint'))}">`, 'span2') : ''}
      ${['article', 'chapter'].includes(T) ? txt('pages', t('f_pages')) : ''}
      ${['book', 'chapter'].includes(T) ? txt('edition', t('f_edition'), '', 'text', 'placeholder="3"') : ''}
      ${!['article', 'news', 'webpage'].includes(T) ? txt('publisher', T === 'thesis' ? t('f_publisher_thesis') : t('f_publisher'), 'span2') : ''}
      ${txt('doi', t('f_doi'), 'span2', 'text', 'placeholder="10.xxxx/xxxxx"')}
      ${txt('url', t('f_url'), 'span2', 'url')}
      ${area('abstract', t('f_abstract'), 3)}
      ${txt('zoteroKey', t('f_zoteroKey'))}
    </div></section>`;

    const projects = Store.all('projects');
    const reading = `<section class="card section"><h2>${esc(t('sec_reading'))}</h2><div class="grid g3">
      <div class="field span-all"><span class="small muted">${esc(t('f_projects'))}</span><div class="chip-row" style="margin-top:4px">
        ${projects.map(p => `<button type="button" class="chip ${(s.projects || []).includes(p.id) ? 'on' : ''}" data-action="toggle-project" data-id="${p.id}">${esc(p.title)}</button>`).join('') || `<span class="faint small">${esc(t('noProjects'))}</span>`}
      </div></div>
      ${list('chapters', t('f_chapters'), t('commaHint'))}
      ${list('researchQuestions', t('f_rqs'), t('commaHint'), 'span2')}
    </div></section>`;

    const analysis = `<section class="card section"><h2>${esc(t('sec_analysis'))}</h2><div class="grid g2">
      ${F('paradigm', t('f_paradigm'), `<input data-field="paradigm" list="paradigms" value="${esc(s.paradigm)}"><datalist id="paradigms">${PARADIGMS.map(p => `<option value="${esc(p)}">`).join('')}</datalist>`)}
      ${txt('framework', t('f_framework'))}
      ${txt('method', t('f_method'))}
      ${txt('context', t('f_context'))}
      ${txt('sample', t('f_sample'), 'span-all')}
      ${area('findings', t('f_findings'), 4)}
    </div></section>`;

    const quotes = `<section class="card section"><h2>${esc(t('sec_quotes'))} ${badge('quotes')}</h2>
      ${(s.quotes || []).map((q, i) => `<div class="quote-row">
        <div><textarea data-quote="${i}" data-q="text" rows="2" placeholder="${esc(t('quoteText'))}">${esc(q.text)}</textarea>
          <input data-quote="${i}" data-q="note" value="${esc(q.note)}" placeholder="${esc(t('quoteNote'))}" style="margin-top:4px">
          ${q.ai && q.verified === false ? `<div class="small" style="color:var(--danger)">⚠ ${esc(t('notInText'))}</div>` : ''}</div>
        <div><input data-quote="${i}" data-q="page" value="${esc(q.page)}" placeholder="p." aria-label="${esc(t('page'))}">
          ${!q.page ? `<div class="small" style="color:var(--warn)">${esc(t('pageMissing'))}</div>` : ''}</div>
        <button type="button" class="btn ghost small danger" data-action="del-quote" data-i="${i}" aria-label="${esc(t('delete'))}">✕</button>
      </div>`).join('')}
      <button type="button" class="btn small" data-action="add-quote">+ ${esc(t('addQuote'))}</button>
    </section>`;

    const critique = `<section class="card section"><h2>${esc(t('sec_critique'))}</h2><div class="grid g2">
      ${area('strengths', t('f_strengths'), 3, '')}${area('limitations', t('f_limitations'), 3, '')}${area('use', t('f_use'), 3)}
    </div></section>`;

    const others = Store.all('sources').filter(x => x.id !== s.id && !(s.related || []).includes(x.id)).sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b)));
    const links = `<section class="card section"><h2>${esc(t('sec_links'))}</h2><div class="grid">
      ${list('tags', t('f_tags'), t('f_tagsHint'))}
      <div class="field"><span class="small muted">${esc(t('f_related'))}</span>
        <div class="chip-row" style="margin:4px 0 8px">${(s.related || []).map(id => { const r = Store.get('sources', id); return r ? `<span class="chip on"><a href="#/source/${r.id}">${esc(sourceLabel(r))}</a> <button type="button" class="star" data-action="unrelate" data-id="${r.id}" aria-label="remove">✕</button></span>` : ''; }).join('')}</div>
        <select data-action-change="relate"><option value="">${esc(t('addRelated'))}</option>${others.map(o => `<option value="${o.id}">${esc(sourceLabel(o))} — ${esc((o.title || '').slice(0, 60))}</option>`).join('')}</select>
      </div></div></section>`;

    const themes = Store.all('themes');
    const matrix = themes.length ? `<section class="card section"><h2>${esc(t('sec_matrix'))}</h2><div class="grid g2">
      ${themes.map(th => `<label class="field"><span>${esc(th.name)}</span><textarea data-theme="${th.id}" rows="2">${esc((s.themes || {})[th.id] || '')}</textarea></label>`).join('')}
    </div></section>` : '';

    const back = [
      ...Store.all('sources').filter(x => (x.related || []).includes(s.id)).map(x => `<li><span class="pill">${esc(t('qa_source'))}</span><a href="#/source/${x.id}">${esc(sourceLabel(x))}</a></li>`),
      ...Store.all('tasks').filter(x => x.sourceId === s.id).map(x => `<li><span class="pill">${esc(t('qa_task'))}</span>${esc(x.title)}</li>`),
      ...Store.all('notes').filter(x => (x.links || []).some(l => l.id === s.id)).map(x => `<li><span class="kind-ico k-${x.kind}">${KIND_ICON[x.kind]}</span><a href="#/journal/${x.id}">${esc(Links.noteTitle(x))}</a></li>`),
      ...Store.all('claims').filter(c => (c.evidence || []).some(e => e.id === s.id)).map(c => `<li><span class="sdot s-${Arg.status(c)}"></span><a href="#/argument/${c.id}">${esc(c.text.slice(0, 90))}</a></li>`),
    ];
    const nAi = (s.aiDrafted || []).length;
    const aside = `<aside class="aside-sticky">
      <div class="card"><h2>${esc(t('apa7'))}</h2><div class="apa-preview" id="apa-preview">${Cite.apa(s)}</div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-action="copy-apa">${esc(t('copy'))}</button>
        ${Cite.link(s) ? `<a class="btn small" href="${esc(Cite.link(s))}" target="_blank" rel="noopener">↗ ${esc(Cite.doi(s.doi) ? 'DOI' : 'URL')}</a>` : ''}</div></div>
      ${nAi ? `<div class="card" style="border-color:var(--ai)"><p class="small" style="color:var(--ai)"><strong>✎ ${esc(t('aiFieldsLeft', { n: nAi }))}</strong></p><button class="btn small ai" data-action="confirm-all">${esc(t('confirmAll'))}</button></div>` : ''}
      <div class="card"><h2>${esc(t('sec_reading'))}</h2>
        <div class="grid g2">
          <label class="field"><span>${esc(t('f_priority'))}</span><select data-field="priority" data-num>${options([3, 2, 1], s.priority, v => t('prio_' + v))}</select></label>
          <label class="field"><span>${esc(t('f_targetPass'))}</span><select data-field="targetPass" data-num>${options([1, 2, 3], s.targetPass, v => v + ' / 3')}</select></label>
        </div>
        <p class="small muted" style="margin:12px 0 6px">${esc(t('f_passes'))}</p>
        ${[1, 2, 3].map(i => `<div class="row" style="margin-bottom:6px"><button class="pass ${i <= s.passDone ? 'done' : (i <= s.targetPass ? 'target' : '')}" data-action="pass" data-i="${i}" aria-pressed="${i <= s.passDone}">${i}</button>
          <span class="small">${esc(t('pass' + i))}</span><span class="spacer"></span><span class="small faint">${esc(fmtDate(((s.passLog || []).filter(l => l.pass === i).pop() || {}).date))}</span></div>`).join('')}
        <p class="small muted" style="margin:8px 0 0">${esc(t('f_dateRead'))}: ${esc(fmtDate(s.dateRead) || '—')}</p>
      </div>
      <div class="card"><h2>${esc(t('sec_backlinks'))}</h2>${back.length ? `<ul class="list small">${back.join('')}</ul>` : `<p class="empty">${esc(t('noBacklinks'))}</p>`}</div>
    </aside>`;

    return `<div class="page-head"><a class="btn ghost" href="#/library/queue">← ${esc(t('back'))}</a><div style="min-width:0"><h1>${esc(sourceLabel(s))}</h1><p class="sub">${esc(s.title)}</p></div><span class="spacer"></span>
        <button class="btn ai" data-action="ai-fill">✎ ${esc(t('pasteAbstract'))}</button>
        <button class="btn danger" data-action="delete">${esc(t('delete'))}</button></div>
      <div class="detail"><div>${reference}${reading}${analysis}${quotes}${critique}${links}${matrix}</div>${aside}</div>`;
  },

  bind(root, params) {
    const id = params[0];
    const s = () => Store.get('sources', id);
    if (!s()) return;
    const refreshAPA = () => { const p = $('#apa-preview', root); if (p) p.innerHTML = Cite.apa(s()); };
    const touch = () => { s().updatedAt = new Date().toISOString(); Store.change(); };

    root.addEventListener('input', e => {
      const el = e.target, src = s();
      if (el.dataset.field && el.tagName !== 'SELECT') { src[el.dataset.field] = el.value; touch(); refreshAPA(); }
      else if (el.dataset.names) { src[el.dataset.names] = Cite.parseNames(el.value); touch(); refreshAPA(); }
      else if (el.dataset.list) { src[el.dataset.list] = splitList(el.value); touch(); }
      else if (el.dataset.quote !== undefined) { src.quotes[Number(el.dataset.quote)][el.dataset.q] = el.value; touch(); }
      else if (el.dataset.theme) { src.themes = src.themes || {}; if (el.value.trim()) src.themes[el.dataset.theme] = el.value; else delete src.themes[el.dataset.theme]; touch(); }
    });
    root.addEventListener('change', e => {
      const el = e.target, src = s();
      if (el.tagName === 'SELECT' && el.dataset.field) {
        src[el.dataset.field] = el.dataset.num !== undefined ? Number(el.value) : el.value;
        if (el.dataset.field === 'targetPass' && src.passDone > src.targetPass) src.passDone = src.targetPass;
        touch(); App.render();
      } else if (el.dataset.actionChange === 'relate' && el.value) {
        const other = Store.get('sources', el.value);
        src.related = uniq([...(src.related || []), other.id]); other.related = uniq([...(other.related || []), src.id]);
        touch(); App.render();
      } else if (el.dataset.list === 'tags') { App.render(); }
    });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const src = s(); const act = a.dataset.action;
      if (act === 'confirm') { e.preventDefault(); src.aiDrafted = (src.aiDrafted || []).filter(k => k !== a.dataset.k); touch(); App.render(); }
      else if (act === 'confirm-all') { src.aiDrafted = []; touch(); App.render(); }
      else if (act === 'toggle-project') { const set = new Set(src.projects || []); set.has(a.dataset.id) ? set.delete(a.dataset.id) : set.add(a.dataset.id); src.projects = [...set]; touch(); App.render(); }
      else if (act === 'add-quote') { src.quotes = [...(src.quotes || []), { text: '', page: '', note: '' }]; touch(); App.render(); setTimeout(() => { const q = $$('[data-q="text"]', $('#view')); q.length && q[q.length - 1].focus(); }, 0); }
      else if (act === 'del-quote') { src.quotes.splice(Number(a.dataset.i), 1); touch(); App.render(); }
      else if (act === 'unrelate') { e.preventDefault(); const o = Store.get('sources', a.dataset.id); src.related = src.related.filter(x => x !== a.dataset.id); if (o) o.related = (o.related || []).filter(x => x !== src.id); touch(); App.render(); }
      else if (act === 'pass') {
        const i = Number(a.dataset.i);
        if (src.passDone >= i) src.passDone = i - 1;
        else { src.passDone = i; src.passLog = [...(src.passLog || []), { pass: i, date: todayISO() }]; src.dateRead = todayISO(); if (i > src.targetPass) src.targetPass = i; }
        touch(); App.render();
      }
      else if (act === 'copy-apa') copyText(Cite.apaText(src), Cite.apa(src));
      else if (act === 'ai-fill') openAIModal(src.id);
      else if (act === 'delete') { if (confirmBox(t('confirmDelete'))) { Store.remove('sources', src.id); location.hash = '#/library/all'; } }
    });
  },
};
