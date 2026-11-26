const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../js/queue.js');

test('settings: defaults and sanitization', () => {
  const s = Q.sanitizeSettings({});
  assert.equal(s.lang, 'ar');
  assert.equal(s.avgServiceSec, 300);
  assert.equal(s.autoAvg, true);

  const dirty = Q.sanitizeSettings({
    businessName: 'x'.repeat(500),
    primaryColor: 'not-a-color',
    accentColor: '#a1B2c3',
    lang: 'fr',
    avgServiceSec: 5,
    logoDataUrl: 'javascript:alert(1)',
    services: [{ name: 'Consult', price: 'abc' }, null, { name: 'Lab', nameAr: 'معمل', price: 150.5 }]
  });
  assert.equal(dirty.businessName.length, 60);
  assert.equal(dirty.primaryColor, Q.DEFAULT_SETTINGS.primaryColor);
  assert.equal(dirty.accentColor, '#a1B2c3');
  assert.equal(dirty.lang, 'ar');
  assert.equal(dirty.avgServiceSec, 15); // clamped to min
  assert.equal(dirty.logoDataUrl, '');
  assert.equal(dirty.services.length, 2);
  assert.equal(dirty.services[0].price, 0);
  assert.equal(dirty.services[1].price, 150.5);
});

test('queue: take tickets increments numbers', () => {
  const st = Q.createState(1);
  const t1 = Q.takeTicket(st, 1000);
  const t2 = Q.takeTicket(st, 2000);
  assert.equal(t1.num, 1);
  assert.equal(t2.num, 2);
  assert.equal(st.issued, 2);
  assert.equal(Q.waitingTickets(st).length, 2);
});

test('queue: custom start number', () => {
  const st = Q.createState(50);
  const t = Q.takeTicket(st, 1000);
  assert.equal(t.num, 50);
});

test('queue: call next serves lowest waiting number', () => {
  const st = Q.createState(1);
  Q.takeTicket(st, 1000);
  const t2 = Q.takeTicket(st, 2000);
  const served = Q.callNext(st, 3000);
  assert.equal(served.num, 1);
  assert.equal(st.serving, 1);
  assert.equal(t2.status, 'waiting');
});

test('queue: call next on empty queue keeps current serving', () => {
  const st = Q.createState(1);
  const r = Q.callNext(st, 1000);
  assert.equal(r, null);
  assert.equal(st.serving, null);
  // while serving, an empty queue must not blank the display
  Q.takeTicket(st, 0);
  Q.callNext(st, 1000);
  const r2 = Q.callNext(st, 2000);
  assert.equal(r2, null);
  assert.equal(st.serving, 1);
});

test('queue: finish done learns average service time', () => {
  const st = Q.createState(1);
  Q.takeTicket(st, 0);
  Q.takeTicket(st, 0);
  Q.callNext(st, 100000);
  Q.finishServing(st, 'done', 100000 + 120000); // 120s
  Q.callNext(st, 200000);
  Q.finishServing(st, 'done', 200000 + 240000); // 240s
  assert.equal(Q.learnedAvgSec(st, 300), 180);
});

test('queue: no-show does not affect learned average', () => {
  const st = Q.createState(1);
  Q.takeTicket(st, 0);
  Q.callNext(st, 100000);
  Q.finishServing(st, 'noshow', 100000 + 999999);
  assert.equal(st.history.length, 0);
});

test('queue: recall only while serving', () => {
  const st = Q.createState(1);
  assert.equal(Q.recall(st, 1), false);
  Q.takeTicket(st, 0);
  Q.callNext(st, 1000);
  assert.equal(Q.recall(st, 2000), true);
  assert.equal(st.recalledAt, 2000);
});

test('queue: cancel waiting and serving tickets', () => {
  const st = Q.createState(1);
  const t1 = Q.takeTicket(st, 0);
  const t2 = Q.takeTicket(st, 0);
  Q.callNext(st, 1000);
  assert.equal(Q.cancelTicket(st, t2.num), true);
  assert.equal(Q.cancelTicket(st, t1.num), true);
  assert.equal(st.serving, null);
  assert.equal(Q.cancelTicket(st, 999), false);
});

