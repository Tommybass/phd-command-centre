/* Thesis argument map: claims, assumptions (warrants) and rebuttals, each linked to evidence */
const ArgState = (() => { let s = { chapter: '' }; try { Object.assign(s, JSON.parse(localStorage.getItem('phdcc.arg') || '{}')); } catch { } return s; })();
function saveArgState() { try { localStorage.setItem('phdcc.arg', JSON.stringify(ArgState)); } catch { } }

const Arg = {
  RANK: { missing: 0, thin: 1, strong: 2 },
  WEIGHT: { strong: 2, moderate: 1, weak: 0.5 },
  kids(id) { return Store.all('claims').filter(c => (c.parentId || '') === (id || '')).sort((a, b) => (a.order || 0) - (b.order || 0)); },
  /* Evidence from a source read only to the first pass, or with unconfirmed AI analysis, counts as weak */
  shaky(e) {
    if (e.type !== 'source') return '';
    const s = Store.get('sources', e.id); if (!s) return '';
    if (s.passDone < 2) return t('shakySkim');
    if ((s.aiDrafted || []).some(k => ['findings', 'method', 'sample', 'context'].includes(k))) return t('shakyAI');
    return '';
  },
  ownScore(c) { return (c.evidence || []).reduce((sum, e) => sum + (this.shaky(e) ? Math.min(0.5, this.WEIGHT[e.strength] || 0) : (this.WEIGHT[e.strength] || 0)), 0); },
  own(c) { const s = this.ownScore(c); return s >= 2 ? 'strong' : s > 0 ? 'thin' : 'missing'; },
  status(c, seen = new Set()) {
    if (seen.has(c.id)) return 'missing'; seen.add(c.id);
    const kids = this.kids(c.id);
    const own = this.own(c);
    if (!kids.length) return own;
    const ks = kids.map(k => this.status(k, seen));
    if (this.ownScore(c) === 0) return ks.every(k => k === 'missing') ? 'missing' : ks.every(k => k === 'strong') ? 'strong' : 'thin';
    return ks.some(k => k !== 'strong') && own === 'strong' ? 'thin' : own;
  },
  reasons(c) {
    const r = [];
    if (!(c.evidence || []).length) r.push(c.type === 'rebuttal' ? t('rsUnaddressed') : t('rsNoEvidence'));
    (c.evidence || []).forEach(e => { const why = this.shaky(e); if (why) r.push(`${Links.label(e)}: ${why}`); });
    if ((c.evidence || []).length && this.ownScore(c) < 2) r.push(t('rsThin'));
    this.kids(c.id).forEach(k => { const st = this.status(k); if (st !== 'strong') r.push(`${t('ct_' + k.type)} “${k.text.slice(0, 60)}” — ${t('as_' + st)}`); });
    return r;
  },
  descendants(id) { const out = new Set(); const walk = p => this.kids(p).forEach(k => { out.add(k.id); walk(k.id); }); walk(id); return out; },
  cite(e) {
    if (e.type === 'source') { const s = Store.get('sources', e.id); if (!s) return '?'; const a = s.authors && s.authors[0]; const n = s.authors || []; const name = a ? (a.literal || a.family) : s.title; return `${name}${n.length > 2 ? ' et al.' : n.length === 2 ? ' & ' + (n[1].literal || n[1].family) : ''}, ${s.year || 'n.d.'}${e.locator ? ', ' + e.locator : ''}`; }
    const n = Store.get('notes', e.id); return n ? `${t('lt_note')}: ${Links.noteTitle(n)}` : '?';
  },
  markdown() {
    const lines = [`# Thesis argument map — exported ${todayISO()}`, ''];
    const walk = (pid, depth) => this.kids(pid).forEach(c => {
      const ind = '  '.repeat(depth);
      lines.push(`${ind}- **${t('ct_' + c.type)}** [${t('as_' + this.status(c))}] ${c.text}${c.chapter ? ` _(${c.chapter})_` : ''}`);
      (c.evidence || []).forEach(e => lines.push(`${ind}  - ${t('evidence')}: (${this.cite(e)}) — ${t('es_' + e.strength)}${e.comment ? ': ' + e.comment : ''}`));
      walk(c.id, depth + 1);
    });
    walk('', 0);
    return lines.join('\n');
  },
  critiquePrompt() {
    return `Act as a rigorous but supportive thesis committee member in Education measurement and assessment.

Below is the argument map for ${thesisLine()}. Each line is a claim, an assumption (warrant) or a rebuttal, with its support status and the evidence I have linked.

Please:
1. Identify inferential leaps: where a claim does not follow from its sub-claims or evidence.
2. Name unstated assumptions (warrants) I should make explicit.
3. Suggest plausible rebuttals or counter-arguments I have not addressed, especially about equity ("for whom").
4. Say where my evidence is thin and what KIND of evidence (e.g., empirical study of X, policy document, my own data) would strengthen it.
Rules: do not invent or name specific sources, authors or findings. Use Canadian English spelling.

${this.markdown()}`;
  },
};

