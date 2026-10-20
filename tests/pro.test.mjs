// Pro tests. The Pro page must run everything Lite does, plus its own touches.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

const TABS = ['Start Here', 'My Details', 'Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Rate Calculator', 'Line Items', 'Worked Examples', 'Forms'];
const PRO_TABS = ['Start Here', 'My Details', 'Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Progress Claim', 'Photos', 'Rate Calculator', 'Line Items', 'Worked Examples', 'Forms'];
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const LITE = ORIGIN + '/app/';
const PRO = ORIGIN + '/pro/';
const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

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

/** Open a page in a profile, watching for errors and requests to other websites. */
async function open(url, kind = DESKTOP, context) {
  const ctx = context || (await browser.newContext(kind));
  const page = await ctx.newPage();
  page.problems = [];
  page.outside = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('response', (r) => r.status() >= 400 && page.problems.push(r.status() + ' ' + r.url()));
  page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && page.outside.push(r.url()));
  await page.goto(url);
  await page.waitForSelector('nav button');
  return page;
}
const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const text = (pg, id) => pg.evaluate((i) => (document.getElementById(i) ? document.getElementById(i).textContent : null), id);
const line = (pg, i, d, q, p) => pg.fill(`[data-k="d${i}"]`, d).then(() => pg.fill(`[data-k="q${i}"]`, q)).then(() => pg.fill(`[data-k="p${i}"]`, p));

for (const [label, kind] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  await test(`Pro opens clean on ${label}: nine tabs, PRO badge, no errors, nothing sent out`, async () => {
    const pg = await open(PRO, kind);
    assert.equal(await pg.locator('.top .pro-badge').textContent(), 'PRO');
    assert.deepEqual(await pg.locator('nav button').allTextContents(), PRO_TABS);
    for (const t of PRO_TABS) {
      await tab(pg, t);
      const b = await pg.evaluate(() => document.getElementById('m').textContent || '');
      assert.ok(!/undefined|NaN|\[object/.test(b), t + ': shows undefined or NaN');
      assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, t + ': sideways scroll');
    }
    assert.deepEqual(pg.problems, []);
    assert.deepEqual(pg.outside, []);
  });
}

await test('the extension points work in Pro and change nothing in Lite', async () => {
  const lite = await open(LITE);
  const pro = await open(PRO);
  assert.equal(await lite.locator('.band b').first().textContent(), 'UTEDOCS');
  assert.equal(await pro.locator('.band b').first().textContent(), 'UTEDOCS PRO');
  assert.equal(await lite.locator('.pro-badge').count(), 0);
  assert.deepEqual(await lite.locator('nav button').allTextContents(), TABS);
});

await test('every item on the old lock list is present inside Pro too', async () => {
  const lock = JSON.parse(readFileSync('tests/lock.json', 'utf8'));
  const pg = await open(PRO);
  const seen = { text: '', keys: new Set(), ids: new Set() };
  for (const trade of ['Electrician', 'Plumber', 'Other']) {
    await tab(pg, 'My Details');
    await pg.selectOption('#i-trade', trade);
    for (const t of TABS) {
      await tab(pg, t);
      if (t === 'Variation') await pg.selectOption('#i-why', 'Other');
      const r = await pg.evaluate(() => ({
        text: document.body.textContent + ' ' + [...document.querySelectorAll('[placeholder]')].map((e) => e.getAttribute('placeholder')).join(' | '),
        keys: [...document.querySelectorAll('#m [data-k]')].map((e) => e.dataset.k),
        ids: [...document.querySelectorAll('#m [id]')].map((e) => e.id),
      }));
      seen.text += ' ' + r.text;
      r.keys.forEach((k) => seen.keys.add(k));
      r.ids.forEach((i) => seen.ids.add(i));
      if (['Quote', 'Tax Invoice', 'Invoice', 'Variation'].includes(t)) {
        await pg.click('#pv');
        seen.text += ' ' + (await pg.evaluate(() => document.getElementById('paper').textContent));
        await pg.click('#bk');
      }
    }
  }
  const flat = seen.text.replace(/\s+/g, ' ');
  assert.deepEqual(lock.strings.filter((s) => !flat.includes(s.replace(/\s+/g, ' ').trim())), [], 'texts that went missing');
  assert.deepEqual(lock.keys.filter((k) => !seen.keys.has(k)), [], 'fields that went missing');
  assert.deepEqual(lock.ids.filter((i) => !seen.ids.has(i)), [], 'buttons that went missing');
});

await test('Pro does the same sums, preview and signature-above-the-line as Lite', async () => {
  const pg = await open(PRO, PHONE);
  await tab(pg, 'Tax Invoice');
  await line(pg, 1, 'Switchboard upgrade', '1', '1350');
  await line(pg, 2, 'Labour', '4', '110');
  assert.deepEqual([await text(pg, 't1'), await text(pg, 't3'), await text(pg, 't4')], ['$1,790.00', '$179.00', '$1,969.00']);
  await tab(pg, 'Quote');
  await pg.fill('#i-an', 'A. Customer');
  const box = await pg.locator('#i-an').boundingBox();
  const label = await pg.locator('label[for="i-an"]').boundingBox();
  assert.ok(box && label && box.y + box.height <= label.y + 1, 'typed name is not above the line in Pro');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .sg .c em').first().textContent(), 'A. Customer');
});

await test('Pro and Lite share the same saved details on one device', async () => {
  const ctx = await browser.newContext(DESKTOP);
  const lite = await open(LITE, DESKTOP, ctx);
  await tab(lite, 'My Details');
  await lite.fill('#i-name', 'Smith Electrical');
  const pro = await open(PRO, DESKTOP, ctx);
  await tab(pro, 'My Details');
  assert.equal(await pro.inputValue('#i-name'), 'Smith Electrical');
});

await test('Pro files get the same security headers', async () => {
  const res = await fetch(PRO);
  assert.match(res.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
});

await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' Pro test(s) failed');
  process.exit(1);
}
console.log('Pro tests passed');
