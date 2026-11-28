/* MIT · Copyright (c) 2026 Yousef Khames · dawr core: queue logic, timing stats and ticket snapshots (browser and Node). */
(function (root) {
  'use strict';
  const MIN_SAMPLES = 3;
  const newState = () => ({ services: [], tickets: [], next: {}, day: null });
  const svc = (st, id) => st.services.find((s) => s.id === id);
  const byService = (st, id) => st.tickets.filter((t) => t.s === id);
  function addService(st, id, name) {
    if (!id || svc(st, id)) return { ok: false, error: 'dup' };
    const ar = String(name.ar || name.en || '').trim().slice(0, 40), en = String(name.en || name.ar || '').trim().slice(0, 40);
    if (!ar) return { ok: false, error: 'name' };
    st.services.push({ id, name: { ar, en } }); st.next[id] = st.next[id] || 1; return { ok: true };
  }
  function removeService(st, id) {
    if (byService(st, id).some((t) => t.status === 'waiting' || t.status === 'serving')) return { ok: false, error: 'busy' };
    st.services = st.services.filter((s) => s.id !== id); st.tickets = st.tickets.filter((t) => t.s !== id); delete st.next[id]; return { ok: true };
  }
  function issue(st, sid, now, who, demo) {
    if (!svc(st, sid)) return { ok: false, error: 'service' };
    const n = st.next[sid] || 1; st.next[sid] = n + 1;
    const t = { id: sid + '-' + n, s: sid, n, status: 'waiting', at: now, label: String((who && who.label) || '').trim().slice(0, 30), phone: String((who && who.phone) || '').trim().slice(0, 20), demo: !!demo };
    st.tickets.push(t); return { ok: true, ticket: t };
  }
  const serving = (st, sid) => byService(st, sid).find((t) => t.status === 'serving') || null;
  const waiting = (st, sid) => byService(st, sid).filter((t) => t.status === 'waiting').sort((a, b) => a.n - b.n);
  const skipped = (st, sid) => byService(st, sid).filter((t) => t.status === 'skipped').sort((a, b) => a.n - b.n);
  function callNext(st, sid, now) {
    if (serving(st, sid)) return { ok: false, error: 'busy' };
    const w = waiting(st, sid)[0]; if (!w) return { ok: false, error: 'empty' };
    w.status = 'serving'; w.calledAt = now; w.calls = (w.calls || 0) + 1; return { ok: true, ticket: w };
  }
  function resolve(st, tid, kind, now) {
    const t = st.tickets.find((x) => x.id === tid); if (!t) return { ok: false, error: 'missing' };
    if (kind === 'recall') { if (t.status !== 'skipped') return { ok: false, error: 'state' }; t.status = 'waiting'; return { ok: true }; }
    if (kind === 'skip') { if (t.status !== 'serving' && t.status !== 'waiting') return { ok: false, error: 'state' }; t.status = 'skipped'; return { ok: true }; }
    if (t.status !== 'serving') return { ok: false, error: 'state' };
    if (kind === 'done') { t.status = 'done'; t.doneAt = now; return { ok: true }; }
    if (kind === 'noshow') { t.status = 'noshow'; t.doneAt = now; return { ok: true }; }
    return { ok: false, error: 'kind' };
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  /* Averages come only from recorded timestamps and need MIN_SAMPLES tickets; otherwise null (never invented). */
  function stats(st, sid) {
    const ts = byService(st, sid), waits = ts.filter((t) => t.calledAt != null && t.calls === 1).map((t) => (t.calledAt - t.at) / 60000), times = ts.filter((t) => t.status === 'done' && t.calledAt != null && t.doneAt != null).map((t) => (t.doneAt - t.calledAt) / 60000);
    const c = (k) => ts.filter((t) => t.status === k).length;
    return { issued: ts.length, waiting: c('waiting'), serving: c('serving'), done: c('done'), noshow: c('noshow'), skipped: c('skipped'), waitSamples: waits.length, timeSamples: times.length,
      waitAvg: waits.length >= MIN_SAMPLES ? mean(waits) : null, serviceAvg: times.length >= MIN_SAMPLES ? mean(times) : null };
  }
  const ahead = (st, sid, n) => byService(st, sid).filter((t) => (t.status === 'waiting' && t.n < n) || t.status === 'serving').length;
  const lastCalled = (st, sid) => byService(st, sid).reduce((m, t) => (t.calledAt != null && t.n > m ? t.n : m), 0);
  const b64u = {
    enc: (s) => { const b = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(String.fromCharCode(...new TextEncoder().encode(s))); return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec: (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); return typeof Buffer !== 'undefined' ? Buffer.from(p, 'base64').toString('utf8') : new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0))); }
  };
  /* A ticket link carries a snapshot only: number, who was called last, how many were ahead, time taken. */
  function snapshot(st, ticket, shopId, now) {
    const s = svc(st, ticket.s), sv = stats(st, ticket.s);
    return { v: 1, k: String(shopId), s: ticket.s, l: [s ? s.name.ar : '', s ? s.name.en : ''], n: ticket.n, w: lastCalled(st, ticket.s), a: ahead(st, ticket.s, ticket.n), t: now, m: sv.serviceAvg == null ? null : Math.round(sv.serviceAvg * 10) / 10 };
  }
  const encode = (snap) => b64u.enc(JSON.stringify(snap));
  function decode(text) {
    try {
      const o = JSON.parse(b64u.dec(String(text).trim()));
      const num = (x) => Number.isInteger(x) && x >= 0 && x < 1e6;
      if (!o || o.v !== 1 || typeof o.k !== 'string' || typeof o.s !== 'string' || !Array.isArray(o.l) || o.l.length !== 2 || !o.l.every((x) => typeof x === 'string' && x.length <= 40) || !num(o.n) || !num(o.w) || !num(o.a) || !Number.isFinite(o.t)) return null;
      if (o.m != null && !(typeof o.m === 'number' && o.m >= 0 && o.m < 1e4)) return null;
      return { v: 1, k: o.k.slice(0, 40), s: o.s.slice(0, 40), l: o.l, n: o.n, w: o.w, a: o.a, t: o.t, m: o.m == null ? null : o.m };
    } catch (e) { return null; }
  }
  /* What the customer sees. minutes only when the shop has enough recorded service times. */
  function view(snap, now) {
    const ageMin = Math.max(0, Math.round((now - snap.t) / 60000));
    if (snap.n <= snap.w && snap.a === 0) return { state: 'called', ageMin, ahead: 0, minutes: null };
    return { state: snap.a === 0 ? 'next' : 'wait', ageMin, ahead: snap.a, minutes: snap.m == null ? null : Math.ceil(snap.a * snap.m) };
  }
  const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csv(st) {
    const iso = (x) => (x == null ? '' : new Date(x).toISOString());
    const rows = [['service', 'number', 'status', 'issued_at', 'called_at', 'finished_at', 'demo']].concat(st.tickets.map((t) => [t.s, t.n, t.status, iso(t.at), iso(t.calledAt), iso(t.doneAt), t.demo ? 'yes' : 'no']));
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  }
  const api = { MIN_SAMPLES, newState, addService, removeService, issue, serving, waiting, skipped, callNext, resolve, stats, ahead, lastCalled, snapshot, encode, decode, view, csv, byService, svc, b64u };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.DawrCore = api;
})(globalThis);
