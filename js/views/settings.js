/* Settings, storage, backup, import/export */
const SettingsView = {
  render() {
    const st = Store.data.settings;
    let storage;
    if (Store.dirState === 'granted') storage = `<p>✓ ${esc(t('storageConnected', { name: Store.dir.name }))}</p>
      <div class="row"><button class="btn primary" data-action="save-now">${esc(t('saveNow'))}</button><button class="btn" data-action="connect">${esc(t('connectFolder'))}…</button><button class="btn ghost danger" data-action="disconnect">${esc(t('disconnect'))}</button></div>`;
    else if (Store.dirState === 'prompt') storage = `<p>${esc(t('storageReconnect'))}</p><div class="row"><button class="btn primary" data-action="reconnect">${esc(t('reconnect'))}</button><button class="btn ghost danger" data-action="disconnect">${esc(t('disconnect'))}</button></div>`;
    else if (Store.dirState === 'unsupported') storage = `<p>${esc(t('phoneStorage'))}</p><button class="btn primary" data-action="open-sync">⇅ ${esc(t('phoneSync'))}</button>`;
    else storage = `<p>${esc(t('storageBrowser'))}</p><button class="btn primary" data-action="connect">${esc(t('connectFolder'))}</button>`;
    if (Store.dirState === 'granted') {
      const M = Sync.meta;
      storage += `<h3 class="small muted" style="margin-top:14px">📱 ${esc(t('phoneInbox'))}</h3><p class="small muted">${esc(t('phoneInboxHelp', { name: Store.dir.name }))}</p>
        <p class="small">${esc(M.lastImport ? t('inboxLast', { t: fmtDate(M.lastImport.slice(0, 10)) + ' ' + fmtTime(new Date(M.lastImport)), n: M.lastCount }) : t('inboxNever'))}</p>
        <button class="btn small" data-action="check-inbox">${esc(t('checkInbox'))}</button>`;
    }

    const keys = [['Ctrl K', t('search')], ['Q', t('quickAdd')], ['T', t('qa_task')], ['S', t('qa_source')], ['N', t('qa_note')], ['G D', t('nav_dashboard')], ['G L', t('nav_library')], ['G M', t('matrix')], ['G P', t('nav_projects')], ['G S', t('nav_settings')], ['Esc', t('close')]];
    const counts = COLLECTIONS.map(c => `${c}: ${Store.all(c).length}`).join(' · ');
    return `<div class="page-head"><h1>${esc(t('settings'))}</h1></div>
      <div class="dash">
        <div class="card c6"><h2>${esc(t('language'))} & ${esc(t('theme'))}</h2><div class="grid g2">
          <label class="field"><span>${esc(t('language'))}</span><select data-setting="lang">${options(['en', 'fr'], st.lang, v => v === 'en' ? 'English' : 'Français')}</select></label>
          <label class="field"><span>${esc(t('theme'))}</span><select data-setting="theme">${options(['auto', 'light', 'dark'], st.theme, v => t('theme_' + v))}</select></label>
          <label class="field"><span>${esc(t('readingTarget'))}</span><input type="number" min="1" max="50" data-setting="readingTarget" value="${esc(st.readingTarget)}"></label>
          <label class="field"><span>${esc(t('reviewDay'))}</span><select data-setting="reviewDay">${options([1, 2, 3, 4, 5, 6, 0], st.reviewDay, v => new Date(2024, 0, 7 + Number(v)).toLocaleDateString(LANG === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long' }))}</select></label>
          <label class="field span-all"><span>${esc(t('thesisTitleL'))}</span><input data-setting="thesisTitle" value="${esc(st.thesisTitle)}"></label>
          <label class="field span-all"><span>${esc(t('thesisDesignL'))}</span><input data-setting="thesisDesign" value="${esc(st.thesisDesign)}" placeholder="${esc(t('thesisDesignHint'))}"></label>
          <p class="small faint span-all">${esc(t('thesisHelp'))}</p>
        </div></div>
        <div class="card c6"><h2>${esc(t('storage'))}</h2>${storage}<p class="small faint" style="margin-top:10px">${esc(counts)}</p></div>
        <div class="card c6"><h2>${esc(t('backupImport'))}</h2><div class="grid">
          <button class="btn" data-action="export-json">⇩ ${esc(t('exportJSON'))}</button>
          <button class="btn" data-action="import-json">⇧ ${esc(t('importJSON'))}</button>
          <button class="btn" data-action="import-zotero">⇧ ${esc(t('importZotero'))}</button>
          <p class="small muted">${esc(t('zoteroHelp'))}</p>
          <div class="row"><span class="small muted">${esc(t('export'))} (${esc(t('all'))}):</span>
            <button class="btn small" data-action="exp-apa">${esc(t('exportAPA'))}</button><button class="btn small" data-action="exp-csv">CSV</button>
            <button class="btn small" data-action="exp-ris">RIS</button><button class="btn small" data-action="exp-bib">BibTeX</button></div>
        </div></div>
        <div class="card c6"><h2>${esc(t('sampleData'))}</h2>
          <div class="row"><button class="btn" data-action="load-sample">${esc(t('loadSample'))}</button>${Store.hasSample() ? `<button class="btn" data-action="remove-sample">${esc(t('removeSample'))}</button>` : ''}</div>
          <h2 style="margin-top:20px">${esc(t('shortcuts'))}</h2>
          <table><tbody>${keys.map(([k, v]) => `<tr><td style="width:90px"><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="card c12" style="border-color:var(--danger-soft)"><h2>${esc(t('danger'))}</h2><button class="btn danger" data-action="reset">${esc(t('resetAll'))}</button></div>
      </div>`;
  },
  bind(root) {
    root.addEventListener('change', e => {
      const k = e.target.dataset.setting; if (!k) return;
      let v = e.target.value; if (k === 'readingTarget' || k === 'reviewDay') v = Number(v);
      Store.data.settings[k] = v; Store.change();
      if (k === 'lang') setLang(v);
      if (k === 'theme') applyTheme();
      App.renderNav(); App.render();
    });
    root.addEventListener('click', async e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      const act = a.dataset.action, all = Store.all('sources');
      if (act === 'connect') await connectFolderFlow();
      else if (act === 'reconnect') { await Store.reconnect(); App.render(); }
      else if (act === 'disconnect') { await Store.disconnect(); App.render(); }
      else if (act === 'save-now') { await Store.writeFile(); toast(t('saved')); }
      else if (act === 'check-inbox') { await Sync.checkInbox(true); App.render(); }
      else if (act === 'export-json') Store.safetyDownload('backup');
      else if (act === 'import-json') {
        const f = await pickFile('.json'); if (!f) return;
        let d; try { d = JSON.parse(await f.text()); } catch { toast('Invalid JSON'); return; }
        if (confirmBox(t('importReplace'))) { Store.safetyDownload('before-restore'); Store.replaceAll(d); toast(t('saved')); }
        else if (confirmBox(t('importMerge'))) { const n = Store.mergeIn(d); toast(`+${n}`); }
        App.render();
      }
      else if (act === 'import-zotero') importZotero();
      else if (act === 'exp-apa') { const { html, text } = Cite.apaList(all); copyText(text, html); download(`references-apa-${todayISO()}.html`, html, 'text/html'); }
      else if (act === 'exp-csv') download(`sources-${todayISO()}.csv`, Cite.csv(all), 'text/csv');
      else if (act === 'exp-ris') download(`sources-${todayISO()}.ris`, Cite.ris(all), 'application/x-research-info-systems');
      else if (act === 'exp-bib') download(`sources-${todayISO()}.bib`, Cite.bibtex(all), 'application/x-bibtex');
      else if (act === 'load-sample') loadSample();
      else if (act === 'remove-sample') { Store.removeSample(); toast(t('sampleRemoved')); App.render(); }
      else if (act === 'reset') { if (confirmBox(t('resetConfirm'))) { Store.safetyDownload('before-erase'); const s = Store.data.settings; Store.replaceAll(Object.assign(emptyData(), { settings: s })); App.render(); } }
    });
  },
};
