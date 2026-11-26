/* Capture polished screenshots for the README (dev tool). */
const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:8123';
const OUT = process.env.OUT || 'screenshots';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  // seed: branding + a realistic queue
  await page.goto(BASE + '/#/take', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('dawr.v1.settings'));
    s.businessNameAr = 'عيادة الشفاء';
    s.businessName = 'El-Shefa Clinic';
    s.welcome = 'أهلاً بك في عيادة الشفاء — خذ رقمك وارتاح، إحنا هناديك';
    s.announcement = 'الكشف اليوم حتى الساعة ٩ مساءً — التحاليل تُستلم من الشباك ٢';
    s.ticketNote = 'لو رقمك اتنده وما حضرتش خلال ٥ دقائق، هيتم تخطيه';
    s.services = [
      { id: 'a', name: 'Consultation', nameAr: 'كشف', price: 250 },
      { id: 'b', name: 'Follow-up', nameAr: 'متابعة', price: 150 },
      { id: 'c', name: 'Lab', nameAr: 'تحاليل', price: 300 }
    ];
    localStorage.setItem('dawr.v1.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // take 4 tickets, serve 1
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.querySelector('[data-act="take"]').click());
    await new Promise(r => setTimeout(r, 250));
  }
  await page.goto(BASE + '/#/staff', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.click('[data-act="next"]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: OUT + '/staff.png' });

  await page.goto(BASE + '/#/take', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: OUT + '/kiosk.png' });

  await page.goto(BASE + '/#/display', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: OUT + '/display.png' });

  await page.goto(BASE + '/#/ticket?n=3', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: OUT + '/tracker.png' });

  await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: OUT + '/settings.png', fullPage: true });

  await browser.close();
  console.log('shots saved');
})().catch(e => { console.error(e); process.exit(1); });
