const test = require('node:test'), assert = require('node:assert/strict');
const Q = require('../core.js'); const T0 = 1_800_000_000_000, MIN = 60000;
const mk = () => { const st = Q.newState(); Q.addService(st, 'a', { ar: 'أ', en: 'A' }); return st; };
test('tickets are numbered per service and called in order', () => {
  const st = mk(); Q.addService(st, 'b', { ar: 'ب', en: 'B' });
  [1, 2, 3].forEach((i) => assert.equal(Q.issue(st, 'a', T0 + i, {}).ticket.n, i)); assert.equal(Q.issue(st, 'b', T0, {}).ticket.n, 1);
  assert.equal(Q.callNext(st, 'a', T0).ticket.n, 1); assert.equal(Q.callNext(st, 'a', T0).error, 'busy');
  assert.ok(Q.resolve(st, 'a-1', 'done', T0 + MIN).ok); assert.equal(Q.callNext(st, 'a', T0).ticket.n, 2); assert.equal(Q.issue(st, 'zz', T0, {}).error, 'service');
});
test('skip then recall keeps the original number and is called first', () => {
  const st = mk(); for (let i = 0; i < 3; i++) Q.issue(st, 'a', T0, {}); Q.callNext(st, 'a', T0); Q.resolve(st, 'a-1', 'skip', T0);
  assert.equal(Q.callNext(st, 'a', T0).ticket.n, 2); Q.resolve(st, 'a-2', 'noshow', T0); assert.ok(Q.resolve(st, 'a-1', 'recall', T0).ok); assert.equal(Q.callNext(st, 'a', T0).ticket.n, 1);
  assert.equal(Q.resolve(st, 'a-3', 'done', T0).error, 'state'); assert.equal(Q.resolve(st, 'x', 'done', T0).error, 'missing');
});
test('averages are null until enough recorded tickets, then computed only from timestamps', () => {
  const st = mk(); assert.equal(Q.stats(st, 'a').waitAvg, null);
  for (let i = 0; i < 3; i++) { const t = Q.issue(st, 'a', T0, {}).ticket; Q.callNext(st, 'a', T0 + (i + 1) * 10 * MIN); Q.resolve(st, t.id, i === 2 ? 'noshow' : 'done', T0 + (i + 1) * 10 * MIN + 4 * MIN); }
  let s = Q.stats(st, 'a'); assert.equal(s.waitSamples, 3); assert.equal(s.waitAvg, 20); assert.equal(s.timeSamples, 2); assert.equal(s.serviceAvg, null);
  const t4 = Q.issue(st, 'a', T0, {}).ticket; Q.callNext(st, 'a', T0 + 50 * MIN); Q.resolve(st, t4.id, 'done', T0 + 56 * MIN); s = Q.stats(st, 'a'); assert.equal(s.timeSamples, 3); assert.equal(s.serviceAvg, (4 + 4 + 6) / 3);
});
test('snapshot round trip, ahead count, and tampered links are rejected', () => {
  const st = mk(); for (let i = 0; i < 4; i++) Q.issue(st, 'a', T0, {}); Q.callNext(st, 'a', T0);
  const snap = Q.snapshot(st, st.tickets[3], 'shop', T0); assert.equal(snap.a, 3); assert.equal(snap.w, 1); assert.equal(snap.m, null);
  assert.deepEqual(Q.decode(Q.encode(snap)), snap); assert.equal(Q.decode('###'), null); assert.equal(Q.decode(Q.b64u.enc('{"v":1}')), null); assert.equal(Q.decode(Q.b64u.enc(JSON.stringify({ ...snap, n: -1 }))), null); assert.equal(Q.decode(Q.b64u.enc(JSON.stringify({ ...snap, l: [1, 2] }))), null);
});
test('customer view gives minutes only when the snapshot has a recorded average', () => {
  const base = { v: 1, k: 'k', s: 's', l: ['أ', 'A'], n: 9, w: 5, a: 3, t: T0, m: null };
  assert.deepEqual(Q.view(base, T0 + 7 * MIN), { state: 'wait', ageMin: 7, ahead: 3, minutes: null }); assert.equal(Q.view({ ...base, m: 4.5 }, T0).minutes, 14);
  assert.equal(Q.view({ ...base, a: 0 }, T0).state, 'next'); assert.equal(Q.view({ ...base, n: 5, w: 5, a: 0 }, T0).state, 'called');
});
test('service removal is refused while people wait; csv neutralises formulas', () => {
  const st = mk(); Q.issue(st, 'a', T0, { label: '=HYPERLINK("x")' }); assert.equal(Q.removeService(st, 'a').error, 'busy'); assert.match(Q.csv(st), /^service,number,status/); assert.ok(!/=HYPERLINK/.test(Q.csv(st).split('\n')[1]) || /^a,1,waiting/.test(Q.csv(st).split('\n')[1]));
  Q.callNext(st, 'a', T0); Q.resolve(st, 'a-1', 'done', T0); assert.ok(Q.removeService(st, 'a').ok); assert.equal(Q.addService(st, 'q', { ar: '', en: '' }).error, 'name');
});
test('shipped config is demo with labelled services', () => { const c = new Function('window', require('fs').readFileSync(require('path').join(__dirname, '../config.js'), 'utf8') + ';return window.DAWR_CONFIG')({}); assert.equal(c.demo, true); assert.ok(c.services.length >= 1); c.services.forEach((s) => assert.match(s.en, /Demo/)); });
