/* Study cards: make cards from notes, sources and claims; review them with spaced repetition (SM-2 style) */
const SRS = {
  grade(c, g) {          // g: 0 again, 1 hard, 2 good, 3 easy
    const today = todayISO();
    if (g === 0) { c.reps = 0; c.lapses = (c.lapses || 0) + 1; c.ease = Math.max(1.3, c.ease - 0.2); c.interval = 1; }
    else if (g === 1) { c.ease = Math.max(1.3, c.ease - 0.15); c.interval = Math.max(1, Math.round((c.interval || 1) * 1.2)); c.reps++; }
    else if (g === 2) { c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.interval * c.ease); c.reps++; }
    else { c.interval = c.reps === 0 ? 3 : Math.round(Math.max(c.interval, 1) * c.ease * 1.3); c.ease += 0.15; c.reps++; }
    c.due = addDays(today, c.interval); c.lastReview = today; c.updatedAt = new Date().toISOString();
    Store.data.cardLog = Store.data.cardLog || {}; Store.data.cardLog[today] = (Store.data.cardLog[today] || 0) + 1;
    Store.change();
  },
  preview(c, g) { const x = Object.assign({}, c); const ease = x.ease; if (g === 0) return 1; if (g === 1) return Math.max(1, Math.round((x.interval || 1) * 1.2)); if (g === 2) return x.reps === 0 ? 1 : x.reps === 1 ? 3 : Math.round(x.interval * ease); return x.reps === 0 ? 3 : Math.round(Math.max(x.interval, 1) * ease * 1.3); },
  isNew(c) { return !c.lastReview; },
  queue(deck) {
    const all = Store.all('cards').filter(c => !deck || c.deck === deck);
    const due = all.filter(c => !this.isNew(c) && c.due <= todayISO()).sort((a, b) => a.due.localeCompare(b.due));
    const newToday = Store.all('cards').filter(c => c.firstReview === todayISO()).length;
    const fresh = all.filter(c => this.isNew(c)).slice(0, Math.max(0, (Number(Store.data.settings.newCardsPerDay) || 20) - newToday));
    return [...due, ...fresh];
  },
};
const CardState = { deck: '', queue: null, i: 0, shown: false, again: [], done: 0 };
const decks = () => uniq(Store.all('cards').map(c => c.deck).filter(Boolean)).sort();

