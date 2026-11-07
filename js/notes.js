/* Linked notes: [[wikilinks]], backlinks, light Markdown rendering, link autocomplete */
const Links = {
  noteTitle(n) { return (n.title || '').trim() || (n.body || '').split('\n')[0].replace(/^#+\s*/, '').slice(0, 70) || '(untitled)'; },

  targets() {
    return [
      ...Store.all('notes').filter(n => (n.title || '').trim()).map(n => ({ type: 'note', id: n.id, label: n.title.trim(), sub: t('nk_' + n.kind) })),
      ...Store.all('sources').map(s => ({ type: 'source', id: s.id, label: sourceLabel(s), sub: s.title })),
      ...Store.all('projects').map(p => ({ type: 'project', id: p.id, label: p.title, sub: t('nav_projects') })),
    ];
  },
  resolve(label) {
    const l = label.trim().toLowerCase();
    const n = Store.all('notes').find(x => (x.title || '').trim().toLowerCase() === l);
    if (n) return { type: 'note', id: n.id };
    const s = Store.all('sources').find(x => sourceLabel(x).toLowerCase() === l || (x.title || '').toLowerCase() === l);
    if (s) return { type: 'source', id: s.id };
    const p = Store.all('projects').find(x => x.title.toLowerCase() === l);
    if (p) return { type: 'project', id: p.id };
    return null;
  },
  extract(text) {
    const out = [];
    for (const m of String(text || '').matchAll(/\[\[([^\]\n]+)\]\]/g)) {
      const r = this.resolve(m[1]);
      if (r && !out.some(o => o.id === r.id)) out.push(r);
    }
    return out;
  },
  /* Recompute a note's outgoing links from all its text fields */
  refresh(n) {
    const text = [n.title, n.body, n.decision && n.decision.what, n.decision && n.decision.why, n.decision && n.decision.alternatives, n.feedback && n.feedback.response].join('\n');
    n.links = this.extract(text);
  },
  href(r) { return r.type === 'note' ? '#/journal/' + r.id : r.type === 'source' ? '#/source/' + r.id : r.type === 'project' ? '#/projects' : r.type === 'claim' ? '#/argument/' + r.id : '#/'; },
  label(r) {
    const o = Store.get(r.type === 'note' ? 'notes' : r.type === 'source' ? 'sources' : r.type === 'claim' ? 'claims' : 'projects', r.id);
    if (!o) return '?';
    return r.type === 'note' ? this.noteTitle(o) : r.type === 'source' ? sourceLabel(o) : r.type === 'claim' ? o.text : o.title;
  },
  backlinks(id) { return Store.all('notes').filter(n => n.id !== id && (n.links || []).some(l => l.id === id)); },

  /* Escaped, small Markdown subset: # headings, **bold**, *italic*, - lists, > quotes, [[links]] */
  render(text) {
    const inline = s => esc(s)
      .replace(/\[\[([^\]\n]+)\]\]/g, (m, lbl) => {
        const raw = lbl.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const r = this.resolve(raw);
        return r ? `<a class="wikilink" href="${this.href(r)}">${lbl}</a>` : `<a class="wikilink missing" href="#" data-new-note="${lbl}" title="${esc(t('createNote'))}">${lbl}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    const lines = String(text || '').split('\n'); let html = '', list = false;
    for (const ln of lines) {
      const li = ln.match(/^\s*[-*]\s+(.*)$/);
      if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
      if (list) { html += '</ul>'; list = false; }
      const h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h) html += `<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`;
      else if (/^>\s?/.test(ln)) html += `<blockquote>${inline(ln.replace(/^>\s?/, ''))}</blockquote>`;
      else if (ln.trim()) html += `<p>${inline(ln)}</p>`;
    }
    if (list) html += '</ul>';
    return html;
  },

  /* Typing [[ in a textarea or input opens a suggestion list */
  autocomplete(el) {
    let box = null, items = [], sel = 0, start = -1;
    const close = () => { if (box) box.remove(); box = null; start = -1; };
    const pick = i => {
      const it = items[i]; if (!it) return;
      const v = el.value, caret = el.selectionStart;
      el.value = v.slice(0, start) + '[[' + it.label + ']]' + v.slice(caret).replace(/^\]\]/, '');
      const pos = start + it.label.length + 4; el.setSelectionRange(pos, pos);
      close(); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
    };
    const draw = () => {
      if (!box) { box = document.createElement('div'); box.className = 'ac-box'; el.parentNode.insertBefore(box, el.nextSibling); }
      box.innerHTML = items.map((it, i) => `<button type="button" class="${i === sel ? 'sel' : ''}" data-i="${i}"><span class="pill">${esc(t('lt_' + it.type))}</span> ${esc(it.label)} <span class="faint small">${esc((it.sub || '').slice(0, 50))}</span></button>`).join('')
        || `<div class="faint small" style="padding:6px 10px">${esc(t('acNew'))}</div>`;
      box.onmousedown = e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); pick(Number(b.dataset.i)); } };
    };
    el.addEventListener('input', () => {
      const before = el.value.slice(0, el.selectionStart);
      const i = before.lastIndexOf('[['), j = before.lastIndexOf(']]');
      if (i === -1 || j > i || /\n/.test(before.slice(i))) { close(); return; }
      start = i; const q = before.slice(i + 2).toLowerCase();
      items = this.targets().filter(x => (x.label + ' ' + (x.sub || '')).toLowerCase().includes(q)).slice(0, 8); sel = 0; draw();
    });
    el.addEventListener('keydown', e => {
      if (!box) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; draw(); } }
      else if ((e.key === 'Enter' || e.key === 'Tab') && items.length) { e.preventDefault(); e.stopPropagation(); pick(sel); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    el.addEventListener('blur', () => setTimeout(close, 150));
  },
};
