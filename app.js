/* MIT · Copyright (c) 2026 Yousef Khames · dawr UI */
(function () {
  'use strict';
  const { el, t } = Kit, Q = DawrCore;
  const cfg = Object.assign({ shopId: 'demo', demo: true, services: [] }, window.DAWR_CONFIG);
  const store = Kit.store('dawr', 1, { q: null, demo: null });
  if (!store.data.q) {
    store.data.q = Q.newState(); store.data.demo = !!cfg.demo;
    cfg.services.forEach((s) => Q.addService(store.data.q, s.id, { ar: s.ar, en: s.en })); store.save();
  }
  const app = document.getElementById('app');
  let slip = null, pasted = '';
  const route = () => location.hash.replace(/^#\/?/, '');
  const Q_ = () => store.data.q;
  const hhmm = (ms) => new Date(ms).toLocaleTimeString(Kit.lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const sname = (s) => s.name[Kit.lang] || s.name.ar;
  const mins = (m) => (Math.round(m * 10) / 10).toLocaleString(Kit.lang === 'ar' ? 'ar-EG' : 'en-GB');
  const baseUrl = () => location.href.split('#')[0];
  const linkFor = (tk) => baseUrl() + '#/t/' + Q.encode(Q.snapshot(Q_(), tk, cfg.shopId, Kit.now()));
  const field = (label, input) => el('label', { class: 'field' }, el('span', { text: label }), input);
  const save = () => { store.save(); render(); };

  function header(r) {
    const tab = (id, label) => el('a', { class: 'tab' + (r === id ? ' on' : ''), href: '#/' + id, 'aria-current': r === id ? 'page' : null }, label);
    return el('header', { class: 'top noprint' }, el('div', { class: 'brand' }, el('img', { src: 'assets/favicon.svg', width: 28, height: 28, alt: '' }), el('strong', { text: Kit.shopName(t('title')) })),
      r === 'customer' ? null : el('nav', { class: 'tabs', 'aria-label': 'Main' }, tab('reception', t('reception')), tab('display', t('display'))), el('button', { class: 'btn small', onclick: () => { Kit.setLang(Kit.lang === 'ar' ? 'en' : 'ar', 'dawr'); render(); } }, t('lang')));
  }

  /* ---------- reception ---------- */
  function slipCard(tk) {
    const url = linkFor(tk), box = el('div', { class: 'qrbox' }); box.innerHTML = Kit.qrSvg(url); const s = Q.svc(Q_(), tk.s);
    return el('section', { class: 'slip', id: 'slip' }, el('h2', { text: Kit.shopName(t('title')) }), el('p', { text: s ? sname(s) : '' }), el('div', { class: 'bignum', id: 'slip-num', text: String(tk.n) }), box,
      el('p', { text: t('issuedAt', { t: hhmm(tk.at) }) }), el('p', { class: 'small', text: t('slipHint') }), tk.demo ? el('p', { class: 'badge demo', text: t('demoTag') }) : null,
      el('input', { id: 'link', class: 'noprint', readonly: true, value: url, dir: 'ltr', 'aria-label': 'link' }),
      el('div', { class: 'row noprint' }, el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(url); Kit.toast(t('copied')); } catch (e) { document.getElementById('link').select(); } } }, t('copyLink')), el('button', { class: 'btn', id: 'print', onclick: () => { document.body.classList.add('ps'); window.print(); } }, t('print')), waBtn(tk, url)));
  }
  function waBtn(tk, url) {
    const s = Q.svc(Q_(), tk.s), a = Q.ahead(Q_(), tk.s, tk.n);
    return el('button', { class: 'btn', onclick: () => { const w = Kit.waLink(tk.phone, t('waText', { shop: Kit.shopName(t('title')), n: tk.n, a, url })); if (!w.ok) return Kit.toast(t('waNoPhone')); window.open(w.url, '_blank', 'noopener'); } }, t('wa'));
  }
  function servicePanel(s) {
    const st = Q_(), cur = Q.serving(st, s.id), wl = Q.waiting(st, s.id), sk = Q.skipped(st, s.id), sv = Q.stats(st, s.id);
    const label = el('input', { id: 'lbl-' + s.id, maxlength: 30, placeholder: t('labelPh'), 'aria-label': t('labelPh') }), ph = el('input', { id: 'ph-' + s.id, type: 'tel', inputmode: 'tel', dir: 'ltr', placeholder: t('phonePh'), 'aria-label': t('phonePh') });
    const act = (kind) => () => { Q.resolve(st, cur.id, kind, Kit.now()); save(); };
    const stat = (v, key, n) => v == null ? t('notEnough', { n: Q.MIN_SAMPLES }) : t(key, { m: mins(v) });
    const lines = (x) => el('div', { class: 'row line', 'data-n': x.n }, el('strong', { text: '#' + x.n }), el('span', { class: 'grow', text: [x.label, hhmm(x.at)].filter(Boolean).join(' · ') }), x.demo ? el('span', { class: 'badge demo', text: t('demoTag') }) : null);
    return el('section', { class: 'card svc', 'data-svc': s.id },
      el('h2', { text: sname(s) }), el('div', { class: 'now' }, el('span', { text: t('nowServing') + ': ' }), el('strong', { class: 'bignum small', id: 'now-' + s.id, text: cur ? String(cur.n) : '—' })),
      el('p', { text: t('waitingN', { n: wl.length }) + (wl[0] ? ' · ' + t('nextUp') + ' #' + wl[0].n : '') }),
      cur ? el('div', { class: 'row' }, el('button', { class: 'btn primary', id: 'done-' + s.id, onclick: act('done') }, t('done')), el('button', { class: 'btn', id: 'noshow-' + s.id, onclick: act('noshow') }, t('noshow')), el('button', { class: 'btn', id: 'skipc-' + s.id, onclick: act('skip') }, t('skip'))) : null,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', id: 'call-' + s.id, disabled: !!cur || !wl.length, onclick: () => { Q.callNext(st, s.id, Kit.now()); save(); } }, t('callNext'))),
      el('div', { class: 'row' }, label, ph, el('button', { class: 'btn', id: 'issue-' + s.id, onclick: () => { const r = Q.issue(st, s.id, Kit.now(), { label: label.value, phone: ph.value }, store.data.demo); slip = r.ticket.id; save(); } }, t('issue'))),
      el('p', { class: 'small', text: t('noMedical') }),
      el('h3', { text: t('waitList') }), wl.length ? wl.map((x) => el('div', { class: 'row line' }, lines(x), el('button', { class: 'btn small', onclick: () => { slip = x.id; render(); } }, t('print')), el('button', { class: 'btn small', onclick: () => { Q.resolve(st, x.id, 'skip', Kit.now()); save(); } }, t('skip')))) : el('p', { text: t('noWaiting') }),
      sk.length ? [el('h3', { text: t('skippedList') }), sk.map((x) => el('div', { class: 'row line' }, lines(x), el('button', { class: 'btn small', onclick: () => { Q.resolve(st, x.id, 'recall', Kit.now()); save(); } }, t('recall'))))] : null,
      el('h3', { text: t('statsH') }), el('p', { class: 'small', id: 'stats-' + s.id }, stat(sv.waitAvg, 'avgWait'), el('br'), stat(sv.serviceAvg, 'avgServe'), el('br'), t('countsLine', { i: sv.issued, d: sv.done, x: sv.noshow, s: sv.skipped })));
  }
  function viewReception() {
    const root = el('main', { id: 'main-content', tabindex: '-1' }), st = Q_();
    if (store.blocked) root.append(el('div', { class: 'banner', role: 'alert', text: t('blocked') }), el('button', { class: 'btn danger', onclick: () => { if (confirm(t('confirmReset'))) { store.reset(); location.reload(); } } }, t('reset')));
    if (store.data.demo) root.append(el('div', { class: 'banner noprint', role: 'note', text: t('demoBanner') }), el('button', { class: 'btn noprint', id: 'clean', onclick: () => { if (!confirm(t('confirmClean'))) return; store.data.q = Q.newState(); store.data.demo = false; slip = null; save(); } }, t('startClean')));
    root.append(el('h1', { class: 'noprint', text: t('reception') }), el('p', { class: 'small noprint', text: t('limits') }));
    const tk = slip && st.tickets.find((x) => x.id === slip); if (tk) root.append(slipCard(tk));
    const list = el('div', { class: 'noprint' }); st.services.forEach((s) => list.append(servicePanel(s))); root.append(list);
    const sn = el('input', { id: 'svc-ar', placeholder: t('svcAr'), maxlength: 40 }), se = el('input', { id: 'svc-en', placeholder: t('svcEn'), maxlength: 40 }), imp = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const r = store.importJSON(await Kit.readFile(f)); const d = r.ok && r.data && r.data.q; if (!d || !Array.isArray(d.services) || !Array.isArray(d.tickets) || typeof d.next !== 'object') return Kit.toast(t('restoreFail')); store.data = { q: d, demo: !!r.data.demo }; slip = null; store.save(); Kit.toast(t('restored')); render(); } });
    root.append(el('section', { class: 'card noprint' }, el('h2', { text: t('manage') }), field(t('svcAr'), sn), field(t('svcEn'), se),
      el('div', { class: 'row' }, el('button', { class: 'btn', id: 'svc-add', onclick: () => { const nm = { ar: sn.value, en: se.value }; if (!String(nm.ar || nm.en).trim()) return Kit.toast(t('svcName')); const r = Q.addService(st, 's' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 99), nm); if (!r.ok) return Kit.toast(t('svc' + (r.error === 'dup' ? 'Dup' : 'Name'))); save(); } }, t('add'))),
      el('div', { class: 'row' }, st.services.map((s) => el('button', { class: 'btn small danger', onclick: () => { const r = Q.removeService(st, s.id); if (!r.ok) return Kit.toast(t('svcBusy')); save(); } }, t('removeSvc') + ': ' + sname(s)))),
      el('div', { class: 'row' }, el('button', { class: 'btn', id: 'csv', onclick: () => Kit.download('dawr-tickets.csv', Q.csv(st), 'text/csv') }, t('exportCsv')), el('button', { class: 'btn', onclick: () => Kit.download('dawr-backup.json', store.exportJSON(), 'application/json') }, t('backup')), el('button', { class: 'btn', onclick: () => imp.click() }, t('restoreFile')), imp,
        el('button', { class: 'btn danger', id: 'newday', onclick: () => { if (!confirm(t('confirmDay'))) return; st.tickets = []; Object.keys(st.next).forEach((k) => { st.next[k] = 1; }); slip = null; save(); } }, t('newDay')))));
    return root;
  }

  /* ---------- display ---------- */
  let timer = null;
  function viewDisplay() {
    const root = el('main', { id: 'main-content', class: 'disp', tabindex: '-1' }), st = Q_();
    root.append(el('div', { class: 'row noprint' }, el('p', { class: 'small grow', text: t('displayHelp') }), el('button', { class: 'btn small', onclick: () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}) }, t('fullscreen'))));
    if (store.data.demo) root.append(el('div', { class: 'banner', role: 'note', text: t('demoBanner') }));
    const grid = el('div', { class: 'dgrid' });
    st.services.forEach((s) => { const cur = Q.serving(st, s.id), w = Q.waiting(st, s.id).slice(0, 3); grid.append(el('section', { class: 'dcell', 'data-svc': s.id }, el('h2', { text: sname(s) }), el('div', { class: 'bignum huge', id: 'd-' + s.id, text: cur ? String(cur.n) : '—' }), el('p', { text: w.length ? t('nextUp') + ': ' + w.map((x) => '#' + x.n).join('  ') : t('noWaiting') }))); });
    root.append(grid, el('p', { class: 'small', id: 'upd', text: t('updated', { t: hhmm(Kit.now()) }) }));
    return root;
  }

  /* ---------- customer ---------- */
  function viewCustomer(raw) {
    const root = el('main', { id: 'main-content', tabindex: '-1' }), snap = Q.decode(raw);
    if (!snap) root.append(el('div', { class: 'banner errb', role: 'alert', id: 'bad', text: t('c_bad') }));
    else {
      const v = Q.view(snap, Kit.now()), sn = snap.l[Kit.lang === 'ar' ? 0 : 1] || snap.l[0];
      if (snap.k !== cfg.shopId) root.append(el('div', { class: 'banner errb', role: 'alert', text: t('c_other') }));
      root.append(el('h1', { text: t('yourNumber') }), el('div', { class: 'bignum huge', id: 'my-num', text: String(snap.n) }), el('p', { text: t('svcLabel', { s: sn }) }),
        el('p', { class: 'banner', id: 'c-state', text: v.state === 'wait' ? t('c_wait', { a: v.ahead }) : t(v.state === 'next' ? 'c_next' : 'c_called') }),
        v.state === 'wait' ? el('p', { id: 'c-est', text: v.minutes == null ? t('c_noEst') : t('c_minutes', { m: v.minutes }) }) : null,
        el('p', { class: 'small', id: 'c-age', text: t('c_age', { t: hhmm(snap.t), a: v.ageMin }) }));
    }
    const inp = el('input', { id: 'paste', placeholder: t('c_paste'), 'aria-label': t('c_paste'), dir: 'ltr' });
    root.append(el('div', { class: 'row' }, inp, el('button', { class: 'btn', id: 'open', onclick: () => { const m = /#\/t\/([^\s]+)$/.exec(inp.value.trim()); location.hash = '#/t/' + (m ? m[1] : inp.value.trim()); } }, t('c_open'))));
    return root;
  }

  function render() {
    clearInterval(timer); document.body.classList.remove('ps');
    const r = route(); Kit.applyTheme(); document.title = 'dawr | دَور';
    const kind = /^t\//.test(r) ? 'customer' : r === 'display' ? 'display' : 'reception';
    const view = kind === 'customer' ? viewCustomer(r.slice(2)) : kind === 'display' ? viewDisplay() : viewReception();
    app.replaceChildren(header(kind === 'customer' ? 'customer' : kind), el('div', { class: 'wrap' + (kind === 'display' ? ' wide' : '') }, view), Kit.footer()); document.body.dataset.ready = '1';
    if (kind === 'display') { const before = JSON.stringify(store.data.q); timer = setInterval(() => { store.load(); if (JSON.stringify(store.data.q) !== before) render(); else { const u = document.getElementById('upd'); if (u) u.textContent = t('updated', { t: hhmm(Kit.now()) }); } }, 2000); }
  }
  window.addEventListener('afterprint', () => document.body.classList.remove('ps'));
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  Kit.initLang('dawr'); render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