const CardsView = {
  render(params) {
    const tab = params[0] || 'review';
    const tabs = ['review', 'browse', 'make'].map(k => `<a class="tab ${tab === k ? 'active' : ''}" href="#/cards/${k}">${esc(t('ct2_' + k))}</a>`).join('');
    const head = `<div class="page-head"><div><h1>${esc(t('nav_cards'))}</h1><p class="sub">${esc(t('cardsSub'))}</p></div><span class="spacer"></span><button class="btn primary" data-action="new-card">+ ${esc(t('newCard'))}</button></div><nav class="tabs">${tabs}</nav>`;
    return head + (tab === 'browse' ? this.browse() : tab === 'make' ? this.make() : this.review());
  },

  review() {
    const C = Store.all('cards');
    if (!C.length) return `<div class="card empty">${esc(t('noCards'))} <a href="#/cards/make">${esc(t('ct2_make'))}</a></div>`;
    if (!CardState.queue) { CardState.queue = SRS.queue(CardState.deck); CardState.i = 0; CardState.shown = false; CardState.again = []; CardState.done = 0; }
    const q = CardState.queue, c = q[CardState.i];
    const deckSel = `<div class="filters"><select data-deck><option value="">${esc(t('allDecks'))}</option>${options(decks(), CardState.deck)}</select>
      <span class="small muted">${esc(t('cardsDueLine', { d: C.filter(x => !SRS.isNew(x) && x.due <= todayISO()).length, n: C.filter(SRS.isNew).length, t: C.length }))}</span></div>`;
    // 7-day forecast
    const fc = Array.from({ length: 7 }, (_, i) => { const d = addDays(todayISO(), i); return { d, n: C.filter(x => !SRS.isNew(x) && (i === 0 ? x.due <= d : x.due === d)).length }; });
    const mx = Math.max(1, ...fc.map(x => x.n));
    const forecast = `<div class="card" style="margin-top:14px"><h3 class="small muted">${esc(t('forecast'))}</h3><div class="forecast">${fc.map(x => `<div title="${x.n}"><i style="height:${x.n / mx * 60}px"></i><span>${esc(parseISO(x.d).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'narrow' }))}</span><b>${x.n}</b></div>`).join('')}</div>
      <p class="small faint">${esc(t('matureLine', { n: C.filter(x => x.interval >= 21).length }))}</p></div>`;
    if (!c) return deckSel + `<div class="card study done-card"><h2>✓ ${esc(t('sessionDone'))}</h2><p class="muted">${esc(t('sessionDoneText', { n: CardState.done }))}</p><button class="btn" data-action="restart">↻ ${esc(t('checkAgain'))}</button></div>` + forecast;
    return deckSel + `<div class="card study">
      <div class="row small muted"><span class="pill">${esc(c.deck)}</span>${SRS.isNew(c) ? `<span class="pill accent">${esc(t('newWord'))}</span>` : ''}${c.ai ? `<span class="pill ai">✎ ${esc(t('aiDraft'))}</span>` : ''}<span class="spacer"></span>${CardState.i + 1} / ${q.length}<button class="btn ghost small" data-action="edit-card" data-id="${c.id}">${esc(t('edit'))}</button></div>
      <div class="card-front">${Links.render(c.front)}</div>
      ${CardState.shown ? `<hr><div class="card-back">${Links.render(c.back)}</div>${c.from ? `<p class="small faint">${esc(t('fromLabel'))}: <a href="${Links.href(c.from)}">${esc(Links.label(c.from))}</a></p>` : ''}
        <div class="grades">${[0, 1, 2, 3].map(g => `<button class="btn g${g}" data-grade="${g}"><b>${esc(t('gr_' + g))}</b><span>${SRS.preview(c, g)} ${esc(t('dayShort'))}</span><kbd>${g + 1}</kbd></button>`).join('')}</div>`
        : `<button class="btn primary show-ans" data-action="show">${esc(t('showAnswer'))} <kbd>Space</kbd></button>`}
    </div>` + forecast;
  },

  browse() {
    const C = Store.all('cards').slice().sort((a, b) => a.deck.localeCompare(b.deck) || a.due.localeCompare(b.due));
    return `<div class="row" style="margin-bottom:10px"><span class="small muted" style="flex:1">${esc(t('browseHelp'))}</span><button class="btn" data-action="export-cards">⇩ CSV (Anki)</button></div>
      ${C.length ? `<div class="table-wrap"><table><thead><tr><th>${esc(t('deck'))}</th><th>${esc(t('front'))}</th><th class="hide-mobile">${esc(t('back'))}</th><th>${esc(t('t_due'))}</th><th class="hide-mobile">${esc(t('interval'))}</th><th></th></tr></thead><tbody>
      ${C.map(c => `<tr><td class="small">${esc(c.deck)}</td><td>${esc(c.front.slice(0, 90))}${c.ai ? ` <span class="pill ai">✎</span>` : ''}</td><td class="small hide-mobile muted">${esc(c.back.replace(/\s+/g, ' ').slice(0, 110))}</td><td class="small" style="white-space:nowrap">${SRS.isNew(c) ? esc(t('newWord')) : esc(fmtDate(c.due, { day: 'numeric', month: 'short' }))}</td><td class="small hide-mobile">${c.interval} ${esc(t('dayShort'))}</td>
        <td><button class="btn ghost small" data-action="edit-card" data-id="${c.id}">${esc(t('edit'))}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="card empty">${esc(t('noCards'))}</div>`}`;
  },

  make() {
    const cands = cardCandidates();
    const dk = decks();
    return `<div class="card" style="margin-bottom:14px"><p class="small muted">${esc(t('makeHelp'))}</p>
      <div class="row"><label class="field" style="min-width:220px"><span>${esc(t('deck'))}</span><input id="mk-deck" list="deck-list" value="${esc(dk[0] || t('defaultDeck'))}"><datalist id="deck-list">${[...dk, t('defaultDeck'), t('deckDefence'), t('deckTheorists'), t('deckMethods')].filter((x, i, a) => a.indexOf(x) === i).map(d => `<option value="${esc(d)}">`).join('')}</datalist></label>
      <span class="spacer"></span><button class="btn ai" data-action="ai-cards">✎ ${esc(t('aiCards'))}</button></div></div>
      ${cands.length ? `<div class="card"><div class="row" style="margin-bottom:6px"><strong>${esc(t('candidates', { n: cands.length }))}</strong><span class="spacer"></span><button class="btn small" data-action="toggle-all">${esc(t('toggleAll'))}</button><button class="btn primary" data-action="add-cands">${esc(t('addSelected'))}</button></div>
        <ul class="list">${cands.map((c, i) => `<li><input type="checkbox" class="check" data-cand="${i}" ${c.pre ? 'checked' : ''}><div class="grow"><span class="pill">${esc(t('cs2_' + c.how))}</span> <strong>${esc(c.front.slice(0, 140))}</strong><div class="small muted">${esc(c.back.replace(/\s+/g, ' ').slice(0, 220))}</div></div></li>`).join('')}</ul></div>`
        : `<div class="card empty">${esc(t('noCandidates'))}</div>`}`;
  },

  bind(root, params) {
    const tab = params[0] || 'review';
    root.addEventListener('change', e => { if (e.target.dataset.deck !== undefined) { CardState.deck = e.target.value; CardState.queue = null; App.render(); } });
    root.addEventListener('click', e => {
      const g = e.target.closest('[data-grade]');
      if (g) { gradeCurrent(Number(g.dataset.grade)); return; }
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action;
      if (act === 'show') { CardState.shown = true; App.render(); }
      else if (act === 'restart') { CardState.queue = null; App.render(); }
      else if (act === 'new-card') cardModal();
      else if (act === 'edit-card') cardModal(Store.get('cards', a.dataset.id));
      else if (act === 'export-cards') { const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`; download(`study-cards-${todayISO()}.csv`, Store.all('cards').map(c => [c.front, c.back, (c.deck || '').replace(/\s+/g, '_')].map(q).join(',')).join('\r\n'), 'text/csv'); }
      else if (act === 'toggle-all') { const boxes = $$('[data-cand]', root), on = boxes.some(b => !b.checked); boxes.forEach(b => b.checked = on); }
      else if (act === 'add-cands') {
        const cands = cardCandidates(), deck = $('#mk-deck', root).value.trim() || t('defaultDeck'); let n = 0;
        $$('[data-cand]:checked', root).forEach(b => { const c = cands[Number(b.dataset.cand)]; Store.data.cards.push(newCard({ front: c.front, back: c.back, deck, from: c.from })); n++; });
        Store.change(); CardState.queue = null; toast(t('cardsAdded', { n })); App.render();
      }
      else if (act === 'ai-cards') aiCardsModal($('#mk-deck', root).value.trim() || t('defaultDeck'));
    });
  },
};
function newCard(o) { const now = new Date().toISOString(); return Object.assign({ id: uid('cd_'), createdAt: now, updatedAt: now, front: '', back: '', deck: t('defaultDeck'), tags: [], ease: 2.5, interval: 0, reps: 0, lapses: 0, due: todayISO(), from: null, ai: false, lastReview: '' }, o); }
function gradeCurrent(g) {
  const c = CardState.queue && CardState.queue[CardState.i]; if (!c || !CardState.shown) return;
  if (SRS.isNew(c)) c.firstReview = todayISO();
  SRS.grade(c, g); CardState.done++;
  if (g === 0) CardState.queue.push(c);   // see it again this session
  CardState.i++; CardState.shown = false; App.render();
}
/* Keyboard: Space shows the answer, 1–4 grade */
document.addEventListener('keydown', e => {
  if (!location.hash.startsWith('#/cards') || (location.hash.split('/')[2] || 'review').split('?')[0] !== 'review') return;
  if (modalStack.length || ['input', 'textarea', 'select'].includes((e.target.tagName || '').toLowerCase())) return;
  if (e.key === ' ' && !CardState.shown && CardState.queue && CardState.queue[CardState.i]) { e.preventDefault(); CardState.shown = true; App.render(); }
  else if (CardState.shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); gradeCurrent(Number(e.key) - 1); }
});

