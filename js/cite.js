/* APA 7 formatting, RIS / BibTeX / CSV export, Zotero (CSL-JSON, RIS) import */
const Cite = {
  /* "Kane, Michael T.; Mislevy, R. J.; American Educational Research Association" */
  parseNames(str) {
    return String(str || '').split(';').map(x => x.trim()).filter(Boolean).map(n => {
      const i = n.indexOf(',');
      if (i === -1) return { literal: n };
      return { family: n.slice(0, i).trim(), given: n.slice(i + 1).trim() };
    });
  },
  namesToString(list) {
    return (list || []).map(a => a.literal ? a.literal : [a.family, a.given].filter(Boolean).join(', ')).join('; ');
  },
  initials(given) {
    if (!given) return '';
    return given.split(/\s+/).filter(Boolean).map(part =>
      part.split('-').map(p => { const c = p.replace(/[^A-Za-zÀ-ÿ]/g, ''); return c ? c[0].toUpperCase() + '.' : ''; }).filter(Boolean).join('-')
    ).join(' ');
  },
  author(a) { return a.literal ? a.literal : `${a.family}${a.given ? ', ' + this.initials(a.given) : ''}`; },
  editorName(a) { return a.literal ? a.literal : `${a.given ? this.initials(a.given) + ' ' : ''}${a.family}`; },
  joinAPA(parts) {
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]}, & ${parts[1]}`;
    if (parts.length <= 20) return parts.slice(0, -1).join(', ') + ', & ' + parts[parts.length - 1];
    return parts.slice(0, 19).join(', ') + ', . . . ' + parts[parts.length - 1];
  },
  editorsAPA(eds) {
    const n = eds.map(e => this.editorName(e));
    const s = n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} & ${n[1]}` : n.slice(0, -1).join(', ') + ', & ' + n[n.length - 1];
    return `${s} (${eds.length > 1 ? 'Eds.' : 'Ed.'})`;
  },
  end(s) { s = String(s || '').trim(); return /[.?!]$/.test(s) ? s : s + '.'; },
  pages(p) { return String(p || '').trim().replace(/\s*[-‐‑–—]+\s*/g, '–'); },
  doi(d) { return String(d || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, ''); },
  link(s) { const d = this.doi(s.doi); return d ? `https://doi.org/${d}` : (s.url || ''); },
  ordinal(n) {
    if (!/^\d+$/.test(String(n))) return String(n);
    const v = Number(n), sfx = (v % 100 >= 11 && v % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
    return `${v}${sfx} ed.`;
  },
  dateParen(s) {
    const y = s.year || 'n.d.';
    if ((s.type === 'news' || s.type === 'webpage') && /^\d{4}-\d{2}(-\d{2})?$/.test(s.issued || '')) {
      const [yy, mm, dd] = s.issued.split('-').map(Number);
      const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mm - 1];
      return `(${yy}, ${month}${dd ? ' ' + dd : ''})`;
    }
    return `(${y})`;
  },

  /* Returns HTML (italics via <i>) */
  apa(s) {
    const E = esc, I = x => `<i>${E(x)}</i>`;
    let authors = (s.authors || []).length ? this.joinAPA(s.authors.map(a => E(this.author(a)))) : '';
    if (authors && !/[.]$/.test(authors)) authors += '.'; // group authors end with a full stop: "Association. (2014)."
    const date = this.dateParen(s);
    const link = this.link(s); const L = link ? ' ' + E(link) : '';
    const title = s.title || 'Untitled';
    const ed = s.edition ? this.ordinal(s.edition) : '';
    // APA 7: omit the publisher when it is the same as the (group) author
    const pubSame = (s.authors || []).some(a => a.literal && a.literal.trim().toLowerCase() === String(s.publisher || '').trim().toLowerCase());
    const PUB = s.publisher && !pubSame ? E(this.end(s.publisher)) : '';
    // When there is no author, the title moves to the author position
    const lead = (titleHtml) => authors ? `${authors} ${date}. ${titleHtml}` : `${titleHtml} ${date}.`;
    let out;
    switch (s.type) {
      case 'article': {
        let src = s.container ? I(s.container) : '';
        if (s.volume) src += `, ${I(s.volume)}`;
        if (s.issue) src += `(${E(s.issue)})`;
        if (s.pages) { const p = this.pages(s.pages); src += /–/.test(p) || p.length < 5 ? `, ${E(p)}` : `, Article ${E(p)}`; }
        out = `${lead(E(this.end(title)))} ${src ? src + '.' : ''}${L}`;
        break;
      }
      case 'book': {
        const t2 = I(title) + (ed ? ` (${E(ed)})` : '');
        out = `${lead(this.end(t2))} ${PUB}${L}`;
        break;
      }
      case 'chapter': {
        const eds = (s.editors || []).length ? this.editorsAPA(s.editors) + ', ' : '';
        const paren = [ed, s.pages ? 'pp. ' + this.pages(s.pages) : ''].filter(Boolean).join(', ');
        out = `${lead(E(this.end(title)))} In ${E(eds)}${I(s.container || '')}${paren ? ` (${E(paren)})` : ''}. ${s.publisher ? E(this.end(s.publisher)) : ''}${L}`;
        break;
      }
      case 'news': case 'webpage': {
        const t2 = s.type === 'news' ? E(this.end(title)) : I(this.end(title));
        const cont = s.container ? (s.type === 'news' ? I(s.container) + '.' : E(this.end(s.container))) : '';
        out = `${lead(t2)} ${cont}${L}`;
        break;
      }
      case 'thesis': {
        out = `${lead(I(title) + ` [Doctoral dissertation${s.publisher ? ', ' + E(s.publisher) : ''}].`)} ${s.container ? E(this.end(s.container)) : ''}${L}`;
        break;
      }
      default: { // report, policy, other
        const num = s.issue ? ` (${E(s.issue)})` : '';
        out = `${lead(this.end(I(title) + num))} ${PUB}${L}`;
      }
    }
    return out.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
  },
  apaText(s) { return this.apa(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); },
  sortKey(s) { const a = s.authors && s.authors[0]; return ((a ? (a.family || a.literal) : s.title) || '').toLowerCase() + ' ' + (s.year || '9999'); },
  apaList(sources) {
    const sorted = [...sources].sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
    const html = `<html><head><meta charset="utf-8"><title>References</title><style>body{font-family:"Times New Roman",serif;font-size:12pt;line-height:2}p{padding-left:.5in;text-indent:-.5in;margin:0}h1{text-align:center;font-size:12pt}</style></head><body><h1>References</h1>${sorted.map(s => `<p>${this.apa(s)}</p>`).join('\n')}</body></html>`;
    const text = sorted.map(s => this.apaText(s)).join('\n\n');
    return { html, text };
  },

  /* ---------- RIS ---------- */
  risType: { article: 'JOUR', book: 'BOOK', chapter: 'CHAP', report: 'RPRT', policy: 'GOVDOC', news: 'NEWS', thesis: 'THES', webpage: 'ELEC', other: 'GEN' },
  ris(sources) {
    return sources.map(s => {
      const L = []; const add = (k, v) => { if (v) L.push(`${k}  - ${v}`); };
      add('TY', this.risType[s.type] || 'GEN');
      (s.authors || []).forEach(a => add('AU', a.literal || [a.family, a.given].filter(Boolean).join(', ')));
      (s.editors || []).forEach(a => add('A2', a.literal || [a.family, a.given].filter(Boolean).join(', ')));
      add('TI', s.title); add('T2', s.container); add('PY', s.year); add('DA', s.issued);
      add('VL', s.volume); add('IS', s.issue); add('ET', s.edition);
      const p = this.pages(s.pages).split('–'); add('SP', p[0]); add('EP', p[1]);
      add('PB', s.publisher); add('DO', this.doi(s.doi)); add('UR', s.url); add('AB', s.abstract);
      (s.tags || []).forEach(k => add('KW', k));
      L.push('ER  - ');
      return L.join('\r\n');
    }).join('\r\n\r\n');
  },

  /* ---------- BibTeX ---------- */
  bibEsc(v) { return String(v).replace(/([&%$#_])/g, '\\$1'); },
  bibKey(s, used) {
    const a = s.authors && s.authors[0];
    const fam = ((a && (a.family || a.literal)) || 'anon').normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 20);
    const w = (s.title || '').normalize('NFD').replace(/[^A-Za-z\s]/g, '').split(/\s+/).find(x => x.length > 3) || 'x';
    let k = `${fam}${s.year || 'nd'}${w.toLowerCase()}`, i = 1, base = k;
    while (used.has(k)) k = base + String.fromCharCode(97 + i++);
    used.add(k); return k;
  },
  bibtex(sources) {
    const used = new Set();
    const typeMap = { article: 'article', book: 'book', chapter: 'incollection', report: 'techreport', policy: 'techreport', news: 'misc', thesis: 'phdthesis', webpage: 'misc', other: 'misc' };
    const names = l => (l || []).map(a => a.literal ? `{${a.literal}}` : `${a.family}${a.given ? ', ' + a.given : ''}`).join(' and ');
    return sources.map(s => {
      const f = [];
      const add = (k, v) => { if (v) f.push(`  ${k} = {${this.bibEsc(v)}}`); };
      if (s.authors && s.authors.length) f.push(`  author = {${names(s.authors)}}`);
      if (s.editors && s.editors.length) f.push(`  editor = {${names(s.editors)}}`);
      add('title', s.title); add('year', s.year);
      if (s.type === 'article') add('journal', s.container);
      else if (s.type === 'chapter') add('booktitle', s.container);
      else if (s.type === 'news' || s.type === 'webpage') add('howpublished', s.container);
      add('volume', s.volume); add('number', s.issue); add('pages', this.pages(s.pages).replace('–', '--')); add('edition', s.edition);
      if (s.type === 'thesis') add('school', s.publisher);
      else if (s.type === 'report' || s.type === 'policy') add('institution', s.publisher);
      else add('publisher', s.publisher);
      add('doi', this.doi(s.doi)); add('url', s.url); add('keywords', (s.tags || []).join(', ')); add('abstract', s.abstract);
      return `@${typeMap[s.type] || 'misc'}{${this.bibKey(s, used)},\n${f.join(',\n')}\n}`;
    }).join('\n\n');
  },

  /* ---------- CSV ---------- */
  csv(sources) {
    const cols = ['apa', 'type', 'authors', 'year', 'title', 'container', 'volume', 'issue', 'pages', 'publisher', 'doi', 'url', 'priority', 'status', 'dateRead', 'projects', 'chapters', 'researchQuestions',
      'paradigm', 'framework', 'method', 'context', 'sample', 'findings', 'quotes', 'strengths', 'limitations', 'use', 'tags', 'related', 'aiDraftedUnconfirmed'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = sources.map(s => [
      this.apaText(s), s.type, this.namesToString(s.authors), s.year, s.title, s.container, s.volume, s.issue, s.pages, s.publisher, this.doi(s.doi), s.url,
      s.priority, sourceStatus(s), s.dateRead, (s.projects || []).map(projectName).join('; '), (s.chapters || []).join('; '), (s.researchQuestions || []).join('; '),
      s.paradigm, s.framework, s.method, s.context, s.sample, s.findings,
      (s.quotes || []).map(x => `"${x.text}" (p. ${x.page || '?'})`).join(' | '), s.strengths, s.limitations, s.use, (s.tags || []).join('; '),
      (s.related || []).map(id => { const r = Store.get('sources', id); return r ? sourceLabel(r) : ''; }).join('; '), (s.aiDrafted || []).join('; ')
    ].map(q).join(','));
    return '﻿' + cols.join(',') + '\r\n' + rows.join('\r\n');
  },

  /* ---------- Import ---------- */
  cslType: { 'article-journal': 'article', 'article-magazine': 'news', 'article-newspaper': 'news', book: 'book', chapter: 'chapter', report: 'report', thesis: 'thesis', webpage: 'webpage', 'post-weblog': 'webpage', legislation: 'policy', bill: 'policy', legal_case: 'policy' },
  fromCSL(items) {
    return items.map(it => {
      const dp = it.issued && it.issued['date-parts'] && it.issued['date-parts'][0];
      const name = a => a.literal ? { literal: a.literal } : { family: a.family || '', given: a.given || '' };
      return newSource({
        type: this.cslType[it.type] || 'other',
        authors: (it.author || []).map(name), editors: (it.editor || []).map(name),
        year: dp && dp[0] ? String(dp[0]) : '', issued: dp && dp[1] ? [dp[0], String(dp[1]).padStart(2, '0'), dp[2] ? String(dp[2]).padStart(2, '0') : null].filter(Boolean).join('-') : '',
        title: it.title || '', container: it['container-title'] || it['collection-title'] || '', volume: it.volume || '', issue: it.issue || it.number || '',
        pages: it.page || '', edition: it.edition || '', publisher: it.publisher || '', doi: it.DOI || '', url: it.URL || '', abstract: it.abstract || '',
        zoteroKey: String(it.id || '').split('/').pop(), tags: [],
      });
    });
  },
  fromRIS(text) {
    const out = []; let cur = null;
    const tmap = { JOUR: 'article', JFULL: 'article', MGZN: 'news', NEWS: 'news', BOOK: 'book', CHAP: 'chapter', RPRT: 'report', GOVDOC: 'policy', BILL: 'policy', STAT: 'policy', THES: 'thesis', ELEC: 'webpage', WEB: 'webpage' };
    for (const raw of text.split(/\r?\n/)) {
      const m = raw.match(/^([A-Z][A-Z0-9])  -\s?(.*)$/); if (!m) continue;
      const [, k, v] = m;
      if (k === 'TY') { cur = { type: tmap[v.trim()] || 'other', authors: [], editors: [], tags: [] }; continue; }
      if (!cur) continue;
      if (k === 'ER') { out.push(newSource(cur)); cur = null; continue; }
      const name = n => { const i = n.indexOf(','); return i === -1 ? { literal: n.trim() } : { family: n.slice(0, i).trim(), given: n.slice(i + 1).trim() }; };
      switch (k) {
        case 'AU': case 'A1': cur.authors.push(name(v)); break;
        case 'A2': case 'ED': cur.editors.push(name(v)); break;
        case 'TI': case 'T1': cur.title = v; break;
        case 'T2': case 'JO': case 'JF': case 'BT': if (!cur.container) cur.container = v; break;
        case 'PY': case 'Y1': cur.year = (v.match(/\d{4}/) || [''])[0]; break;
        case 'DA': cur.issued = v.replace(/\//g, '-').replace(/-+$/, ''); if (!cur.year) cur.year = (v.match(/\d{4}/) || [''])[0]; break;
        case 'VL': cur.volume = v; break; case 'IS': cur.issue = v; break; case 'ET': cur.edition = v; break;
        case 'SP': cur.pages = v; break; case 'EP': cur.pages = (cur.pages || '') + '–' + v; break;
        case 'PB': cur.publisher = v; break; case 'DO': cur.doi = v; break; case 'UR': if (!cur.url) cur.url = v; break;
        case 'AB': cur.abstract = v; break; case 'KW': cur.tags.push(v); break;
      }
    }
    return out;
  },
  /* Adds imported sources, skipping duplicates by DOI or title+year */
  addImported(list) {
    const key = s => this.doi(s.doi).toLowerCase() || (s.title.toLowerCase().replace(/\W/g, '') + s.year);
    const have = new Set(Store.all('sources').map(key));
    let n = 0, d = 0;
    for (const s of list) { const k = key(s); if (have.has(k)) { d++; continue; } have.add(k); Store.data.sources.push(s); n++; }
    Store.change();
    return { n, d };
  },
};
