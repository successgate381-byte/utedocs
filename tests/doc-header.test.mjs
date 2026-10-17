// Finished documents: title on its own line at the very top, business details together in one block,
// number-and-dates strip, compact payment block, and the footer (Lite brand line, Pro nothing).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('  ok    ' + name);
  } catch (e) {
    failed++;
    console.error('  FAIL  ' + name + '\n        ' + String(e.message).split('\n').slice(0, 6).join('\n        '));
  }
}

const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

const D = { name: 'Smith Electrical Pty Ltd', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', email: 'jo@smithelectrical.com.au', gst: 'Yes', trade: 'Electrician', bank: 'Commonwealth Bank', acct: 'Smith Electrical', bsb: '062-000', acno: '12345678', payid: '0412 345 678', terms: '7' };
const line = { d1: 'Replace mixer tap', q1: '1', p1: '120' };
const T = {
  Quote: { no: 'Q-001', date: '2026-10-06', cust: 'A. Customer', ...line },
  'Tax Invoice': { no: 'INV-014', date: '2026-10-06', cust: 'A. Customer', ...line },
  Invoice: { no: 'INV-015', date: '2026-10-06', cust: 'A. Customer', ...line },
  Variation: { no: 'V-001', date: '2026-10-06', cust: 'A. Customer', ...line },
};

async function open(url, kind = DESKTOP) {
  const ctx = await browser.newContext(kind);
  await ctx.addInitScript(([d, t]) => localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: t })), [D, T]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const preview = async (pg, name) => {
  await pg.click(`nav button[data-t="${name}"]`);
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': every document starts with its title on its own line, above the business block', async () => {
    const pg = await open(url);
    for (const [tab, title] of [['Quote', 'QUOTE'], ['Tax Invoice', 'TAX INVOICE'], ['Invoice', 'INVOICE'], ['Variation', 'VARIATION']]) {
      await preview(pg, tab);
      const r = await pg.evaluate(() => {
        const p = document.getElementById('paper');
        const [a, b, c] = [...p.children];
        const box = (e) => e.getBoundingClientRect();
        return {
          first: a.className, second: b.className, third: c ? c.className : '',
          title: a.textContent, ttlBottom: box(a).bottom, lhTop: box(b).top,
          lh: b.textContent, size: parseFloat(getComputedStyle(a).fontSize), mt: c ? c.textContent : '',
          bands: p.querySelectorAll('.band').length, titleInsideBlock: !!b.querySelector('.ttl'),
        };
      });
      assert.equal(r.first, 'ttl', tab + ': the title must be the very first thing');
      assert.equal(r.title, title);
      assert.equal(r.second, 'lh', tab + ': the business block comes second');
      assert.equal(r.third, 'mt', tab + ': the number-and-dates strip comes third');
      assert.ok(r.ttlBottom <= r.lhTop + 1, tab + ': the title must sit above the business block');
      assert.equal(r.titleInsideBlock, false, tab + ': the title must not share the business block');
      assert.ok(r.size >= 24, tab + ': the title should be large, it is ' + r.size + 'px');
      for (const s of ['Smith Electrical Pty Ltd', 'ABN', '51 824 753 556', 'Licence', 'EC12345', 'Phone', '0412 345 678', 'Email', 'jo@smithelectrical.com.au']) assert.ok(r.lh.includes(s), tab + ': the business block is missing ' + s);
      assert.ok(r.mt.includes('6 Oct 2026'), tab + ': the strip should hold the date');
      assert.equal(r.bands, 0, tab + ': the old shared title bar should be gone');
      await pg.click('#bk');
    }
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': on a phone the top fits, with no sideways scroll, and the payment block is two columns and short', async () => {
    const pg = await open(url, PHONE);
    await preview(pg, 'Tax Invoice');
    const r = await pg.evaluate(() => {
      const lh = document.querySelector('#paper .lh').getBoundingClientRect();
      const pd = document.querySelector('#paper .pd');
      return {
        lhHeight: lh.height, cols: getComputedStyle(pd).gridTemplateColumns.split(' ').length, pdHeight: pd.getBoundingClientRect().height,
        wide: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    assert.ok(r.lhHeight < 150, 'the business block is too tall on a phone: ' + r.lhHeight);
    assert.equal(r.cols, 2, 'payment details should keep two columns on a phone');
    assert.ok(r.pdHeight < 170, 'payment details are still too tall: ' + r.pdHeight);
    assert.ok(r.wide <= 0, 'the page scrolls sideways by ' + r.wide);
  });
}

await test('footer: Lite shows a small "Made with UteDocs" mark, Pro shows nothing, and neither prints the old disclaimer', async () => {
  const lite = await open('/app/');
  await preview(lite, 'Tax Invoice');
  assert.equal(await lite.locator('#paper .made').count(), 1);
  assert.match(await lite.locator('#paper .made').textContent(), /Made with UteDocs/);
  assert.equal(await lite.locator('#paper .made svg').count(), 1, 'the logo is missing');
  assert.equal(await lite.locator('#paper img').count(), 0, 'the preview must hold no picture tags');
  assert.ok(!(await lite.locator('#paper').textContent()).includes('General template'));
  const pro = await open('/pro/');
  await preview(pro, 'Tax Invoice');
  assert.equal(await pro.locator('#paper .made').count(), 0);
  assert.ok(!(await pro.locator('#paper').textContent()).includes('General template'));
  assert.ok(!(await pro.locator('#paper').textContent()).includes('Made with UteDocs'));
});

await test('Pro: Progress Claim and Photos documents share the same top and print no footer', async () => {
  const pg = await open('/pro/');
  for (const [tab, title] of [['Progress Claim', 'PROGRESS CLAIM'], ['Photos', 'JOB PHOTOS']]) {
    await preview(pg, tab);
    const r = await pg.evaluate(() => [...document.getElementById('paper').children].slice(0, 2).map((e) => e.className + ':' + e.textContent.slice(0, 30)));
    assert.equal(r[0], 'ttl:' + title);
    assert.ok(r[1].startsWith('lh:Smith Electrical'));
    assert.equal(await pg.locator('#paper .made').count(), 0);
    await pg.click('#bk');
  }
});

await test('Print: a Lite tax invoice with six lines and the footer is still one A4 page', async () => {
  const pg = await open('/app/');
  await pg.click('nav button[data-t="Tax Invoice"]');
  for (let i = 1; i <= 6; i++) {
    await pg.fill(`[data-k="d${i}"]`, 'Item number ' + i);
    await pg.fill(`[data-k="q${i}"]`, '2');
    await pg.fill(`[data-k="p${i}"]`, '45.50');
  }
  await pg.emulateMedia({ media: 'print' });
  const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Document top tests passed');