/* Candidate cards built from your own notes, sources and argument map (never invented) */
function cardCandidates() {
  const have = new Set(Store.all('cards').map(c => c.front.trim().toLowerCase()));
  const out = [], add = (front, back, how, from, pre = true) => { front = front.trim(); back = back.trim(); if (!front || !back || have.has(front.toLowerCase())) return; have.add(front.toLowerCase()); out.push({ front, back, how, from, pre }); };
  const strip = s => String(s || '').replace(/\[\[([^\]]+)\]\]/g, '$1');
  for (const n of Store.all('notes')) {
    const body = strip(n.body);
    // "**Term**: definition" or "Term: definition" lines
    body.split('\n').forEach(line => {
      // plain "Term: definition" only for short terms that are not everyday labels
      const STOP = /^(example|examples|next|note|notes|prompt|idea|todo|to do|question|questions|see|tip|why|decision|feedback|action|actions|q|a|re|update)$/i;
      let m = line.match(/^\s*[-*]?\s*\*\*(.{2,80}?)\*\*\s*[:—–-]\s*(.{8,})$/);
      if (!m) { const p = line.match(/^\s*[-*]?\s*([A-ZÀ-Ý][^:\n]{1,50}):\s+(.{12,})$/); if (p && p[1].trim().split(/\s+/).length <= 4 && !STOP.test(p[1].trim().split(/\s+/)[0]) && !/\[\[|\]\]/.test(p[1])) m = p; }
      if (m) add(`${t('defineQ')}: ${m[1].trim()}`, m[2], 'definition', { type: 'note', id: n.id });
      else (line.match(/\*\*([^*]{2,60})\*\*/g) || []).forEach(b => { const term = b.slice(2, -2); add(line.replace(b, '[…]').replace(/\*\*/g, '').replace(/^\s*[-*>]\s*/, ''), term, 'cloze', { type: 'note', id: n.id }); });
    });
    if (['note', 'idea'].includes(n.kind) && (n.title || '').trim() && body.length > 40) add(`${t('explainQ')}: ${n.title}`, body.slice(0, 700), 'note', { type: 'note', id: n.id }, n.kind === 'note');
  }
  for (const s of Store.all('sources').filter(s => s.passDone >= 1)) {
    const L = sourceLabel(s), ok = k => s[k] && !(s.aiDrafted || []).includes(k);
    if (s.findings) add(`${t('findingsQ')} ${L}?`, s.findings + ((s.aiDrafted || []).includes('findings') ? `\n\n(${t('aiDraft')})` : ''), 'source', { type: 'source', id: s.id }, ok('findings'));
    if (s.framework) add(`${t('frameworkQ')} ${L}?`, s.framework, 'source', { type: 'source', id: s.id }, ok('framework'));
    Object.entries(s.themes || {}).forEach(([tid, v]) => { const th = Store.get('themes', tid); if (th && v) add(`${t('themeQ', { s: L, t: th.name })}`, v, 'matrix', { type: 'source', id: s.id }); });
    (s.quotes || []).filter(q => q.text && q.page).forEach(q => add(`${t('quoteQ')} “${q.text.slice(0, 160)}”`, `${L}, p. ${q.page}`, 'quote', { type: 'source', id: s.id }, false));
  }
  for (const c of Store.all('claims').filter(c => (c.evidence || []).length)) add(`${t('evidenceQ')}: “${c.text}”`, c.evidence.map(e => `- ${Arg.cite(e)}${e.comment ? ': ' + e.comment : ''}`).join('\n'), 'claim', { type: 'claim', id: c.id }, false);
  return out;
}

