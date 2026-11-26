/* Dawr — app shell, views, storage, sync. Requires queue.js, i18n.js, vendor/qrcode.min.js */
(function () {
  'use strict';
  var Q = window.DawrCore;
  var LS_SETTINGS = 'dawr.v1.settings';
  var LS_STATE = 'dawr.v1.state';
  var LS_LANG = 'dawr.v1.lang';
  var LS_SOUND = 'dawr.v1.sound';
  var LS_SERVICE = 'dawr.v1.service';

  /* ---------------- storage & sync ---------------- */

  var bc = null;
  try { bc = new BroadcastChannel('dawr.v1'); } catch (e) { /* older browsers */ }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return Q.sanitizeSettings(JSON.parse(raw));
    } catch (e) {}
    return Q.defaultSettings();
  }
  function loadState(settings) {
    try {
      var raw = localStorage.getItem(LS_STATE);
      if (raw) {
        var st = JSON.parse(raw);
        if (st && st.v === Q.VERSION && Array.isArray(st.tickets)) return st;
      }
    } catch (e) {}
    return Q.createState(settings.startNumber);
  }

  var settings = loadSettings();
  if (!settings.queueId) {
    settings.queueId = 'q' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }
  var state = loadState(settings);

  function save() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    if (bc) { try { bc.postMessage({ type: 'sync' }); } catch (e) {} }
  }

  /* visitor mode: page opened with a settings token whose queueId != ours */
  var routeInfo = parseRoute();
  var visitor = false;
  var visitorSettings = null;
  var visitorSnap = null;
  if (routeInfo.params.cfg) {
    visitorSettings = Q.decodeSettingsToken(routeInfo.params.cfg);
  }
  if (routeInfo.params.s) {
    visitorSnap = Q.decodeSnapshot(routeInfo.params.s);
  }
  if (visitorSettings && visitorSettings.queueId && visitorSettings.queueId !== settings.queueId) {
    visitor = true;
  }
  // tracker links may omit queueId when slimmed; a snapshot token also marks visitor mode
  if (!visitor && visitorSnap && routeInfo.params.s && !localStorage.getItem(LS_STATE) && routeInfo.view !== 'staff' && routeInfo.view !== 'settings') {
    visitor = true;
  }

  /* ---------------- i18n ---------------- */

  var lang = localStorage.getItem(LS_LANG) || (visitor && visitorSettings ? visitorSettings.lang : settings.lang) || 'ar';
  function t(key) {
    var L = window.DAWR_I18N[lang] || window.DAWR_I18N.en;
    return L[key] != null ? L[key] : (window.DAWR_I18N.en[key] || key);
  }
  function setLang(l) {
    lang = l;
    localStorage.setItem(LS_LANG, l);
    document.documentElement.lang = l;
    document.documentElement.dir = window.DAWR_I18N[l].dir;
    render();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtShort(sec) {
    var m = Math.max(1, Math.round(sec / 60));
    return lang === 'ar' ? m + ' ' + t('min') : m + t('min');
  }
  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }
  function peopleAheadText(n) {
    if (lang === 'ar') {
      if (n === 0) return 'لا يوجد أحد قبلك';
      if (n === 1) return t('peopleAheadOne');
      if (n === 2) return t('peopleAheadTwo');
      if (n <= 10) return n + ' ' + t('peopleAheadFew');
      return n + ' ' + t('peopleAhead');
    }
    return n + ' ' + (n === 1 ? t('peopleAheadOne') : t('peopleAhead'));
  }
  function ticketLabel(num) {
    var px = (visitor ? visitorSettings : settings).prefix || '';
    return '<span class="prefix">' + esc(px) + '</span>' + num;
  }

  /* effective settings for the current view */
  function S() { return visitor && visitorSettings ? visitorSettings : settings; }

  /* ---------------- routing ---------------- */

  function parseRoute() {
    var h = location.hash || '#/take';
    var q = h.indexOf('?');
    var view = (q === -1 ? h : h.slice(0, q)).replace(/^#\/?/, '') || 'take';
    var params = {};
    if (q !== -1) {
      h.slice(q + 1).split('&').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i > -1) params[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
      });
    }
    if (['take', 'staff', 'display', 'settings', 'ticket'].indexOf(view) === -1) view = 'take';
    return { view: view, params: params };
  }

  function go(view, params) {
    var h = '#/' + view;
    if (params) {
      var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
      if (qs) h += '?' + qs;
    }
    location.hash = h;
  }

  function baseUrl() {
    return location.origin + location.pathname;
  }

  /* slim settings for links. minimal=true for QR codes: tracking only needs
     name/colors/lang/prefix/avg — dropping the rest keeps the QR scannable. */
  function slimSettingsForLink(minimal) {
    var s = Q.sanitizeSettings(settings);
    if (minimal) {
      s.logoDataUrl = ''; s.services = [];
      s.welcome = ''; s.announcement = ''; s.ticketNote = '';
      return Q.encodeSettingsToken(s);
    }
    var tries = [
      { logo: true, svc: true, extra: true },
      { logo: false, svc: true, extra: true },
      { logo: false, svc: false, extra: true },
      { logo: false, svc: false, extra: false }
    ];
    for (var i = 0; i < tries.length; i++) {
      var c = Q.sanitizeSettings(s);
      if (!tries[i].logo) c.logoDataUrl = '';
      if (!tries[i].svc) c.services = [];
      if (!tries[i].extra) { c.welcome = ''; c.announcement = ''; c.ticketNote = ''; }
      var tok = Q.encodeSettingsToken(c);
      if (tok.length <= 1000) return tok;
    }
    return Q.encodeSettingsToken(Q.defaultSettings());
  }

  function trackerUrl(ticketNum) {
    var u = baseUrl() + '#/ticket?cfg=' + slimSettingsForLink(true) + '&s=' + Q.encodeSnapshot(state, settings, Date.now());
    if (ticketNum != null) u += '&n=' + ticketNum;
    return u;
  }
  function kioskUrl() {
    return baseUrl() + '#/take?cfg=' + slimSettingsForLink(false);
  }

  /* ---------------- sound ---------------- */

  var audioCtx = null;
  function chime() {
    if (localStorage.getItem(LS_SOUND) === 'off') return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, audioCtx.currentTime);
      o.frequency.setValueAtTime(1174.7, audioCtx.currentTime + 0.15);
      g.gain.setValueAtTime(0.18, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      o.start(); o.stop(audioCtx.currentTime + 0.65);
    } catch (e) {}
  }
  /* Announcements use bundled recorded clips (audio/<lang>/*.mp3), so the voice is
     the same on every phone. The browser's speech voice is only a fallback. */
  var speakToken = 0, curAudio = null;
  function clipsFor(prefix, num, lg) {
    var out = ['call'], n = parseInt(num, 10);
    if (!(n >= 0 && n <= 999)) return null;
    for (var i = 0; i < prefix.length; i++) {
      var ch = prefix.charAt(i).toUpperCase();
      if (/[A-Z\u0621-\u064A]/.test(ch)) out.push('L' + ch);
      else if (/[0-9]/.test(ch)) out.push(ch === '0' ? 'zero' : 'n' + ch);
      else if (/\s/.test(ch) || ch === '-') continue;
      else return null;
    }
    if (n === 0) out.push('zero');
    else {
      var h = Math.floor(n / 100) * 100, r = n % 100;
      if (h) out.push('n' + h);
      if (r) out.push((h && lg === 'ar' ? 'a' : 'n') + r);
    }
    out.push('go');
    return out;
  }
  function speechFallback(num) {
    try {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(t('servingNowCall') + ' ' + (S().prefix || '') + num + ', ' + t('pleaseProceed'));
      u.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function speak(num) {
    if (localStorage.getItem(LS_SOUND) === 'off') return;
    var list = clipsFor(S().prefix || '', num, lang);
    if (!list || typeof Audio === 'undefined') return speechFallback(num);
    var token = ++speakToken, i = 0;
    if (curAudio) { try { curAudio.pause(); } catch (e) {} }
    window.__dawrSpoken = list.join(' ');
    function next() {
      if (token !== speakToken || i >= list.length) return;
      var a = new Audio('audio/' + lang + '/' + list[i++] + '.mp3');
      curAudio = a;
      a.onended = next;
      a.onerror = function () { if (token === speakToken && i === 1) speechFallback(num); else next(); };
      var p = a.play(); if (p && p.catch) p.catch(function () { if (token === speakToken && i === 1) speechFallback(num); });
    }
    next();
  }

  /* ---------------- qr ---------------- */

  function qrHtml(text) {
    try {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (e) {
      return '';
    }
  }

  /* ---------------- clipboard / share ---------------- */

  function copyText(text, btn) {
    function ok() { toast(t('copied')); if (btn) { btn.textContent = t('copied'); setTimeout(function () { btn.textContent = t('copy'); }, 1500); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast(t('copy') + ': ' + text.slice(0, 40)); }
      document.body.removeChild(ta);
    }
  }
  function nativeShare(url) {
    if (navigator.share) { navigator.share({ url: url }).catch(function () {}); }
    else copyText(url);
  }

  /* ---------------- toast ---------------- */

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------------- shell ---------------- */

  function icons(name) {
    var p = {
      ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4z"/><path d="M13 6v2m0 3v2m0 3v2" stroke-dasharray="2 3"/>',
      staff: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8m-4-4v4"/>',
      tv: '<rect x="2" y="5" width="20" height="13" rx="2"/><path d="m8 2 4 3 4-3"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'
    }[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  function shell(content, view) {
    var s = S();
    document.documentElement.lang = lang;
    document.documentElement.dir = window.DAWR_I18N[lang].dir;
    document.documentElement.style.setProperty('--primary', s.primaryColor);
    document.documentElement.style.setProperty('--accent', s.accentColor);
    document.title = (lang === 'ar' && s.businessNameAr ? s.businessNameAr : s.businessName) + ' · ' + t('appName');

    var logo = s.logoDataUrl
      ? '<img src="' + s.logoDataUrl + '" alt="">'
      : '<div class="logo-fallback">' + esc((lang === 'ar' && s.businessNameAr ? s.businessNameAr : s.businessName).trim().charAt(0) || 'د') + '</div>';

    var name = lang === 'ar' && s.businessNameAr ? s.businessNameAr : s.businessName;
    var nav = [
      ['take', 'navTake', 'ticket'],
      ['ticket', 'navTrack', 'search'],
      ['staff', 'navStaff', 'staff'],
      ['display', 'navDisplay', 'tv'],
      ['settings', 'navSettings', 'gear']
    ].map(function (n) {
      if (visitor && (n[0] === 'staff' || n[0] === 'settings')) return '';
      return '<a href="#/' + n[0] + '" class="' + (view === n[0] ? 'on' : '') + '">' + icons(n[2]) + '<span>' + t(n[1]) + '</span></a>';
    }).join('');

    var ticker = s.announcement ? '<div class="ticker no-print"><span>' + esc(s.announcement) + '</span></div>' : '';

    document.getElementById('app').innerHTML =
      '<div class="app-shell' + (view === 'display' ? ' display-shell' : '') + '">' +
      '<div class="topbar no-print">' +
      '<div class="brand">' + logo + '<h1>' + esc(name) + '<small>' + esc(t('tagline')) + '</small></h1></div>' +
      '<button class="lang-btn" data-act="lang">' + t('langToggle') + '</button>' +
      '</div>' + ticker + content +
      '<div class="powered no-print">' + esc(t('poweredBy')) + '</div>' +
      '</div>' +
      '<nav class="footnav no-print"><div class="inner">' + nav + '</div></nav>' +
      '<div class="toast" id="toast"></div>';
  }

  /* ---------------- view: take (kiosk) ---------------- */

  var lastTicket = null;
  var pickedService = localStorage.getItem(LS_SERVICE) || '';

  function viewTake() {
    if (visitor) return viewTrack(true); // customer phones track; numbers come from the business device
    var s = S();
    var waiting = Q.waitingTickets(state).length;
    var chips = '';
    if (s.services.length) {
      chips = '<div class="field mt"><label>' + t('chooseService') + '</label><div class="chips">' +
        s.services.map(function (sv) {
          var nm = lang === 'ar' && sv.nameAr ? sv.nameAr : sv.name;
          var pr = sv.price > 0 ? ' <span class="p">' + sv.price + ' ' + esc(s.currency) + '</span>' : '';
          return '<button class="chip' + (pickedService === sv.id ? ' on' : '') + '" data-act="svc" data-id="' + esc(sv.id) + '">' + esc(nm) + pr + '</button>';
        }).join('') + '</div></div>';
    }

    var ticketHtml = '';
    if (lastTicket) {
      var ahead = Q.peopleAhead(state, lastTicket.num);
      var wait = Q.estimateWaitSec(state, s, lastTicket.num, Date.now());
      ticketHtml =
        '<div class="ticket">' +
        '<div class="t-label">' + t('yourNumber') + '</div>' +
        '<div class="big-number">' + ticketLabel(lastTicket.num) + '</div>' +
        '<div class="perf"></div>' +
        '<div class="stat-row">' +
        '<div class="stat"><div class="v">' + ahead + '</div><div class="k">' + t('aheadOfYou') + '</div></div>' +
        '<div class="stat"><div class="v">' + fmtShort(wait) + '</div><div class="k">' + t('estWait') + '</div></div>' +
        '<div class="stat"><div class="v">' + fmtTime(lastTicket.ts) + '</div><div class="k">' + t('ticketTime') + '</div></div>' +
        '</div>' +
        (s.ticketNote ? '<p class="muted center mt">' + esc(s.ticketNote) + '</p>' : '') +
        '<p class="muted center mt">' + t('ticketHint') + '</p>' +
        '</div>' +
        '<div class="card no-print"><h2>' + t('trackThisTicket') + '</h2>' +
        '<div class="qr-wrap">' + qrHtml(trackerUrl(lastTicket.num)) + '</div>' +
        '<div class="btn-row"><button class="btn ghost" data-act="print">' + t('printTicket') + '</button>' +
        '<button class="btn ghost" data-act="share-track" data-n="' + lastTicket.num + '">' + t('share') + '</button></div>' +
        '</div>';
    }

    return shell(
      '<div class="hero">' +
      '<div class="label">' + t('nowServing') + '</div>' +
      '<div class="counter">' + (state.serving != null ? ticketLabel(state.serving) : '—') + '</div>' +
      '<div class="sub">' + (state.serving != null ? '' : t('noOneServing')) + '</div>' +
      '<div class="stat-row"><div class="stat"><div class="v">' + waiting + '</div><div class="k">' + t('waitingCount') + '</div></div>' +
      '<div class="stat"><div class="v">' + fmtShort(Q.effectiveAvgSec(state, s)) + '</div><div class="k">' + t('statAvg') + '</div></div></div>' +
      '</div>' +
      (s.welcome ? '<p class="center mt muted" style="font-size:.95rem">' + esc(s.welcome) + '</p>' : '') +
      (chips || '') +
      '<div class="mt"><button class="btn xl" data-act="take">' + t('takeButton') + '</button></div>' +
      (lastTicket ? '<div class="mt"><button class="btn ghost" data-act="take">' + t('takeAnother') + '</button></div>' : '') +
      ticketHtml,
      'take');
  }

  /* ---------------- view: tracker ---------------- */

  function viewTrack(fromTake) {
    var s = S();
    var snap, liveNow = !visitor;
    if (liveNow) {
      snap = Q.decodeSnapshot(Q.encodeSnapshot(state, s, Date.now()));
    } else {
      snap = visitorSnap;
    }
    var n = parseInt(routeInfo.params.n, 10);
    if (!isFinite(n)) n = null;

    var statusHtml = '';
    if (snap) {
      var servingHtml = '<div class="hero">' +
        '<div class="label">' + t('nowServing') + '</div>' +
        '<div class="counter' + (snap.s != null ? '' : ' muted') + '">' + (snap.s != null ? ticketLabel(snap.s) : '—') + '</div>' +
        '<div class="sub">' + (snap.s != null ? '' : t('noOneServing')) + '</div></div>';

      var ticketHtml = '';
      if (n != null) {
        var waitSec = liveNow
          ? (Q.findTicket(state, n) ? Q.estimateWaitSec(state, s, n, Date.now()) : null)
          : Q.snapshotWaitSec(snap, n, Date.now());
        var ahead = liveNow
          ? (Q.findTicket(state, n) ? Q.peopleAhead(state, n) : null)
          : (snap.s === n ? 0 : (snap.w.indexOf(n) === -1 ? null : snap.w.indexOf(n) + (snap.s != null ? 1 : 0)));

        var banner = '';
        if (snap.s === n) banner = '<div class="callout center" style="border-color:var(--ok)"><strong>' + t('yourTurn') + '</strong></div>';
        else if (waitSec == null) banner = '<div class="callout center">' + t('ticketDone') + '</div>';
        else if (ahead === 1 || (ahead === 0 && snap.s != null)) banner = '<div class="callout center" style="border-color:var(--accent)"><strong>' + t('youAreNext') + '</strong></div>';

        if (waitSec != null) {
          ticketHtml =
            '<div class="ticket">' +
            '<div class="t-label">' + t('yourNumber') + '</div>' +
            '<div class="big-number">' + ticketLabel(n) + '</div>' +
            '<div class="perf"></div>' +
            '<div class="stat-row">' +
            '<div class="stat"><div class="v">' + (ahead == null ? '—' : ahead) + '</div><div class="k">' + t('aheadOfYou') + '</div></div>' +
            '<div class="stat"><div class="v">' + fmtShort(waitSec) + '</div><div class="k">' + t('estWait') + '</div></div>' +
            '</div></div>';
        }
        statusHtml = servingHtml + banner + ticketHtml;
      } else {
        statusHtml = servingHtml;
      }
      var stale = !liveNow && snap.t && (Date.now() - snap.t > 15 * 60 * 1000);
      statusHtml += '<p class="muted center mt">' + t('lastUpdated') + ': ' + fmtTime(liveNow ? Date.now() : snap.t) + ' · ' + (liveNow ? t('liveHere') : t('rescanHint')) + '</p>' +
        (stale ? '<div class="callout center" style="border-color:var(--danger)">' + t('staleWarn') + '</div>' : '');
    }

    return shell(
      '<h2 class="mb" style="font-size:1.2rem">' + t('trackTitle') + '</h2>' +
      statusHtml +
      '<div class="card"><div class="field"><label>' + t('enterNumber') + '</label>' +
      '<div class="row"><input type="number" id="track-n" inputmode="numeric" min="1" value="' + (n != null ? n : '') + '">' +
      '<button class="btn sm" data-act="track" style="flex:0 0 auto">' + t('trackButton') + '</button></div></div></div>',
      'ticket');
  }

  /* ---------------- view: staff ---------------- */

  function viewStaff() {
    if (visitor) return viewTrack(true);
    var s = S();
    var waiting = Q.waitingTickets(state);
    var served = state.tickets.filter(function (x) { return x.status === 'done'; }).length;
    var noshow = state.tickets.filter(function (x) { return x.status === 'noshow'; }).length;

    var rows = state.tickets.slice().sort(function (a, b) { return b.num - a.num; }).slice(0, 40).map(function (x) {
      var badge = { waiting: t('stWaiting'), serving: t('stServing'), done: t('stDone'), noshow: t('stNoShow'), cancelled: t('stCancelled') }[x.status];
      var acts = '';
      if (x.status === 'waiting' || x.status === 'noshow') {
        acts = '<div class="actions">' +
          '<button class="icon-btn" title="' + t('call') + '" data-act="call-one" data-n="' + x.num + '">' + icons('bell') + '</button>' +
          '<button class="icon-btn" title="' + t('cancelTicket') + '" data-act="cancel" data-n="' + x.num + '">✕</button></div>';
      }
      return '<div class="qrow' + (x.status === 'serving' ? ' serving' : '') + '">' +
        '<div class="n">' + esc(s.prefix || '') + x.num + '</div>' +
        '<div class="meta">' + fmtTime(x.ts) + '</div>' +
        '<div class="badge">' + badge + '</div>' + acts + '</div>';
    }).join('');

    return shell(
      '<div class="hero">' +
      '<div class="label">' + t('nowServing') + '</div>' +
      '<div class="counter">' + (state.serving != null ? ticketLabel(state.serving) : '—') + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn ok" data-act="done" ' + (state.serving == null ? 'disabled style="opacity:.4"' : '') + '>' + t('done') + '</button>' +
      '<button class="btn danger" data-act="noshow" ' + (state.serving == null ? 'disabled style="opacity:.4"' : '') + '>' + t('noShow') + '</button>' +
      '<button class="btn ghost" data-act="recall" ' + (state.serving == null ? 'disabled style="opacity:.4"' : '') + '>' + t('recall') + '</button>' +
      '</div>' +
      '<div class="mt"><button class="btn xl" data-act="next">' + t('callNext') + '</button></div>' +
      '</div>' +

      '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + waiting.length + '</div><div class="k">' + t('statWaiting') + '</div></div>' +
      '<div class="stat"><div class="v">' + served + '</div><div class="k">' + t('statServed') + '</div></div>' +
      '<div class="stat"><div class="v">' + noshow + '</div><div class="k">' + t('statNoShow') + '</div></div>' +
      '<div class="stat"><div class="v">' + fmtShort(Q.effectiveAvgSec(state, s)) + '</div><div class="k">' + t('statAvg') + '</div></div>' +
      '</div>' +

      '<div class="card"><h2>' + t('today') + '</h2>' +
      (rows || '<div class="empty"><div class="big" style="width:44px;margin:0 auto 8px;color:var(--ink-soft)">' + icons('ticket') + '</div>' + t('queueEmpty') + '</div>') +
      '</div>' +

      '<div class="card"><h2>' + t('callNumber') + '</h2>' +
      '<div class="field"><div class="row"><input type="number" id="call-n" inputmode="numeric" min="1" placeholder="' + t('ticketNum') + '">' +
      '<button class="btn sm" data-act="call-num" style="flex:0 0 auto">' + t('call') + '</button></div></div></div>' +

      '<div class="card"><h2>' + t('shareTitle') + '</h2>' +
      '<p class="muted">' + t('qrNote') + '</p>' +
      '<div class="qr-wrap mt" id="staff-qr">' + qrHtml(trackerUrl()) + '</div>' +
      '<p class="muted center mt">' + t('scanToTrack') + '</p>' +
      '<div class="field mt"><label>' + t('shareTracker') + '</label>' +
      '<div class="link-box"><code>' + esc(trackerUrl().slice(0, 90)) + '…</code>' +
      '<button class="btn sm ghost" data-act="copy-tracker">' + t('copy') + '</button>' +
      '<button class="btn sm ghost" data-act="share-tracker">' + t('share') + '</button></div></div>' +
      '<div class="btn-row">' +
      '<a class="btn ghost" href="#/take" target="_blank">' + t('kioskMode') + '</a>' +
      '<a class="btn ghost" href="#/display" target="_blank">' + t('displayMode') + '</a>' +
      '</div>' +
      '<div class="btn-row">' +
      '<a class="btn ghost" href="#/settings">' + t('openSettings') + '</a>' +
      '<button class="btn ghost" data-act="csv">' + t('exportData') + '</button>' +
      '</div>' +
      '<div class="btn-row">' +
      '<button class="btn ghost sm" data-act="sound">' + (localStorage.getItem(LS_SOUND) === 'off' ? t('soundOff') : t('soundOn')) + '</button>' +
      '<button class="btn danger sm" data-act="reset">' + t('resetDay') + '</button>' +
      '</div>' +
      '</div>',
      'staff');
  }

  /* ---------------- view: display ---------------- */

  var lastServingSeen = null;
  function viewDisplay() {
    var s = S();
    var snap;
    if (!visitor) {
      snap = Q.decodeSnapshot(Q.encodeSnapshot(state, s, Date.now()));
    } else {
      snap = visitorSnap;
    }
    if (snap && snap.s != null && snap.s !== lastServingSeen) {
      lastServingSeen = snap.s;
      chime();
      if (!visitor) speak(snap.s);
      setTimeout(function () {
        var el = document.querySelector('.display-shell .counter');
        if (el) el.classList.add('flash');
      }, 30);
    }
    var next = snap ? snap.w.slice(0, 4) : [];
    return shell(
      '<div class="hero">' +
      '<div class="label">' + t('nowServing') + '</div>' +
      '<div class="counter">' + (snap && snap.s != null ? ticketLabel(snap.s) : '—') + '</div>' +
      '<div class="sub">' + (snap && snap.s != null ? '' : t('noOneServing')) + '</div>' +
      '</div>' +
      (next.length ? '<div class="card"><h2>' + t('displayNext') + '</h2><div class="display-next">' +
        next.map(function (n, i) {
          var w = snap ? Q.snapshotWaitSec(snap, n, Date.now()) : null;
          return '<div class="n">' + esc(s.prefix || '') + n + (w != null ? '<div style="font-size:.65rem;color:var(--ink-soft);font-family:inherit;font-weight:400">≈ ' + fmtShort(w) + '</div>' : '') + '</div>';
        }).join('') + '</div></div>' : '') +
      '<div class="card"><h2>' + t('scanToTrack') + '</h2>' +
      '<div class="qr-wrap">' + (visitor ? qrHtml(location.href) : qrHtml(trackerUrl())) + '</div>' +
      '<p class="muted center mt">' + t('qrNote') + '</p></div>' +
      '<div class="center mt no-print"><button class="btn ghost sm" data-act="sound">' +
      (localStorage.getItem(LS_SOUND) === 'off' ? t('soundOff') : t('soundOn')) + '</button></div>',
      'display');
  }

  /* ---------------- view: settings ---------------- */

  function viewSettings() {
    if (visitor) return viewTrack(true);
    var s = settings;
    var svcRows = s.services.map(function (sv, i) {
      return '<div class="field"><div class="row">' +
        '<input type="text" data-svc="nameAr" data-i="' + i + '" placeholder="' + t('serviceNameAr') + '" value="' + esc(sv.nameAr) + '">' +
        '<input type="text" data-svc="name" data-i="' + i + '" placeholder="' + t('serviceNameEn') + '" value="' + esc(sv.name) + '">' +
        '<input type="number" data-svc="price" data-i="' + i + '" placeholder="' + t('price') + '" min="0" step="0.5" value="' + sv.price + '" style="flex:0 0 90px">' +
        '<button class="icon-btn" data-act="svc-del" data-i="' + i + '" style="flex:0 0 auto">✕</button>' +
        '</div></div>';
    }).join('');

    return shell(
      '<h2 class="mb" style="font-size:1.2rem">' + t('settingsTitle') + '</h2>' +

      '<div class="card"><h2>' + t('secIdentity') + '</h2>' +
      '<div class="field"><label>' + t('labelNameAr') + '</label><input type="text" id="set-nameAr" value="' + esc(s.businessNameAr) + '"></div>' +
      '<div class="field"><label>' + t('labelNameEn') + '</label><input type="text" id="set-nameEn" value="' + esc(s.businessName) + '"></div>' +
      '<div class="field"><label>' + t('labelLogo') + '</label><div class="logo-box">' +
      (s.logoDataUrl ? '<img src="' + s.logoDataUrl + '" alt="">' : '') +
      '<button class="btn sm ghost" data-act="logo">' + t('uploadLogo') + '</button>' +
      (s.logoDataUrl ? '<button class="btn sm ghost" data-act="logo-del">' + t('removeLogo') + '</button>' : '') +
      '<input type="file" id="logo-file" accept="image/*" class="hidden"></div></div>' +
      '<div class="field"><div class="row">' +
      '<div><label>' + t('labelPrimary') + '</label><input type="color" id="set-primary" value="' + esc(s.primaryColor) + '"></div>' +
      '<div><label>' + t('labelAccent') + '</label><input type="color" id="set-accent" value="' + esc(s.accentColor) + '"></div>' +
      '</div></div>' +
      '<div class="field"><label>' + t('labelLang') + '</label><select id="set-lang">' +
      '<option value="ar"' + (s.lang === 'ar' ? ' selected' : '') + '>العربية</option>' +
      '<option value="en"' + (s.lang === 'en' ? ' selected' : '') + '>English</option></select></div>' +
      '</div>' +

      '<div class="card"><h2>' + t('secContent') + '</h2>' +
      '<div class="field"><label>' + t('labelWelcome') + '</label><textarea id="set-welcome">' + esc(s.welcome) + '</textarea></div>' +
      '<div class="field"><label>' + t('labelAnnouncement') + '</label><textarea id="set-ann">' + esc(s.announcement) + '</textarea></div>' +
      '<div class="field"><label>' + t('labelNote') + '</label><textarea id="set-note">' + esc(s.ticketNote) + '</textarea></div>' +
      '</div>' +

      '<div class="card"><h2>' + t('secQueue') + '</h2>' +
      '<div class="field"><div class="row">' +
      '<div><label>' + t('labelAvg') + '</label><input type="number" id="set-avg" min="1" max="120" value="' + Math.round(s.avgServiceSec / 60) + '"></div>' +
      '<div><label>' + t('labelPrefix') + '</label><input type="text" id="set-prefix" maxlength="4" value="' + esc(s.prefix) + '"></div>' +
      '<div><label>' + t('labelStart') + '</label><input type="number" id="set-start" min="0" value="' + s.startNumber + '"></div>' +
      '</div></div>' +
      '<div class="field"><label class="switch"><input type="checkbox" id="set-autoavg"' + (s.autoAvg ? ' checked' : '') + '> ' + t('labelAutoAvg') + '</label></div>' +
      '</div>' +

      '<div class="card"><h2>' + t('secServices') + '</h2>' +
      '<div class="field"><label>' + t('labelCurrency') + '</label><input type="text" id="set-currency" maxlength="8" value="' + esc(s.currency) + '" style="max-width:120px"></div>' +
      svcRows +
      '<button class="btn sm ghost" data-act="svc-add">' + t('addService') + '</button></div>' +

      '<div class="card"><h2>' + t('secBackup') + '</h2>' +
      '<div class="btn-row">' +
      '<button class="btn ghost" data-act="export">' + t('exportSettings') + '</button>' +
      '<button class="btn ghost" data-act="import">' + t('importSettings') + '</button>' +
      '<input type="file" id="import-file" accept="application/json,.json" class="hidden">' +
      '</div>' +
      '<div class="btn-row">' +
      '<button class="btn ghost" data-act="copy-customer">' + t('copyCustomerLink') + '</button>' +
      '<a class="btn ghost" href="#/take">' + t('preview') + '</a>' +
      '</div>' +
      '<div class="mt"><button class="btn danger sm" data-act="reset-branding">' + t('resetBranding') + '</button></div>' +
      '</div>' +

      '<div class="mt"><button class="btn xl" data-act="save-settings">' + t('save') + '</button></div>',
      'settings');
  }

  /* ---------------- render & events ---------------- */

  function render() {
    routeInfo = parseRoute();
    var view = routeInfo.view;
    var html;
    if (view === 'staff') html = viewStaff();
    else if (view === 'display') html = viewDisplay();
    else if (view === 'settings') html = viewSettings();
    else if (view === 'ticket') html = viewTrack(false);
    else html = viewTake();
    return html;
  }

  function collectSettingsForm() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    settings.businessNameAr = v('set-nameAr').slice(0, 60);
    settings.businessName = v('set-nameEn').slice(0, 60);
    settings.primaryColor = v('set-primary') || settings.primaryColor;
    settings.accentColor = v('set-accent') || settings.accentColor;
    settings.lang = v('set-lang') === 'en' ? 'en' : 'ar';
    settings.welcome = v('set-welcome').slice(0, 140);
    settings.announcement = v('set-ann').slice(0, 140);
    settings.ticketNote = v('set-note').slice(0, 140);
    var avgMin = parseInt(v('set-avg'), 10);
    if (isFinite(avgMin) && avgMin >= 1 && avgMin <= 120) settings.avgServiceSec = avgMin * 60;
    settings.prefix = v('set-prefix').slice(0, 4);
    var st = parseInt(v('set-start'), 10);
    if (isFinite(st) && st >= 0 && st <= 99999) settings.startNumber = st;
    settings.autoAvg = !!document.getElementById('set-autoavg').checked;
    settings.currency = v('set-currency').slice(0, 8) || 'EGP';
    // services
    var rows = {};
    document.querySelectorAll('[data-svc]').forEach(function (el) {
      var i = el.getAttribute('data-i');
      rows[i] = rows[i] || {};
      rows[i][el.getAttribute('data-svc')] = el.value;
    });
    settings.services = Object.keys(rows).map(function (i) {
      var r = rows[i];
      return { id: 'svc' + i, name: (r.name || '').slice(0, 60), nameAr: (r.nameAr || '').slice(0, 60), price: Math.max(0, Number(r.price) || 0) };
    }).filter(function (x) { return x.name || x.nameAr; });
    settings = Q.sanitizeSettings(settings);
    save();
  }

  function exportCsv() {
    var head = 'number,status,taken_at,called_at,finished_at,service_seconds\n';
    var body = state.tickets.map(function (x) {
      return [x.num, x.status,
        x.ts ? new Date(x.ts).toISOString() : '',
        x.calledTs ? new Date(x.calledTs).toISOString() : '',
        x.doneTs ? new Date(x.doneTs).toISOString() : '',
        x.serviceSec == null ? '' : x.serviceSec].join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + head + body], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dawr-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function resizeImage(file, cb) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 160;
      var w = img.width, h = img.height;
      var scale = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/png'));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(''); };
    img.src = url;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'lang') return setLang(lang === 'ar' ? 'en' : 'ar');
    if (act === 'take') {
      lastTicket = Q.takeTicket(state, Date.now());
      save(); chime(); render();
      clearTimeout(window.__dawrTicketTimer);
      window.__dawrTicketTimer = setTimeout(function () {
        lastTicket = null;
        if (routeInfo.view === 'take') render();
      }, 90000);
      return;
    }
    if (act === 'svc') {
      pickedService = pickedService === el.getAttribute('data-id') ? '' : el.getAttribute('data-id');
      localStorage.setItem(LS_SERVICE, pickedService);
      render(); return;
    }
    if (act === 'print') return window.print();
    if (act === 'share-track') return nativeShare(trackerUrl(parseInt(el.getAttribute('data-n'), 10)));
    if (act === 'track') {
      var inp = document.getElementById('track-n');
      var n = inp ? parseInt(inp.value, 10) : NaN;
      if (isFinite(n)) {
        var p = { n: n };
        if (routeInfo.params.cfg) p.cfg = routeInfo.params.cfg;
        if (routeInfo.params.s) p.s = routeInfo.params.s;
        go('ticket', p);
      }
      return;
    }
    // staff
    if (act === 'next') {
      var nx = Q.callNext(state, Date.now());
      save(); if (nx) { chime(); speak(nx.num); } render(); return;
    }
    if (act === 'done') { Q.finishServing(state, 'done', Date.now()); save(); render(); return; }
    if (act === 'noshow') { Q.finishServing(state, 'noshow', Date.now()); save(); render(); return; }
    if (act === 'recall') { Q.recall(state, Date.now()); save(); chime(); if (state.serving != null) speak(state.serving); render(); return; }
    if (act === 'call-one') { Q.callSpecific(state, parseInt(el.getAttribute('data-n'), 10), Date.now()); save(); chime(); render(); return; }
    if (act === 'cancel') { Q.cancelTicket(state, parseInt(el.getAttribute('data-n'), 10)); save(); render(); return; }
    if (act === 'call-num') {
      var ci = document.getElementById('call-n');
      var cn = ci ? parseInt(ci.value, 10) : NaN;
      if (isFinite(cn)) {
        if (!Q.findTicket(state, cn)) {
          // calling a number not in the list: register it as served-out-of-band
          while (state.issued < cn) Q.takeTicket(state, Date.now());
        }
        Q.callSpecific(state, cn, Date.now());
        save(); chime(); render();
      }
      return;
    }
    if (act === 'reset') {
      if (confirm(t('resetConfirm'))) {
        state = Q.createState(settings.startNumber);
        lastTicket = null;
        save(); render();
      }
      return;
    }
    if (act === 'csv') return exportCsv();
    if (act === 'copy-tracker') return copyText(trackerUrl(), el);
    if (act === 'share-tracker') return nativeShare(trackerUrl());
    if (act === 'sound') {
      localStorage.setItem(LS_SOUND, localStorage.getItem(LS_SOUND) === 'off' ? 'on' : 'off');
      render(); return;
    }
    // settings
    if (act === 'save-settings') { collectSettingsForm(); toast(t('saved')); render(); return; }
    if (act === 'svc-add') {
      collectSettingsForm();
      settings.services.push({ id: 'svc' + Date.now(), name: '', nameAr: '', price: 0 });
      render(); return;
    }
    if (act === 'svc-del') {
      collectSettingsForm();
      settings.services.splice(parseInt(el.getAttribute('data-i'), 10), 1);
      save(); render(); return;
    }
    if (act === 'logo') return document.getElementById('logo-file').click();
    if (act === 'logo-del') { settings.logoDataUrl = ''; save(); render(); return; }
    if (act === 'export') {
      var blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dawr-settings.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      return;
    }
    if (act === 'import') return document.getElementById('import-file').click();
    if (act === 'reset-branding') {
      if (confirm(t('resetConfirm'))) {
        var keepQueue = settings.queueId;
        settings = Q.defaultSettings();
        settings.queueId = keepQueue;
        save(); render();
      }
      return;
    }
    if (act === 'copy-customer') return copyText(kioskUrl(), el);
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'logo-file' && e.target.files[0]) {
      resizeImage(e.target.files[0], function (dataUrl) {
        if (dataUrl) { settings.logoDataUrl = dataUrl; save(); render(); }
      });
    }
    if (e.target.id === 'import-file' && e.target.files[0]) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var imported = Q.sanitizeSettings(JSON.parse(r.result));
          imported.queueId = settings.queueId;
          settings = imported;
          save(); toast(t('importDone')); render();
        } catch (err) { toast(t('importBad')); }
      };
      r.readAsText(e.target.files[0]);
    }
  });

  /* live updates from other tabs (same device) */
  function onSync() {
    var freshSettings = loadSettings();
    if (freshSettings.queueId === settings.queueId) {
      settings = freshSettings;
      state = loadState(settings);
      render();
    }
  }
  if (bc) bc.onmessage = onSync;
  window.addEventListener('storage', function (e) {
    if (e.key === LS_STATE || e.key === LS_SETTINGS) onSync();
  });
  window.addEventListener('hashchange', render);

  /* periodic refresh so estimates count down on their own */
  setInterval(function () {
    if (routeInfo.view === 'take' || routeInfo.view === 'ticket' || routeInfo.view === 'display') render();
  }, 30000);

  render();
})();
