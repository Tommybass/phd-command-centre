/* Copy-and-paste AI workflow: build prompts for Claude, read replies back safely */
/* The thesis title and design live in your data (Settings), not in the code, so the published app holds nothing personal */
function thesisLine() {
  const S = Store.data.settings, p = Store.all('projects').find(x => x.area === 'thesis');
  const title = (S.thesisTitle || (p ? p.title.replace(/^Thesis:\s*/i, '') : '')).trim(), design = (S.thesisDesign || '').trim();
  return `a doctoral thesis in Education${title ? ` titled "${title}"` : ''}${design ? ` (${design})` : ''}`;
}
const AI = {
  sourcePrompt(text) {
    return `You are helping a doctoral student in Education fill one record in a literature library.

Use ONLY the text between the triple quotes. Strict rules:
- Never invent or "complete" any reference detail, DOI, URL, author, year or page number. If it is not in the text, use "" (or [] for lists).
- Quotations must be copied word for word from the text. Do not paraphrase inside a quotation. Do not give page numbers.
- "strengths" and "limitations" are tentative points based only on what the text reports; keep each to one or two sentences.
- "paradigm" must be one of: ${PARADIGMS.map(p => `"${p}"`).join(', ')}, or "" if unclear.
- "type" must be one of: ${SOURCE_TYPES.map(p => `"${p}"`).join(', ')}.
- Use Canadian English spelling. Keep "findings" to 2–4 sentences.

Reply with ONLY one JSON object, no commentary, in exactly this shape:
{
  "type": "",
  "authors": [{"family": "", "given": ""}],
  "year": "",
  "title": "",
  "container": "",
  "volume": "",
  "issue": "",
  "pages": "",
  "doi": "",
  "url": "",
  "paradigm": "",
  "framework": "",
  "method": "",
  "context": "",
  "sample": "",
  "findings": "",
  "strengths": "",
  "limitations": "",
  "tags": [],
  "quotes": [{"text": ""}]
}

"""
${text.trim()}
"""`;
  },

  parseReply(reply) {
    const a = reply.indexOf('{'), b = reply.lastIndexOf('}');
    if (a === -1 || b <= a) throw new Error('no json');
    return JSON.parse(reply.slice(a, b + 1));
  },

  norm(s) { return String(s || '').toLowerCase().replace(/[“”«»"']/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim(); },

  /* Apply a parsed reply to a source; every non-empty field is recorded as AI-drafted */
  applyToSource(src, obj, pastedText) {
    const drafted = new Set(src.aiDrafted || []);
    const setIf = (k, v) => {
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) return;
      src[k] = v; drafted.add(k);
    };
    if (SOURCE_TYPES.includes(obj.type)) setIf('type', obj.type);
    if (Array.isArray(obj.authors)) setIf('authors', obj.authors.filter(a => a && (a.family || a.literal)).map(a => a.literal ? { literal: a.literal } : { family: String(a.family || '').trim(), given: String(a.given || '').trim() }));
    ['year', 'title', 'container', 'volume', 'issue', 'pages', 'doi', 'url', 'framework', 'method', 'context', 'sample', 'findings', 'strengths', 'limitations'].forEach(k => setIf(k, typeof obj[k] === 'string' ? obj[k].trim() : ''));
    if (PARADIGMS.includes(obj.paradigm)) setIf('paradigm', obj.paradigm);
    if (Array.isArray(obj.tags)) setIf('tags', uniq([...(src.tags || []), ...obj.tags.map(x => String(x).trim().toLowerCase()).filter(Boolean)]));
    // A DOI/URL the pasted text does not contain is treated as invented and dropped
    const hay = this.norm(pastedText);
    for (const k of ['doi', 'url']) if (src[k] && drafted.has(k) && !hay.includes(this.norm(Cite.doi(src[k])))) { src[k] = ''; drafted.delete(k); }
    if (Array.isArray(obj.quotes)) {
      const qs = obj.quotes.map(q => String((q && q.text) || q || '').trim()).filter(Boolean).map(text => ({
        text, page: '', note: '', ai: true, verified: hay.includes(this.norm(text).replace(/^"|"$/g, '')),
      }));
      if (qs.length) { src.quotes = [...(src.quotes || []), ...qs]; drafted.add('quotes'); }
    }
    if (!src.abstract) src.abstract = pastedText.trim();
    src.aiDrafted = Array.from(drafted);
    return src;
  },

  outlinePrompt(themes, sources) {
    const blocks = themes.map(th => {
      const rows = sources.filter(s => s.themes && s.themes[th.id]).map(s => `  - ${sourceLabel(s)}: ${s.themes[th.id].replace(/\s+/g, ' ')}`);
      return `### ${th.kind === 'rq' ? 'Research question' : 'Theme'}: ${th.name}\n${rows.length ? rows.join('\n') : '  - (no sources yet — a gap)'}`;
    }).join('\n\n');
    return `Act as a writing coach for ${thesisLine()}.

Below is my synthesis matrix: for each theme or research question, the sources I have read and my note on what each says.

Draft a literature review OUTLINE (headings, sub-headings and 1–2 sentence purpose for each), organized by argument rather than source by source. Rules:
- Use ONLY the sources listed below; cite them as (Author, Year). Do not add, suggest as fact or invent any other sources or details.
- Where my notes show agreement, tension or a gap, say so explicitly.
- End with a short list of gaps in my coverage and the kinds of sources (not specific titles) I should look for.
- Use Canadian English spelling.

${blocks}`;
  },

  connectionsPrompt(sources, themes) {
    const lines = sources.map(s => `- [${sourceLabel(s)}] framework: ${s.framework || '—'}; method: ${s.method || '—'}; tags: ${(s.tags || []).join(', ') || '—'}; findings: ${(s.findings || '—').replace(/\s+/g, ' ').slice(0, 400)}`);
    return `Here are summaries of the sources in my literature library for ${thesisLine()}. My themes are: ${themes.map(t => t.name).join('; ') || '(none yet)'}.

Using ONLY these summaries (do not add sources or facts):
1. Suggest pairs or clusters of sources that speak to each other (agree, conflict, or extend) and say why in one sentence each.
2. Identify gaps: themes, contexts, methods or populations my library does not cover.
3. Flag any summary that looks too thin to support a claim.
Use Canadian English spelling.

${lines.join('\n')}`;
  },
};
