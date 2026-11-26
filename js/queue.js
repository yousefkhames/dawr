/* Dawr — pure queue logic. No DOM, no storage. Works in browser and Node (for tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DawrCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;

  /* ---------- settings ---------- */

  var DEFAULT_SETTINGS = {
    businessName: 'Dawr Clinic',
    businessNameAr: 'عيادة دور',
    lang: 'ar',                 // 'ar' | 'en' — customer default language
    primaryColor: '#0f766e',    // teal
    accentColor: '#f59e0b',     // amber
    logoDataUrl: '',            // uploaded logo, data URL
    welcome: '',                // greeting line on take-a-number page
    announcement: '',           // ticker line under the counter
    ticketNote: '',             // footer note on the customer ticket
    currency: 'EGP',            // used only for optional service price list
    services: [],               // [{id, name, nameAr, price}] optional
    avgServiceSec: 300,         // manual estimate per customer
    autoAvg: true,              // learn from completed tickets
    prefix: '',                 // ticket number prefix, e.g. "A"
    startNumber: 1,
    queueId: ''                 // random per-business id: separates devices from visitors
  };

  function defaultSettings() {
    var s = {};
    for (var k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
    s.services = [];
    return s;
  }

  function sanitizeSettings(input) {
    var s = defaultSettings();
    if (!input || typeof input !== 'object') return s;
    function str(key, max) {
      if (typeof input[key] === 'string') s[key] = input[key].slice(0, max || 200);
    }
    function num(key, min, max) {
      var n = Number(input[key]);
      if (isFinite(n)) s[key] = Math.min(max, Math.max(min, Math.round(n)));
    }
    function color(key) {
      if (typeof input[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(input[key])) s[key] = input[key];
    }
    str('businessName', 60); str('businessNameAr', 60);
    str('welcome', 140); str('announcement', 140); str('ticketNote', 140);
    str('currency', 8); str('prefix', 4);
    if (typeof input.queueId === 'string' && /^[a-z0-9]{1,16}$/i.test(input.queueId)) s.queueId = input.queueId;
    if (input.lang === 'ar' || input.lang === 'en') s.lang = input.lang;
    color('primaryColor'); color('accentColor');
    if (typeof input.logoDataUrl === 'string' && /^data:image\//.test(input.logoDataUrl) && input.logoDataUrl.length < 400000) {
      s.logoDataUrl = input.logoDataUrl;
    }
    num('avgServiceSec', 15, 4 * 3600);
    num('startNumber', 0, 99999);
    if (typeof input.autoAvg === 'boolean') s.autoAvg = input.autoAvg;
    if (Array.isArray(input.services)) {
      s.services = input.services.slice(0, 20).map(function (svc, i) {
        if (!svc || typeof svc !== 'object') return null;
        var price = Number(svc.price);
        return {
          id: typeof svc.id === 'string' && svc.id ? svc.id.slice(0, 24) : 'svc' + i,
          name: String(svc.name || '').slice(0, 60),
          nameAr: String(svc.nameAr || '').slice(0, 60),
          price: isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0
        };
      }).filter(Boolean);
    }
    return s;
  }

  /* ---------- state ---------- */

  function createState(startNumber) {
    return {
      v: VERSION,
      issued: (typeof startNumber === 'number' ? startNumber : 1) - 1, // last number given out
      serving: null,      // number currently being served
      recalledAt: 0,
      tickets: [],        // {num, ts, status, serviceSec, doneTs, calledTs}
      history: []         // serviceSec of last N completed, oldest first
    };
  }

  function findTicket(state, num) {
    for (var i = 0; i < state.tickets.length; i++) {
      if (state.tickets[i].num === num) return state.tickets[i];
    }
    return null;
  }

  function takeTicket(state, now) {
    var num = state.issued + 1;
    state.issued = num;
    var t = { num: num, ts: now || Date.now(), status: 'waiting', serviceSec: null, doneTs: null, calledTs: null };
    state.tickets.push(t);
    return t;
  }

  function waitingTickets(state) {
    return state.tickets.filter(function (t) { return t.status === 'waiting'; })
      .sort(function (a, b) { return a.num - b.num; });
  }

  function callNext(state, now) {
    var next = waitingTickets(state)[0];
    if (!next) return null; // keep showing the current number; nobody to call

    next.status = 'serving';
    next.calledTs = now || Date.now();
    state.serving = next.num;
    state.recalledAt = next.calledTs;
    return next;
  }

  function callSpecific(state, num, now) {
    var t = findTicket(state, num);
    if (!t || (t.status !== 'waiting' && t.status !== 'noshow')) return null;
    t.status = 'serving';
    t.calledTs = now || Date.now();
    state.serving = num;
    state.recalledAt = t.calledTs;
    return t;
  }

  function recall(state, now) {
    if (state.serving == null) return false;
    state.recalledAt = now || Date.now();
    var t = findTicket(state, state.serving);
    if (t && t.status === 'serving') t.calledTs = state.recalledAt;
    return true;
  }

  function finishServing(state, outcome, now) {
    // outcome: 'done' | 'noshow'
    if (state.serving == null) return null;
    var t = findTicket(state, state.serving);
    if (!t || t.status !== 'serving') { state.serving = null; return null; }
    var ts = now || Date.now();
    t.status = outcome;
    t.doneTs = ts;
    if (outcome === 'done' && t.calledTs && ts >= t.calledTs) {
      t.serviceSec = Math.round((ts - t.calledTs) / 1000);
      state.history.push(t.serviceSec);
      if (state.history.length > 12) state.history = state.history.slice(-12);
    }
    state.serving = null;
    return t;
  }

  function cancelTicket(state, num) {
    var t = findTicket(state, num);
    if (!t) return false;
    if (t.status === 'serving' && state.serving === num) state.serving = null;
    t.status = 'cancelled';
    t.doneTs = Date.now();
    return true;
  }

  /* ---------- estimates ---------- */

  function learnedAvgSec(state, manualSec) {
    if (state.history.length === 0) return manualSec;
    var sum = 0;
    for (var i = 0; i < state.history.length; i++) sum += state.history[i];
    return Math.round(sum / state.history.length);
  }

  function effectiveAvgSec(state, settings) {
    if (settings && settings.autoAvg === false) return settings.avgServiceSec;
    var manual = settings ? settings.avgServiceSec : 300;
    return learnedAvgSec(state, manual);
  }

  function peopleAhead(state, num) {
    var t = findTicket(state, num);
    if (!t) return 0;
    if (t.status === 'serving') return 0;
    if (t.status !== 'waiting') return 0;
    var ahead = waitingTickets(state).filter(function (w) { return w.num < num; }).length;
    if (state.serving != null) ahead += 1; // the one being served still ahead of you
    return ahead;
  }

  /* estimated wait in seconds for ticket `num` at time `now` */
  function estimateWaitSec(state, settings, num, now) {
    var t = findTicket(state, num);
    if (!t || t.status !== 'waiting') return 0;
    var avg = effectiveAvgSec(state, settings);
    var ahead = peopleAhead(state, num);
    var remainingOnCurrent = 0;
    if (state.serving != null) {
      var cur = findTicket(state, state.serving);
      if (cur && cur.calledTs) {
        var elapsed = Math.max(0, Math.round(((now || Date.now()) - cur.calledTs) / 1000));
        remainingOnCurrent = Math.max(0, avg - elapsed);
      } else {
        remainingOnCurrent = avg;
      }
    }
    var beforeYou = state.serving != null ? ahead - 1 : ahead;
    return Math.round(remainingOnCurrent + beforeYou * avg);
  }

  /* ---------- share tokens (no-server sync) ---------- */

  function b64urlEncode(str) {
    var b64;
    if (typeof btoa === 'function') {
      b64 = btoa(unescape(encodeURIComponent(str)));
    } else {
      b64 = Buffer.from(str, 'utf8').toString('base64');
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(token) {
    var b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var str;
    if (typeof atob === 'function') {
      str = decodeURIComponent(escape(atob(b64)));
    } else {
      str = Buffer.from(b64, 'base64').toString('utf8');
    }
    return str;
  }

  /* Settings token: the branded "take a number" link. */
  function encodeSettingsToken(settings) {
    var s = sanitizeSettings(settings);
    var slim = {
      bn: s.businessName, bna: s.businessNameAr, lang: s.lang,
      pc: s.primaryColor, ac: s.accentColor, logo: s.logoDataUrl,
      w: s.welcome, ann: s.announcement, note: s.ticketNote,
      cur: s.currency, svc: s.services, avg: s.avgServiceSec,
      aa: s.autoAvg ? 1 : 0, px: s.prefix, sn: s.startNumber, q: s.queueId
    };
    return 'd1.' + b64urlEncode(JSON.stringify(slim));
  }

  function decodeSettingsToken(token) {
    if (typeof token !== 'string' || token.indexOf('d1.') !== 0) return null;
    try {
      var slim = JSON.parse(b64urlDecode(token.slice(3)));
      return sanitizeSettings({
        businessName: slim.bn, businessNameAr: slim.bna, lang: slim.lang,
        primaryColor: slim.pc, accentColor: slim.ac, logoDataUrl: slim.logo,
        welcome: slim.w, announcement: slim.ann, ticketNote: slim.note,
        currency: slim.cur, services: slim.svc, avgServiceSec: slim.avg,
        autoAvg: slim.aa === 1, prefix: slim.px, startNumber: slim.sn,
        queueId: slim.q
      });
    } catch (e) { return null; }
  }

  /* Snapshot token: live queue state, refreshed by the staff screen. */
  function encodeSnapshot(state, settings, now) {
    var snap = {
      s: state.serving,
      i: state.issued,
      r: state.recalledAt || 0,
      avg: effectiveAvgSec(state, settings),
      w: waitingTickets(state).map(function (t) { return t.num; }),
      t: now || Date.now()
    };
    return 'q1.' + b64urlEncode(JSON.stringify(snap));
  }

  function decodeSnapshot(token) {
    if (typeof token !== 'string' || token.indexOf('q1.') !== 0) return null;
    try {
      var snap = JSON.parse(b64urlDecode(token.slice(3)));
      if (typeof snap !== 'object' || snap === null) return null;
      if (!Array.isArray(snap.w)) snap.w = [];
      if (typeof snap.i !== 'number') snap.i = 0;
      if (typeof snap.avg !== 'number' || !isFinite(snap.avg) || snap.avg < 1) snap.avg = 300;
      if (typeof snap.t !== 'number') snap.t = 0;
      if (typeof snap.s !== 'number') snap.s = null;
      if (typeof snap.r !== 'number') snap.r = 0;
      return snap;
    } catch (e) { return null; }
  }

  /* Dead-reckoned estimate from a snapshot for a waiting ticket number. */
  function snapshotWaitSec(snap, num, now) {
    if (!snap) return null;
    now = now || Date.now();
    if (snap.s === num) return 0;
    var idx = snap.w.indexOf(num);
    if (idx === -1) return null; // not waiting anymore (done/cancelled/unknown)
    var remainingOnCurrent = 0;
    if (snap.s != null) {
      var elapsedSnap = Math.max(0, Math.round((snap.t - snap.r) / 1000));
      var leftAtSnap = Math.max(0, snap.avg - elapsedSnap);
      var sinceSnap = Math.max(0, Math.round((now - snap.t) / 1000));
      remainingOnCurrent = Math.max(0, leftAtSnap - sinceSnap);
    }
    var beforeYou = snap.s != null ? idx : idx;
    // people ahead in the waiting list before you:
    beforeYou = idx;
    return Math.round(remainingOnCurrent + beforeYou * snap.avg);
  }

  function formatDuration(totalSec, lang) {
    totalSec = Math.max(0, Math.round(totalSec));
    var ar = lang === 'ar';
    if (totalSec < 60) return ar ? 'أقل من دقيقة' : 'under a minute';
    var h = Math.floor(totalSec / 3600);
    var m = Math.round((totalSec % 3600) / 60);
    if (m === 60) { h += 1; m = 0; }
    if (h > 0 && m > 0) return ar ? h + ' س ' + m + ' د' : h + 'h ' + m + 'm';
    if (h > 0) return ar ? h + ' س' : h + 'h';
    if (m === 0) return ar ? 'أقل من دقيقة' : 'under a minute';
    return ar ? m + ' د' : m + ' min';
  }

  return {
    VERSION: VERSION,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    defaultSettings: defaultSettings,
    sanitizeSettings: sanitizeSettings,
    createState: createState,
    findTicket: findTicket,
    takeTicket: takeTicket,
    waitingTickets: waitingTickets,
    callNext: callNext,
    callSpecific: callSpecific,
    recall: recall,
    finishServing: finishServing,
    cancelTicket: cancelTicket,
    learnedAvgSec: learnedAvgSec,
    effectiveAvgSec: effectiveAvgSec,
    peopleAhead: peopleAhead,
    estimateWaitSec: estimateWaitSec,
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    encodeSettingsToken: encodeSettingsToken,
    decodeSettingsToken: decodeSettingsToken,
    encodeSnapshot: encodeSnapshot,
    decodeSnapshot: decodeSnapshot,
    snapshotWaitSec: snapshotWaitSec,
    formatDuration: formatDuration
  };
});
