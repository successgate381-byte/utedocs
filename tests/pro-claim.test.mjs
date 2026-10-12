// P3 tests: the Progress Claim tab (Pro only).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { claimMaths } from '../site/pro/js/claim-math.js';

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

/* ---------- the sums, no browser ---------- */
const base = { contract: '$10,000.00', pct: '40', prev: '', registered: true, gstRate: 0.1 };

await test('maths: 40% of $10,000 with GST inside the claim', () => {
  const m = claimMaths(base);
  assert.deepEqual([m.toDate, m.thisClaim, m.gst, m.exGst, m.remaining], [4000, 4000, 363.64, 3636.36, 6000]);
  assert.equal(m.exGst + m.gst, m.thisClaim);
  assert.equal(m.warning, '');
});

await test('maths: earlier claims come off, GST follows the new amount', () => {
  const m = claimMaths({ ...base, prev: '$1,000.00' });
  assert.deepEqual([m.thisClaim, m.gst, m.exGst, m.remaining], [3000, 272.73, 2727.27, 6000]);
});

await test('maths: not registered means no GST', () => {
  const m = claimMaths({ ...base, registered: false });
  assert.deepEqual([m.gst, m.exGst, m.thisClaim], [0, 4000, 4000]);
});

await test('maths: quote total example, half done', () => {
  const m = claimMaths({ contract: '511.5', pct: '50', prev: '0', registered: true, gstRate: 0.1 });
  assert.deepEqual([m.toDate, m.thisClaim, m.gst, m.exGst, m.remaining], [255.75, 255.75, 23.25, 232.5, 255.75]);
});

await test('maths: over 100% is held at 100% with a warning, and too many earlier claims warn', () => {
  const a = claimMaths({ ...base, pct: '150' });
  assert.deepEqual([a.percent, a.toDate, a.remaining], [100, 10000, 0]);
  assert.match(a.warning, /cannot be more than 100%/);
  const b = claimMaths({ ...base, pct: '10', prev: '2000' });
  assert.equal(b.thisClaim, -1000);
  assert.match(b.warning, /earlier claims are more than the work done/);
  const c = claimMaths({ contract: '', pct: '', prev: '', registered: true, gstRate: 0.1 });
  assert.deepEqual([c.toDate, c.thisClaim, c.remaining, c.warning], [0, 0, 0, '']);
});

/* ---------- the tab in a real browser ---------- */
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

async function open(url, kind = DESKTOP) {
  const page = await (await browser.newContext(kind)).newPage();
  page.problems = [];
  page.outside = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && page.outside.push(r.url()));
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const text = (pg, id) => pg.evaluate((i) => (document.getElementById(i) ? document.getElementById(i).textContent : null), id);
const paper = (pg) => pg.evaluate(() => document.getElementById('paper').textContent || '');
async function details(pg) {
  await tab(pg, 'My Details');
  await pg.fill('#i-name', 'Smith Electrical');
  await pg.fill('#i-abn', '51824753556');
  await pg.fill('#i-phone', '0412 345 678');
  await pg.fill('#i-bank', 'Commonwealth Bank');
  await pg.fill('#i-bsb', '062000');
  await pg.fill('#i-acno', '12345678');
  await pg.click('#i-name');
}

await test('the tab sits right after Variation, in Pro only', async () => {
  const pro = await open('/pro/');
  const names = await pro.locator('nav button').allTextContents();
  assert.equal(names[names.indexOf('Variation') + 1], 'Progress Claim');
  assert.equal(names.length, 11);
  const lite = await open('/app/');
  assert.equal((await lite.locator('nav button').allTextContents()).includes('Progress Claim'), false);
});

for (const [label, kind] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  await test(`Progress Claim opens clean on ${label}`, async () => {
    const pg = await open('/pro/', kind);
    await details(pg);
    await tab(pg, 'Progress Claim');
    const b = await pg.evaluate(() => document.getElementById('m').textContent || '');
    assert.ok(!/undefined|NaN|\[object/.test(b), 'shows undefined or NaN');
    assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'sideways scroll');
    for (const s of ['CLAIM DETAILS', 'Claim no.', 'Due date', 'THE MATHS', 'Contract total (incl GST)', 'Work complete to date (%)', 'Earlier claims on this job ($)', 'Balance remaining on the contract', 'PAYMENT DETAILS', 'Check your state regulator']) assert.ok(b.includes(s), s + ' is missing');
    assert.deepEqual(pg.problems, []);
    assert.deepEqual(pg.outside, []);
  });
}