function cardModal(c) {
  const v = c || { front: '', back: '', deck: decks()[0] || t('defaultDeck') };
  const m = modal({
    title: c ? t('edit') : t('newCard'), wide: true,
    body: `<label class="field"><span>${esc(t('front'))}</span><textarea id="cm-front" rows="3">${esc(v.front)}</textarea></label>
      <label class="field"><span>${esc(t('back'))}</span><textarea id="cm-back" rows="5">${esc(v.back)}</textarea></label>
      <label class="field"><span>${esc(t('deck'))}</span><input id="cm-deck" list="cm-decks" value="${esc(v.deck)}"><datalist id="cm-decks">${decks().map(d => `<option value="${esc(d)}">`).join('')}</datalist></label>
      ${c && c.ai ? `<label class="row small"><input type="checkbox" id="cm-ok"> ${esc(t('confirmCard'))}</label>` : ''}`,
    foot: `${c ? `<button class="btn danger" id="cm-del">${esc(t('delete'))}</button><span class="spacer"></span>` : ''}<button class="btn" id="cm-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="cm-save">${esc(t('save'))}</button>`,
  });
  const r = m.root, g = id => $('#' + id, r);
  g('cm-cancel').onclick = m.close;
  g('cm-save').onclick = () => {
    const data = { front: g('cm-front').value.trim(), back: g('cm-back').value.trim(), deck: g('cm-deck').value.trim() || t('defaultDeck') };
    if (!data.front || !data.back) return;
    if (c) { if (g('cm-ok') && g('cm-ok').checked) data.ai = false; Store.update('cards', c.id, data); } else Store.add('cards', newCard(data));
    CardState.queue = null; m.close(); App.render();
  };
  if (c) g('cm-del').onclick = () => { if (confirmBox(t('delete') + '?')) { Store.remove('cards', c.id); CardState.queue = null; m.close(); App.render(); } };
}

