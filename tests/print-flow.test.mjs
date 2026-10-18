// Printing: headings stay with their content, the totals stay in one piece, the table header repeats,
// and the acceptance block carries the quote number, the customer and the total so it can never
// be a nameless page on its own.
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

const D = { name: 'Smith Electrical Pty Ltd', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', email: 'jo@smithelectrical.com.au', gst: 'Yes', trade: 'Electrician', bank: 'Commonwealth Bank', acct: 'Smith Electrical', bsb: '062-000', acno: '12345678', payid: '0412 345 678', terms: '7' };
const lines = (n) => {
  const t = { n };
  for (let i = 1; i <= n; i++) Object.assign(t, { ['d' + i]: 'Line item number ' + i + ' with a long description that wraps', ['q' + i]: '2', ['p' + i]: '85' });
  return t;
};
const T = {
  Quote: { no: 'Q-001', date: '2026-10-06', cust: 'A. Customer', scope: 'Power points and a switchboard.', incl: 'Materials', excl: 'Painting', dep: '20', bal: 'On completion', ...lines(10) },
  'Tax Invoice': { no: 'INV-014', date: '2026-10-06', cust: 'A. Customer', ...lines(10) },
  Variation: { no: 'V-001', date: '2026-10-06', cust: 'A. Customer', desc: 'Replace conduit', ...lines(10) },
  'Progress Claim': { no: 'PC-1', date: '2026-10-06', cust: 'A. Customer', contract: '1000', pct: '50' },
};

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
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
  await test(label + ': the table header repeats and the totals sit in one piece', async () => {
    const pg = await open(url);
    for (const tab of ['Quote', 'Tax Invoice', 'Variation']) {
      await preview(pg, tab);
      assert.equal(await pg.locator('#paper table thead th').first().textContent(), 'Description', tab);
      assert.equal(await pg.locator('#paper table tbody tr').count(), 10, tab);
      const tot = await pg.locator('#paper .tot').first().textContent();
      assert.match(tot, /Subtotal/, tab);
      assert.match(tot, /TOTAL|THIS VARIATION/, tab);
      await pg.click('#bk');
    }
    await preview(pg, 'Variation');
    assert.match(await pg.locator('#paper .tot').nth(1).textContent(), /NEW TOTAL/);
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': the acceptance block names the quote, the customer and the total', async () => {
    const pg = await open(url);
    await preview(pg, 'Quote');
    const order = await pg.evaluate(() => {
      const ref = document.querySelector('#paper .aref');
      return [ref.nextElementSibling.className, ref.nextElementSibling.nextElementSibling.className, ref.previousElementSibling.className, ref.textContent];
    });
    assert.equal(order[0], 'accept');
    assert.equal(order[1], 'sg');
    assert.match(order[2], /keep/, 'the Variations note travels with the acceptance block');
    assert.match(order[3], /^Quote Q-001 for A\. Customer: total \$[\d,]+\.\d\d \(incl GST\)$/);
    assert.match(await pg.locator('#paper .accept').textContent(), /^I accept this quote\.$/);
    await pg.click('#bk');
    await preview(pg, 'Variation');
    assert.match(await pg.locator('#paper .aref').textContent(), /^Variation V-001 for A\. Customer: this variation \$[\d,]+\.\d\d \(incl GST\)$/);
  });

  await test(label + ': printing keeps headings, totals and signatures from splitting', async () => {
    const pg = await open(url);
    await preview(pg, 'Tax Invoice');
    await pg.emulateMedia({ media: 'print' });
    const r = await pg.evaluate(() => {
      const q = (s) => getComputedStyle(document.querySelector(s));
      return { sec: q('#paper .sec').breakAfter, pd: q('#paper .pd').breakAfter, tot: q('#paper .tot').breakInside, thead: q('#paper thead').display, row: q('#paper tbody tr').breakInside };
    });
    assert.deepEqual(r, { sec: 'avoid', pd: 'avoid', tot: 'avoid', thead: 'table-header-group', row: 'avoid' });
    await pg.emulateMedia({ media: 'screen' });
    await pg.click('#bk');
    await preview(pg, 'Quote');
    await pg.emulateMedia({ media: 'print' });
    const s = await pg.evaluate(() => [getComputedStyle(document.querySelector('#paper .sg')).breakInside, getComputedStyle(document.querySelector('#paper .accept')).breakAfter, getComputedStyle(document.querySelector('#paper .aref')).breakAfter]);
    assert.deepEqual(s, ['avoid', 'avoid', 'avoid']);
  });
}

await test('Pro: the progress claim totals sit in one piece too', async () => {
  const pg = await open('/pro/');
  await preview(pg, 'Progress Claim');
  assert.match(await pg.locator('#paper .tot').first().textContent(), /Contract total[\s\S]*THIS CLAIM[\s\S]*Balance remaining/);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Print flow tests passed');
