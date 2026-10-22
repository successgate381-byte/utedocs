// SWMS workers consulted: one row per worker, each with a typeable date, and no signature pad.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { parseDmy, toDmy } from '../site/app/js/dmy.js';

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

await test('typed dates: day, month and year with / . or - and a two or four digit year', () => {
  assert.equal(parseDmy('20/10/26'), '2026-10-20');
  assert.equal(parseDmy('5/3/2026'), '2026-03-05');
  assert.equal(parseDmy(' 5-3-26 '), '2026-03-05');
  assert.equal(parseDmy('05.03.26'), '2026-03-05');
  assert.equal(parseDmy('29/02/28'), '2028-02-29');
});

await test('typed dates: anything that is not a real date gives nothing', () => {
  for (const bad of ['', '31/02/26', '29/02/27', '20/13/26', '0/1/26', '20/10', '20/10/1999', 'abc', '2026-10-20', null, undefined]) {
    assert.equal(parseDmy(bad), '', 'should not read: ' + String(bad));
  }
});

await test('an ISO date turns into dd/mm/yy', () => {
  assert.equal(toDmy('2026-10-20'), '20/10/26');
  assert.equal(toDmy(''), '');
  assert.equal(toDmy('20 Oct 2026'), '');
});

const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const D = { name: 'Smith Electrical', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', gst: 'Yes', trade: 'Electrician', terms: '7' };

async function open(url, forms = {}) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript(([d, f]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: { Forms: f } }));
  }, [D, forms]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());
  // The date is three boxes (day, month, year). These two helpers let a test say "the date" in one go.
  const plainFill = page.fill.bind(page);
  const plainValue = page.inputValue.bind(page);
  page.fill = async (sel, v, ...rest) => {
    const m = /^#i-sw_wd(\d+)$/.exec(sel);
    if (!m) return plainFill(sel, v, ...rest);
    const p = String(v).split(/[\/.-]/);
    for (const [at, part] of ['d', 'm', 'y'].entries()) await plainFill('#i-sw_wd' + part + m[1], p[at] ?? '');
  };
  page.inputValue = async (sel, ...rest) => {
    const m = /^#i-sw_wd(\d+)$/.exec(sel);
    if (!m) return plainValue(sel, ...rest);
    const p = [await plainValue('#i-sw_wdd' + m[1]), await plainValue('#i-sw_wdm' + m[1]), await plainValue('#i-sw_wdy' + m[1])];
    return p.some(Boolean) ? p.join('/') : '';
  };
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Forms"]');
  await page.click('[data-fm-pick="swms"]');
  await page.waitForSelector('#i-sw_prin');
  return page;
}
const rowsOf = (pg) => pg.locator('#paper .swt').last().locator('tbody tr').allTextContents();
const preview = async (pg) => {
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': four worker rows to start, from 1 to 12, and no signature pad', async () => {
    const pg = await open(url);
    assert.equal(await pg.locator('[data-k^="sw_wk"]').count(), 4);
    assert.equal(await pg.locator('[data-k^="sw_wdd"]').count(), 4);
    assert.equal(await pg.locator('[data-k^="sw_wdm"]').count(), 4);
    assert.equal(await pg.locator('[data-k^="sw_wdy"]').count(), 4);
    assert.equal(await pg.locator('#i-sw_workers').count(), 0, 'the old single names box is gone');
    assert.equal(await pg.locator('#i-sw_signed').count(), 0, 'the old single date box is gone');
    assert.equal(await pg.locator('canvas').count(), 0, 'workers sign on the printed page, no pad');
    for (let n = 5; n <= 12; n++) {
      await pg.click('#fm-addwk');
      await pg.waitForSelector('#i-sw_wk' + n);
    }
    assert.equal(await pg.locator('[data-k^="sw_wk"]').count(), 12);
    assert.equal(await pg.locator('#fm-addwk').isDisabled(), true, 'twelve is the most');
    for (let n = 11; n >= 1; n--) {
      await pg.click('#fm-rmwk');
      await pg.waitForSelector('#i-sw_wk' + (n + 1), { state: 'detached' });
    }
    assert.equal(await pg.locator('[data-k^="sw_wk"]').count(), 1);
    assert.equal(await pg.locator('#fm-rmwk').isDisabled(), true, 'one is the least');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': each worker gets their own date on the finished page, and typed words stay text', async () => {
    const pg = await open(url);
    await pg.fill('#i-sw_wk1', 'Sam Lee');
    await pg.fill('#i-sw_wd1', '20/10/26');
    await pg.fill('#i-sw_wk2', 'Alex Kim');
    await pg.fill('#i-sw_wd2', '5-11-2026');
    await pg.fill('#i-sw_wk3', 'Jo Ng');
    await pg.fill('#i-sw_wd3', '31/02/26');
    await pg.fill('#i-sw_wk4', '<b>Zed</b>');
    assert.match(await pg.locator('#wd-hint').textContent(), /Worker 3: that is not a date yet/);
    await pg.fill('#i-sw_wd3', '');
    assert.equal(await pg.locator('#wd-hint').textContent(), '');
    await pg.fill('#i-sw_wd3', '31/02/26');
    await preview(pg);
    const rows = await rowsOf(pg);
    assert.equal(rows.length, 4);
    assert.equal(rows[0], 'Sam Lee20 Oct 2026');
    assert.equal(rows[1], 'Alex Kim5 Nov 2026');
    assert.equal(rows[2], 'Jo Ng31/02/26', 'words that are not a date print as typed');
    assert.equal(rows[3], '<b>Zed</b>');
    assert.equal(await pg.locator('#paper .swt td b').count(), 0, 'typed HTML must stay text');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': a removed row does not print, and the page keeps at least four rows', async () => {
    const pg = await open(url);
    await pg.click('#fm-addwk');
    await pg.waitForSelector('#i-sw_wk5');
    await pg.fill('#i-sw_wk5', 'Pat Fifth');
    await pg.click('#fm-rmwk');
    await pg.waitForSelector('#i-sw_wk5', { state: 'detached' });
    await preview(pg);
    assert.equal((await rowsOf(pg)).length, 4);
    assert.ok(!(await pg.locator('#paper').textContent()).includes('Pat Fifth'));
    await pg.click('#bk');
    for (let n = 3; n >= 1; n--) await pg.click('#fm-rmwk');
    await preview(pg);
    assert.equal((await rowsOf(pg)).length, 4, 'a SWMS always has room for four names');
  });

  await test(label + ': saved names and the old single signing date move into the rows, once', async () => {
    const pg = await open(url, { sw_workers: 'Sam Lee\nAlex Kim', sw_signed: '2026-10-20' });
    assert.equal(await pg.inputValue('#i-sw_wk1'), 'Sam Lee');
    assert.equal(await pg.inputValue('#i-sw_wd1'), '20/10/26');
    assert.equal(await pg.inputValue('#i-sw_wk2'), 'Alex Kim');
    assert.equal(await pg.inputValue('#i-sw_wd2'), '20/10/26');
    assert.equal(await pg.inputValue('#i-sw_wk3'), '');
    await pg.fill('#i-sw_wk1', 'Sam L. Lee');
    await preview(pg);
    const rows = await rowsOf(pg);
    assert.equal(rows[0], 'Sam L. Lee20 Oct 2026');
    assert.equal(rows[1], 'Alex Kim20 Oct 2026');
    const kept = await pg.evaluate(() => JSON.parse(localStorage.getItem('utedocs.v1')).T.Forms);
    assert.equal(kept.sw_workers, '');
    assert.equal(kept.sw_signed, '');
    assert.equal(kept.sw_wm, '1');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': Clear this form empties the worker rows', async () => {
    const pg = await open(url);
    await pg.fill('#i-sw_wk1', 'Sam Lee');
    await pg.fill('#i-sw_wd1', '20/10/26');
    await pg.click('#fm-clear');
    await pg.waitForSelector('#i-sw_wk1');
    assert.equal(await pg.inputValue('#i-sw_wk1'), '');
    assert.equal(await pg.inputValue('#i-sw_wd1'), '');
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('SWMS worker tests passed');