const ArgumentView = {
  render(params) {
    const id = params[0];
    const all = Store.all('claims');
    const chapters = uniq(all.map(c => c.chapter).filter(Boolean)).sort();
    const st = { strong: 0, thin: 0, missing: 0 }; all.forEach(c => st[Arg.status(c)]++);
    const weakest = all.filter(c => Arg.status(c) === 'missing' || (c.type === 'rebuttal' && !(c.evidence || []).length))
      .concat(all.filter(c => (c.evidence || []).some(e => Arg.shaky(e)) && Arg.status(c) !== 'missing'))
      .filter((c, i, a) => a.indexOf(c) === i).slice(0, 5);

    const row = (c, depth) => {
      const s = Arg.status(c);
      const kids = Arg.kids(c.id);
      const visible = !ArgState.chapter || c.chapter === ArgState.chapter || [...Arg.descendants(c.id)].some(d => (Store.get('claims', d) || {}).chapter === ArgState.chapter);
      if (!visible) return '';
      return `<a class="tree-row ${c.id === id ? 'sel' : ''} t-${c.type}" href="#/argument/${c.id}" style="padding-left:${10 + depth * 22}px">
          <span class="sdot s-${s}" title="${esc(t('as_' + s))}"></span>
          <span class="grow"><span class="pill ct-${c.type}">${esc(t('ct_' + c.type))}</span> ${esc(c.text || t('untitledClaim'))}
          <span class="small faint">${c.chapter ? ' · ' + esc(c.chapter) : ''}${(c.evidence || []).length ? ` · ${c.evidence.length} ${esc(t('evShort'))}` : ''}</span></span></a>`
        + kids.map(k => row(k, depth + 1)).join('');
    };
    const tree = Arg.kids('').map(c => row(c, 0)).join('');
    const sel = id && Store.get('claims', id);

    return `<div class="page-head"><div><h1>${esc(t('nav_argument'))}</h1><p class="sub">${esc(t('argSub'))}</p></div><span class="spacer"></span>
        <div class="row"><button class="btn primary" data-action="add-root">+ ${esc(t('addMainClaim'))}</button>
        <button class="btn ai" data-action="critique">✎ ${esc(t('copyCritique'))}</button>
        <button class="btn small" data-action="export">⇩ Markdown</button></div></div>
      <div class="dash" style="margin-bottom:16px">
        <div class="card c4"><h2>${esc(t('argHealth'))}</h2><div class="row" style="gap:16px">
          <div><div class="stat" style="color:var(--ok)">${st.strong}</div><span class="small muted">${esc(t('as_strong'))}</span></div>
          <div><div class="stat" style="color:var(--warn)">${st.thin}</div><span class="small muted">${esc(t('as_thin'))}</span></div>
          <div><div class="stat" style="color:var(--danger)">${st.missing}</div><span class="small muted">${esc(t('as_missing'))}</span></div></div>
          <details style="margin-top:10px"><summary class="small muted">${esc(t('howScored'))}</summary><p class="small muted" style="margin-top:6px">${esc(t('scoreRules'))}</p></details></div>
        <div class="card c8"><h2>${esc(t('weakest'))}</h2>${weakest.length ? `<ul class="list small">${weakest.map(c => `<li><span class="sdot s-${Arg.status(c)}"></span><div class="grow"><a href="#/argument/${c.id}">${esc(c.text.slice(0, 110))}</a><div class="faint">${esc(Arg.reasons(c).slice(0, 2).join(' · '))}</div></div></li>`).join('')}</ul>` : `<p class="empty">${esc(t('noWeak'))}</p>`}</div>
      </div>
      <div class="filters"><select data-argf="chapter"><option value="">${esc(t('allChapters'))}</option>${options(chapters, ArgState.chapter)}</select>
        <span class="small muted"><span class="sdot s-strong"></span> ${esc(t('as_strong'))} &nbsp; <span class="sdot s-thin"></span> ${esc(t('as_thin'))} &nbsp; <span class="sdot s-missing"></span> ${esc(t('as_missing'))}</span></div>
      <div class="journal ${sel ? 'has-sel' : ''}"><div class="journal-list"><div class="card tree">${tree || `<p class="empty">${esc(t('noClaims'))}</p>`}</div></div>
      <div class="journal-editor">${sel ? this.editor(sel, chapters) : `<div class="card empty hide-mobile">${esc(t('pickClaim'))}</div>`}</div></div>`;
  },

  editor(c, chapters) {
    const s = Arg.status(c), reasons = Arg.reasons(c);
    const banned = Arg.descendants(c.id); banned.add(c.id);
    const parents = Store.all('claims').filter(x => !banned.has(x.id));
    const sources = Store.all('sources').slice().sort((a, b) => Cite.sortKey(a).localeCompare(Cite.sortKey(b)));
    const notes = Store.all('notes').slice().sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="card">
      <div class="row" style="margin-bottom:8px"><a class="btn ghost small show-mobile" href="#/argument">← ${esc(t('back'))}</a>
        <span class="pill ${s === 'strong' ? 'ok' : s === 'thin' ? 'warn' : 'danger'}"><span class="sdot s-${s}"></span>${esc(t('as_' + s))}</span><span class="spacer"></span>
        <button class="btn ghost small" data-action="up" title="${esc(t('moveUp'))}">↑</button><button class="btn ghost small" data-action="down" title="${esc(t('moveDown'))}">↓</button>
        <button class="btn ghost small danger" data-action="del">${esc(t('delete'))}</button></div>
      ${reasons.length ? `<ul class="reasons small">${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      <label class="field"><span>${esc(t('ct_' + c.type))}</span><textarea data-cf="text" rows="3" placeholder="${esc(t('claimHint_' + c.type))}">${esc(c.text)}</textarea></label>
      <div class="grid g3" style="margin-top:10px">
        <label class="field"><span>${esc(t('f_type'))}</span><select data-cf="type">${options(CLAIM_TYPES, c.type, v => t('ct_' + v))}</select></label>
        <label class="field"><span>${esc(t('chapter'))}</span><input data-cf="chapter" list="arg-chapters" value="${esc(c.chapter)}"><datalist id="arg-chapters">${uniq([...chapters, ...Store.all('sources').flatMap(x => x.chapters || [])]).map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <label class="field"><span>RQ</span><input data-cf="rq" value="${esc(c.rq)}"></label>
        <label class="field span-all"><span>${esc(t('parentClaim'))}</span><select data-cf="parentId"><option value="">${esc(t('topLevel'))}</option>${options(parents.map(p => p.id), c.parentId, pid => { const p = Store.get('claims', pid); return t('ct_' + p.type) + ': ' + p.text.slice(0, 70); })}</select></label>
      </div>
      <h3 style="margin:16px 0 8px">${esc(t('evidence'))}</h3>
      ${(c.evidence || []).map((e, i) => { const why = Arg.shaky(e); return `<div class="ev-row">
        <div class="grow"><span class="pill">${esc(t('lt_' + e.type))}</span> <a href="${Links.href(e)}">${esc(Links.label(e))}</a>${why ? `<div class="small" style="color:var(--warn)">⚠ ${esc(why)}</div>` : ''}
          <div class="grid g2" style="margin-top:6px"><input data-ev="${i}" data-evk="locator" value="${esc(e.locator)}" placeholder="${esc(t('locator'))}"><select data-ev="${i}" data-evk="strength">${options(STRENGTHS, e.strength, v => t('es_' + v))}</select>
          <input class="span-all" data-ev="${i}" data-evk="comment" value="${esc(e.comment)}" placeholder="${esc(t('evComment'))}"></div></div>
        <button class="btn ghost small danger" data-action="del-ev" data-i="${i}" aria-label="${esc(t('delete'))}">✕</button></div>`; }).join('') || `<p class="empty">${esc(t('rsNoEvidence'))}</p>`}
      <div class="grid g2" style="margin-top:8px">
        <select data-addev="source"><option value="">+ ${esc(t('addSourceEv'))}</option>${sources.map(x => `<option value="${x.id}">${esc(sourceLabel(x))} — ${esc((x.title || '').slice(0, 50))}</option>`).join('')}</select>
        <select data-addev="note"><option value="">+ ${esc(t('addNoteEv'))}</option>${notes.map(x => `<option value="${x.id}">${esc(fmtDate(x.date))} · ${esc(Links.noteTitle(x).slice(0, 60))}</option>`).join('')}</select>
      </div>
      <label class="field" style="margin-top:12px"><span>${esc(t('p_notes'))}</span><textarea data-cf="notes" rows="2">${esc(c.notes)}</textarea></label>
      <div class="row" style="margin-top:14px"><span class="small muted">${esc(t('addUnder'))}:</span>
        <button class="btn small" data-action="add-child" data-type="claim">+ ${esc(t('ct_claim'))}</button>
        <button class="btn small" data-action="add-child" data-type="assumption">+ ${esc(t('ct_assumption'))}</button>
        <button class="btn small" data-action="add-child" data-type="rebuttal">+ ${esc(t('ct_rebuttal'))}</button></div>
    </div>`;
  },

  bind(root, params) {
    const id = params[0];
    const cl = () => Store.get('claims', id);
    const touch = () => { cl().updatedAt = new Date().toISOString(); Store.change(); };
    const addClaim = (parentId, type) => {
      const order = Arg.kids(parentId).length;
      const c = Store.add('claims', newClaim({ parentId, type, order, chapter: parentId ? (Store.get('claims', parentId) || {}).chapter || '' : '' }));
      location.hash = '#/argument/' + c.id; setTimeout(() => { const ta = $('[data-cf="text"]'); ta && ta.focus(); }, 30);
    };
    root.addEventListener('input', e => {
      const el = e.target; if (!cl()) return;
      if (el.dataset.cf && el.tagName !== 'SELECT') { cl()[el.dataset.cf] = el.value; touch(); }
      else if (el.dataset.ev && el.tagName !== 'SELECT') { cl().evidence[Number(el.dataset.ev)][el.dataset.evk] = el.value; touch(); }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.argf) { ArgState.chapter = el.value; saveArgState(); App.render(); return; }
      if (!cl()) { return; }
      if (el.tagName === 'SELECT' && el.dataset.cf) {
        cl()[el.dataset.cf] = el.value;
        if (el.dataset.cf === 'parentId') cl().order = Arg.kids(el.value).length;
        touch(); App.render();
      } else if (el.tagName === 'SELECT' && el.dataset.ev) { cl().evidence[Number(el.dataset.ev)][el.dataset.evk] = el.value; touch(); App.render(); }
      else if (el.dataset.addev && el.value) {
        if (!(cl().evidence || []).some(x => x.id === el.value)) cl().evidence = [...(cl().evidence || []), { type: el.dataset.addev, id: el.value, strength: 'moderate', locator: '', comment: '' }];
        touch(); App.render();
      } else if (el.dataset.cf === 'chapter') App.render();
    });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action, c = cl();
      if (act === 'add-root') addClaim('', 'claim');
      else if (act === 'add-child') addClaim(c.id, a.dataset.type);
      else if (act === 'critique') promptModal(t('copyCritique'), t('critiqueHelp'), Arg.critiquePrompt());
      else if (act === 'export') download(`argument-map-${todayISO()}.md`, Arg.markdown(), 'text/markdown');
      else if (act === 'del-ev') { c.evidence.splice(Number(a.dataset.i), 1); touch(); App.render(); }
      else if (act === 'up' || act === 'down') {
        const sib = Arg.kids(c.parentId); sib.forEach((x, i) => x.order = i);
        const i = sib.indexOf(c), j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= sib.length) return;
        [sib[i].order, sib[j].order] = [sib[j].order, sib[i].order]; touch(); App.render();
      }
      else if (act === 'del') {
        if (!confirmBox(t('confirmDeleteClaim'))) return;
        Arg.kids(c.id).forEach(k => { k.parentId = c.parentId || ''; });
        Store.remove('claims', c.id); location.hash = '#/argument';
      }
    });
  },
};
