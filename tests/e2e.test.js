const assert = require('node:assert/strict'), { serve, launch } = require('./cdp.js');
(async () => {
  const srv = await serve(8133); const b = await launch(); let fail = 0; const U = 'http://127.0.0.1:8133/';
  const step = async (n, f) => { try { await f(); console.log('ok  ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' ' + e.message); } };
  const txt = (s) => b.eval('document.querySelector(' + JSON.stringify(s) + ').textContent');
  const go = async (h, sel) => { await b.eval('location.hash=' + JSON.stringify(h)); await b.waitFor('document.querySelector(' + JSON.stringify(sel) + ')'); };
  const issue = async (svc, label) => { await go('#/reception', '#issue-' + svc); if (label) await b.type('#lbl-' + svc, label); await b.click('#issue-' + svc); await b.waitFor("document.querySelector('#link')"); return b.eval("document.querySelector('#link').value"); };
  try {
    await b.goto(U);
    await step('demo banner, services, no invented averages, byline', async () => { const t = await b.text(); assert.match(t, /بيانات تجريبية/); assert.match(t, /شباك تجريبي 1/); assert.match(t, /لا توجد بيانات كافية/); assert.doesNotMatch(t, /متوسط الانتظار: \d/); assert.match(t, /من تطوير يوسف خميس/); });
    await step('issue tickets with QR, numbering', async () => { const l1 = await issue('desk1', 'Demo person A'); assert.ok(await b.eval("!!document.querySelector('#slip .qrbox svg path')")); assert.equal(await txt('#slip-num'), '1'); assert.match(l1, /#\/t\//); globalThis.L1 = l1; await issue('desk1'); await issue('desk1'); assert.equal(await txt('#slip-num'), '3'); });
    await step('call next, call disabled while serving, done frees it', async () => {
      await b.click('#call-desk1'); await b.waitFor("document.querySelector('#now-desk1').textContent==='1'"); assert.ok(await b.eval("document.querySelector('#call-desk1').disabled"));
      await b.click('#done-desk1'); await b.waitFor("!document.querySelector('#done-desk1')"); await b.click('#call-desk1'); await b.waitFor("document.querySelector('#now-desk1').textContent==='2'");
    });
    await step('skip serving then recall', async () => { await b.click('#skipc-desk1'); await b.waitFor("document.querySelector('#now-desk1').textContent==='—'"); await b.click('button', 'إعادة للطابور'); await b.click('#call-desk1'); await b.waitFor("document.querySelector('#now-desk1').textContent==='2'"); });
    await step('customer link: ahead count, no minutes without data, snapshot note', async () => {
      const l3 = await issue('desk1'); await go(l3.slice(l3.indexOf('#')), '#my-num'); assert.equal(await txt('#my-num'), '4'); assert.match(await txt('#c-state'), /قبلك 2/); assert.match(await txt('#c-est'), /لا يوجد تقدير/); assert.match(await txt('#c-age'), /ليست مباشرة/);
    });
    await step('customer pasting a newer link and invalid links', async () => { await b.type('#paste', 'garbage'); await b.click('#open'); await b.waitFor("document.querySelector('#bad')"); await b.type('#paste', globalThis.L1); await b.click('#open'); await b.waitFor("document.querySelector('#my-num')"); assert.equal(await txt('#my-num'), '1'); });
    await step('display screen shows now serving', async () => { await go('#/display', '#d-desk1'); assert.equal(await txt('#d-desk1'), '2'); assert.equal(await txt('#d-desk2'), '—'); });
    await step('stats appear only after 3 recorded tickets', async () => {
      await go('#/reception', '#call-desk2'); for (let i = 0; i < 3; i++) { await issue('desk2'); await b.click('#call-desk2'); await b.waitFor("document.querySelector('#done-desk2')"); await b.click('#done-desk2'); await b.waitFor("!document.querySelector('#done-desk2')"); }
      assert.match(await txt('#stats-desk2'), /متوسط الانتظار: [\d٠-٩]/); assert.match(await txt('#stats-desk1'), /لا توجد بيانات كافية/);
    });
    await step('add and remove a service; clear demo data', async () => {
      await b.type('#svc-ar', 'طبيب تجريبي'); await b.click('#svc-add'); await b.waitFor("document.body.innerText.includes('طبيب تجريبي')"); await b.click('button', 'حذف الخدمة: طبيب تجريبي'); await b.waitFor("!document.body.innerText.includes('طبيب تجريبي')");
      await b.eval('window.confirm=()=>true'); await b.click('#clean'); await b.waitFor("!document.querySelector('#clean')"); assert.doesNotMatch(await b.text(), /بيانات تجريبية:/);
    });
    await step('no script errors', async () => assert.deepEqual(b.logs, []));
    await b.eval("localStorage.clear();location.hash='#/reception'"); await b.eval('location.reload()'); await new Promise((r) => setTimeout(r, 800)); await b.viewport(412, 860, true);
    await issue('desk1', 'Demo A'); await issue('desk1', 'Demo B'); await issue('desk1', 'Demo C'); await b.click('#call-desk1'); await b.waitFor("document.querySelector('#done-desk1')"); await b.shot('/tmp/dawr-reception.png');
    const l = await issue('desk1'); await go(l.slice(l.indexOf('#')), '#my-num'); await b.shot('/tmp/dawr-ticket.png');
    await b.viewport(1200, 700, false); await go('#/display', '#d-desk1'); await b.shot('/tmp/dawr-display.png');
  } finally { await b.close(); srv.close(); }
  process.exit(fail ? 1 : 0);
})();
