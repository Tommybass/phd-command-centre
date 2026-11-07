/* Small UI helpers shared by every view */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function uid(prefix = '') {
  const r = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2))).replace(/-/g, '').slice(0, 12);
  return prefix + r;
}
function localISO(d = new Date()) {
  const z = d.getTimezoneOffset() * 60000;
  return new Date(d - z).toISOString().slice(0, 10);
}
const todayISO = () => localISO();
function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function daysUntil(iso) { return Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return localISO(d); }
function startOfWeek(iso = todayISO()) { const d = parseISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return localISO(d); }
function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  try { return parseISO(iso).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', opts); } catch { return iso; }
}
function fmtTime(d) { return d.toLocaleTimeString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { hour: '2-digit', minute: '2-digit' }); }
function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }
const splitList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const uniq = a => Array.from(new Set(a));

function toast(msg, ms = 2200) {
  const n = document.createElement('div');
  n.className = 'toast'; n.textContent = msg;
  $('#toast-root').appendChild(n);
  setTimeout(() => n.remove(), ms);
}

function download(filename, text, type = 'text/plain') {
  const blob = text instanceof Blob ? text : new Blob([text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function copyText(text, html) {
  try {
    if (html && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast(t('copied'));
}

function pickFile(accept) {
  return new Promise(resolve => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}

/* Modal: returns { root, close }. body is an HTML string. */
let modalStack = [];
function modal({ title, body, foot = '', wide = false, onClose }) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><span class="spacer"></span><button class="btn ghost icon" data-close aria-label="${esc(t('close'))}">✕</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
  </div>`;
  const prevFocus = document.activeElement;
  const close = () => {
    back.remove(); modalStack = modalStack.filter(m => m !== api);
    if (onClose) onClose();
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
  const api = { root: back, close };
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  back.querySelector('[data-close]').onclick = close;
  $('#modal-root').appendChild(back);
  modalStack.push(api);
  const first = back.querySelector('[autofocus], .modal-body input, .modal-body textarea, .modal-body select');
  if (first) { first.focus(); setTimeout(() => { if (!back.contains(document.activeElement)) first.focus(); }, 30); }
  return api;
}
function closeTopModal() { const m = modalStack[modalStack.length - 1]; if (m) { m.close(); return true; } return false; }

function confirmBox(message) { return window.confirm(message); }

function options(list, selected, labelFn = x => x) {
  return list.map(v => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(labelFn(v))}</option>`).join('');
}