function aiCardsModal(deck) {
  const notes = Store.all('notes').filter(n => ['note', 'idea', 'decision'].includes(n.kind));
  const sources = Store.all('sources').filter(s => s.passDone >= 1 && (s.findings || s.framework));
  const m = modal({
    title: t('aiCards'), wide: true,
    body: `<p class="small" style="color:var(--ai)">${esc(t('aiCardsHelp'))}</p>
      <div class="grid g2"><div><h3 class="small muted">${esc(t('nav_journal'))}</h3>${notes.map(n => `<label class="row small"><input type="checkbox" data-n="${n.id}"> ${esc(Links.noteTitle(n))}</label>`).join('') || '—'}</div>
      <div><h3 class="small muted">${esc(t('nav_library'))}</h3>${sources.map(s => `<label class="row small"><input type="checkbox" data-s="${s.id}"> ${esc(sourceLabel(s))}</label>`).join('') || '—'}</div></div>
      <button class="btn ai" id="ac-copy">${esc(t('copyPrompt'))}</button>
      <label class="field"><span>${esc(t('aiStep3'))}</span><textarea id="ac-reply" class="prompt-box" rows="6" placeholder='[{"front": "…", "back": "…"}]'></textarea></label>`,
    foot: `<button class="btn" id="ac-cancel">${esc(t('cancel'))}</button><button class="btn primary" id="ac-add">${esc(t('addCards'))}</button>`,
  });
  const r = m.root;
  $('#ac-cancel', r).onclick = m.close;
  $('#ac-copy', r).onclick = () => {
    const parts = [...$$('[data-n]:checked', r).map(x => { const n = Store.get('notes', x.dataset.n); return `### Note: ${Links.noteTitle(n)}\n${n.body}${n.decision && n.decision.what ? `\nDecision: ${n.decision.what}. Why: ${n.decision.why}` : ''}`; }),
      ...$$('[data-s]:checked', r).map(x => { const s = Store.get('sources', x.dataset.s); return `### Source: ${Cite.apaText(s)}\nFramework: ${s.framework}\nMethod: ${s.method}\nFindings: ${s.findings}\nMy critique: ${s.strengths} ${s.limitations}`; })];
    if (!parts.length) { toast(t('pickSomething')); return; }
    copyText(`Create study flashcards for the comprehensive exam of ${thesisLine()} from ONLY the material below.
Rules: do not add facts, authors, dates or page numbers that are not in the material. One idea per card. Questions should test understanding (definitions, contrasts, "why", "how would you apply"), not trivia. Keep backs under 60 words. Canadian English spelling.
Reply with ONLY a JSON array: [{"front": "...", "back": "..."}]

${parts.join('\n\n')}`);
  };
  $('#ac-add', r).onclick = () => {
    const txt = $('#ac-reply', r).value; const a = txt.indexOf('['), b = txt.lastIndexOf(']');
    let arr; try { arr = JSON.parse(txt.slice(a, b + 1)); } catch { toast(t('aiParseError'), 3500); return; }
    const list = arr.filter(x => x && x.front && x.back);
    list.forEach(x => Store.data.cards.push(newCard({ front: String(x.front), back: String(x.back), deck, ai: true })));
    Store.change(); CardState.queue = null; toast(t('cardsAdded', { n: list.length })); m.close(); App.render();
  };
}