test('queue: people ahead counts waiting before you plus current', () => {
  const st = Q.createState(1);
  Q.takeTicket(st, 0); // 1
  Q.takeTicket(st, 0); // 2
  const t3 = Q.takeTicket(st, 0); // 3
  Q.callNext(st, 1000); // serving 1
  assert.equal(Q.peopleAhead(st, t3.num), 2); // #1 serving + #2 waiting
  assert.equal(Q.peopleAhead(st, 1), 0); // being served
});

test('estimate: wait = remaining on current + full turns before you', () => {
  const st = Q.createState(1);
  const s = Q.sanitizeSettings({ autoAvg: false, avgServiceSec: 600 });
  Q.takeTicket(st, 0);
  const t2 = Q.takeTicket(st, 0);
  Q.callNext(st, 100000); // serving #1 at t=100s
  // at t=160s: 60 elapsed of 600 => 540 left + 0 extra for #2? #2 is next: 540s
  assert.equal(Q.estimateWaitSec(st, s, t2.num, 160000), 540);
  const t3 = Q.takeTicket(st, 0);
  assert.equal(Q.estimateWaitSec(st, s, t3.num, 160000), 540 + 600);
});

test('estimate: done ticket has zero wait', () => {
  const st = Q.createState(1);
  const t = Q.takeTicket(st, 0);
  Q.callNext(st, 1000);
  Q.finishServing(st, 'done', 2000);
  assert.equal(Q.estimateWaitSec(st, null, t.num, 3000), 0);
});

test('tokens: settings round-trip survives unicode', () => {
  const s = Q.sanitizeSettings({
    businessName: 'Smile Dental', businessNameAr: 'عيادة الأسنان سمايل',
    welcome: 'أهلاً بكم', primaryColor: '#123456', currency: 'SAR',
    services: [{ name: 'Clean', nameAr: 'تنظيف', price: 200 }],
    prefix: 'B', startNumber: 10
  });
  const tok = Q.encodeSettingsToken(s);
  assert.ok(tok.startsWith('d1.'));
  const back = Q.decodeSettingsToken(tok);
  assert.equal(back.businessName, 'Smile Dental');
  assert.equal(back.businessNameAr, 'عيادة الأسنان سمايل');
  assert.equal(back.welcome, 'أهلاً بكم');
  assert.equal(back.primaryColor, '#123456');
  assert.equal(back.services[0].nameAr, 'تنظيف');
  assert.equal(back.prefix, 'B');
  assert.equal(back.startNumber, 10);
});

test('tokens: garbage decodes to null', () => {
  assert.equal(Q.decodeSettingsToken('nope'), null);
  assert.equal(Q.decodeSettingsToken('d1.!!!'), null);
  assert.equal(Q.decodeSnapshot('q1.not-base64!!!'), null);
  assert.equal(Q.decodeSnapshot(''), null);
});

test('tokens: snapshot round-trip and wait estimate', () => {
  const st = Q.createState(1);
  const s = Q.sanitizeSettings({ autoAvg: false, avgServiceSec: 300 });
  Q.takeTicket(st, 0); // 1
  Q.takeTicket(st, 0); // 2
  const t3 = Q.takeTicket(st, 0); // 3
  Q.callNext(st, 1000000); // serving 1
  const snap = Q.encodeSnapshot(st, s, 1100000); // snapshot at t=1100s
  const dec = Q.decodeSnapshot(snap);
  assert.equal(dec.s, 1);
  assert.deepEqual(dec.w, [2, 3]);
  assert.equal(dec.avg, 300);
  // ticket 3 at snapshot time: 200 left on current + 1 full turn = 500
  assert.equal(Q.snapshotWaitSec(dec, t3.num, 1100000), 500);
  // 60s later, dead reckoning: 440
  assert.equal(Q.snapshotWaitSec(dec, t3.num, 1160000), 440);
  // currently-serving ticket waits 0
  assert.equal(Q.snapshotWaitSec(dec, 1, 1160000), 0);
  // unknown/done ticket => null
  assert.equal(Q.snapshotWaitSec(dec, 99, 1160000), null);
});

test('formatDuration: ar and en', () => {
  assert.equal(Q.formatDuration(0, 'en'), 'under a minute');
  assert.equal(Q.formatDuration(59, 'en'), 'under a minute');
  assert.equal(Q.formatDuration(300, 'en'), '5 min');
  assert.equal(Q.formatDuration(300, 'ar'), '5 د');
  assert.equal(Q.formatDuration(3900, 'en'), '1h 5m');
  assert.equal(Q.formatDuration(3600, 'en'), '1h');
});
