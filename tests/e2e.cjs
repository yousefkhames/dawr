/* Local click-through with headless Chrome (dev tool, not shipped). */
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = process.env.OUT || '/tmp';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844']
  });
  const results = [];
  function check(name, ok, extra) {
    results.push({ name, ok, extra });
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : ''));
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  // 1. take page loads in Arabic RTL
  await page.goto(BASE + '/#/take', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  check('take page renders', await page.$eval('.counter', el => !!el).catch(() => false));
  check('RTL default', await page.$eval('html', el => el.dir === 'rtl'));

  // 2. take two tickets
  await page.click('[data-act="take"]');
  await new Promise(r => setTimeout(r, 300));
  const n1 = await page.$eval('.big-number', el => el.textContent.trim());
  check('ticket 1 issued', /1/.test(n1), n1);
  await page.click('[data-act="take"]'); // "take another"
  await new Promise(r => setTimeout(r, 300));
  const n2 = await page.$eval('.big-number', el => el.textContent.trim());
  check('ticket 2 issued', /2/.test(n2), n2);
  await page.screenshot({ path: OUT + '/01-ticket.png' });

  // 3. tracker shows estimate for ticket 2
  await page.goto(BASE + '/#/ticket?n=2', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  const trackTxt = await page.$eval('#app', el => el.textContent);
  check('tracker shows ticket 2', trackTxt.includes('2'), '');
  await page.screenshot({ path: OUT + '/02-track.png' });

  // 4. staff: call next -> serving 1
  await page.goto(BASE + '/#/staff', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.click('[data-act="next"]');
  await new Promise(r => setTimeout(r, 300));
  const serving = await page.$eval('.counter', el => el.textContent.trim());
  check('staff calls next -> serving 1', /1/.test(serving), serving);

  // 5. done, then next -> serving 2
  await page.click('[data-act="done"]');
  await new Promise(r => setTimeout(r, 250));
  await page.click('[data-act="next"]');
  await new Promise(r => setTimeout(r, 300));
  const serving2 = await page.$eval('.counter', el => el.textContent.trim());
  check('done + next -> serving 2', /2/.test(serving2), serving2);
  await page.screenshot({ path: OUT + '/03-staff.png' });

  // 6. tracker for ticket 2 now says your turn
  await page.goto(BASE + '/#/ticket?n=2', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  const track2 = await page.$eval('#app', el => el.textContent);
  check('tracker says your turn', track2.includes('دورك الآن'), '');

  // 7. display screen
  await page.goto(BASE + '/#/display', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  const disp = await page.$eval('.display-shell .counter', el => el.textContent.trim());
  check('display shows serving 2', /2/.test(disp), disp);
  check('QR rendered on display', await page.$('.qr-wrap svg').then(x => !!x));
  await page.screenshot({ path: OUT + '/04-display.png' });

  // 8. settings: change name + colors, save
  await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    document.getElementById('set-nameAr').value = 'مختبر النور';
    document.getElementById('set-nameEn').value = 'Al-Noor Lab';
    document.getElementById('set-primary').value = '#7c3aed';
    document.getElementById('set-welcome').value = 'أهلاً بكم في مختبر النور';
  });
  await page.click('[data-act="save-settings"]');
  await new Promise(r => setTimeout(r, 400));
  await page.goto(BASE + '/#/take', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  const brandName = await page.$eval('.brand h1', el => el.textContent);
  check('branding applied', brandName.includes('مختبر النور'), brandName);
  const primary = await page.$eval('html', el => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
  check('color applied', primary === '#7c3aed', primary);
  const welcomeShown = await page.$eval('#app', el => el.textContent.includes('أهلاً بكم في مختبر النور'));
  check('welcome shown', welcomeShown);
  await page.screenshot({ path: OUT + '/05-branded.png' });

  // 9. English toggle
  await page.click('[data-act="lang"]');
  await new Promise(r => setTimeout(r, 400));
  const enTxt = await page.$eval('#app', el => el.textContent);
  check('English works', enTxt.includes('Take a number') || enTxt.includes('your number'), '');
  check('LTR after toggle', await page.$eval('html', el => el.dir === 'ltr'));
  await page.screenshot({ path: OUT + '/06-english.png' });
  await page.click('[data-act="lang"]');

  // 10. visitor tracker link from staff page QR
  await page.goto(BASE + '/#/staff', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  const built = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('dawr.v1.settings'));
    const st = JSON.parse(localStorage.getItem('dawr.v1.state'));
    const slim = Object.assign({}, s, { logoDataUrl: '' });
    const cfg = DawrCore.encodeSettingsToken(DawrCore.sanitizeSettings(slim));
    const snap = DawrCore.encodeSnapshot(st, s, Date.now());
    return location.origin + location.pathname + '#/ticket?cfg=' + cfg + '&s=' + snap + '&n=2';
  });
  const ctx = await browser.createBrowserContext(); // fresh profile: no shared localStorage
  const visitorPage = await ctx.newPage();
  await visitorPage.setViewport({ width: 390, height: 844, isMobile: true });
  await visitorPage.goto(built, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  const vTxt = await visitorPage.$eval('#app', el => el.textContent);
  check('visitor tracker renders with branding', vTxt.includes('مختبر النور') || vTxt.includes('Al-Noor'), '');
  check('visitor tracker has no staff nav', await visitorPage.$$eval('.footnav a', as => !as.some(a => a.getAttribute('href') === '#/staff')));
  await visitorPage.screenshot({ path: OUT + '/07-visitor.png' });

  // 10b. cross-tab live sync: display tab follows staff tab without reload
  const dispTab = await page.goto(BASE + '/#/display', { waitUntil: 'networkidle0' }).then(() => page);
  await new Promise(r => setTimeout(r, 300));
  const staffTab = await browser.newPage();
  await staffTab.setViewport({ width: 390, height: 844 });
  await staffTab.goto(BASE + '/#/take', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await staffTab.click('[data-act="take"]'); // ticket 3 joins the queue
  await new Promise(r => setTimeout(r, 300));
  await staffTab.goto(BASE + '/#/staff', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await staffTab.click('[data-act="next"]');
  await new Promise(r => setTimeout(r, 800));
  const dispNow = await page.$eval('.display-shell .counter', el => el.textContent.trim());
  check('display tab syncs live via BroadcastChannel', /3/.test(dispNow), dispNow);
  await staffTab.close();

  // 11. reset day works (clear for demo screenshots)
  await page.goto(BASE + '/#/staff', { waitUntil: 'networkidle0' });
  page.on('dialog', d => d.accept());
  await page.click('[data-act="reset"]');
  await new Promise(r => setTimeout(r, 300));
  const afterReset = await page.$eval('.counter', el => el.textContent.trim());
  check('reset clears serving', afterReset.includes('—'), afterReset);

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('E2E crash:', e); process.exit(2); });