await test('typing a claim: sums, dates, warnings and a blank contract using the Quote total', async () => {
  const pg = await open('/pro/');
  await details(pg);
  await tab(pg, 'Progress Claim');
  await pg.fill('#i-date', '2026-10-06');
  assert.equal(await text(pg, 'c-datef'), '6 Oct 2026');
  assert.equal(await text(pg, 'c-due'), '13 Oct 2026');
  await pg.fill('#i-contract', '10000');
  await pg.fill('#i-pct', '40');
  assert.deepEqual([await text(pg, 'c-todate'), await text(pg, 't1'), await text(pg, 't3'), await text(pg, 't4'), await text(pg, 'c-remain')], ['$4,000.00', '$3,636.36', '$363.64', '$4,000.00', '$6,000.00']);
  await pg.fill('#i-prev', '1000');
  assert.deepEqual([await text(pg, 't4'), await text(pg, 't3')], ['$3,000.00', '$272.73']);
  await pg.fill('#i-pct', '150');
  assert.match(await text(pg, 'pc-warn'), /cannot be more than 100%/);
  await pg.fill('#i-pct', '5');
  assert.match(await text(pg, 'pc-warn'), /earlier claims are more than the work done/);
  await pg.fill('#i-pct', '');
  await pg.fill('#i-contract', '');
  await pg.fill('#i-prev', '');
  await tab(pg, 'Quote');
  await pg.fill('[data-k="d1"]', 'Labour');
  await pg.fill('[data-k="q1"]', '3');
  await pg.fill('[data-k="p1"]', '95');
  await tab(pg, 'Progress Claim');
  assert.equal(await pg.getAttribute('#i-contract', 'placeholder'), '$313.50');
  await pg.fill('#i-pct', '50');
  assert.deepEqual([await text(pg, 'c-todate'), await text(pg, 't4'), await text(pg, 'c-remain')], ['$156.75', '$156.75', '$156.75']);
  await tab(pg, 'My Details');
  await pg.selectOption('#i-gst', 'No');
  await tab(pg, 'Progress Claim');
  assert.deepEqual([await text(pg, 't3'), await text(pg, 't4l')], ['', 'THIS CLAIM']);
});

await test('Preview: clean finished claim, back button, nothing typed is trusted', async () => {
  const pg = await open('/pro/');
  await details(pg);
  await tab(pg, 'Progress Claim');
  await pg.fill('#i-no', 'PC-001');
  await pg.fill('#i-date', '2026-10-06');
  await pg.fill('#i-cust', '<b>A. Customer</b>');
  await pg.fill('#i-site', '12 Example St, Parramatta NSW');
  await pg.fill('#i-qno', 'Q-001');
  await pg.fill('#i-desc', 'Stage 2: first fix <script>window.hacked=1</script>');
  await pg.fill('#i-contract', '10000');
  await pg.fill('#i-pct', '40');
  await pg.fill('#i-prev', '1000');
  await pg.click('#pv');
  const p = await paper(pg);
  for (const s of ['PROGRESS CLAIM', 'Smith Electrical', '51 824 753 556', 'PC-001', '6 Oct 2026', '13 Oct 2026', 'Q-001', 'Job site:', '12 Example St, Parramatta NSW', 'Stage 2: first fix', 'Contract total', '$10,000.00', 'Work complete to date', '40%', 'Work done to date', '$4,000.00', 'Less earlier claims', '$1,000.00', 'Subtotal (ex GST)', '$2,727.27', '$272.73', 'THIS CLAIM (incl GST)', '$3,000.00', 'Balance remaining on the contract', '$6,000.00', 'PAYMENT DETAILS', 'Commonwealth Bank', '062-000', 'Reference', 'Payment due within 7 days of the claim date.'])
    assert.ok(p.includes(s), 'preview is missing: ' + s);
  assert.equal(await pg.evaluate(() => window.hacked), undefined);
  assert.equal(await pg.locator('#paper script, #paper b:text("A. Customer")').count(), 0);
  assert.ok(p.includes('<b>A. Customer</b>'));
  await pg.click('#bk');
  assert.equal(await pg.isVisible('#paper'), false);
});

await test('phone: the finished claim fits the screen, and prints on one A4 page', async () => {
  const pg = await open('/pro/', PHONE);
  await details(pg);
  await tab(pg, 'Progress Claim');
  await pg.fill('#i-contract', '98765.43');
  await pg.fill('#i-pct', '65');
  await pg.fill('#i-desc', 'Stage 3 of the rewire: all rough-in complete in the main building and the detached garage.');
  await pg.click('#pv');
  const r = await pg.evaluate(() => {
    const p = document.getElementById('paper');
    return { clipped: p.scrollWidth - p.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
  });
  assert.ok(r.clipped <= 1 && r.page <= 1, 'cut off on a phone: ' + JSON.stringify(r));
  await pg.emulateMedia({ media: 'print' });
  const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1);
});

await test('saved after a reload; Clear this document clears the claim but keeps My Details', async () => {
  const pg = await open('/pro/');
  await details(pg);
  await tab(pg, 'Progress Claim');
  await pg.fill('#i-pct', '25');
  await pg.fill('#i-contract', '8000');
  await pg.reload();
  await tab(pg, 'Progress Claim');
  assert.equal(await pg.inputValue('#i-pct'), '25');
  assert.equal(await pg.inputValue('#i-contract'), '$8,000.00');
  assert.equal(await text(pg, 't4'), '$2,000.00');
  pg.once('dialog', (d) => d.accept());
  await pg.click('#clr');
  assert.equal(await pg.inputValue('#i-pct'), '');
  await tab(pg, 'My Details');
  assert.equal(await pg.inputValue('#i-bank'), 'Commonwealth Bank');
});

await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' progress claim test(s) failed');
  process.exit(1);
}
console.log('progress claim tests passed');
