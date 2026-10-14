// P6 tests: starter packs (Pro only). Words only, no prices, nothing typed is ever replaced.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { LISTS } from '../site/app/js/data.js';
import { PACKS, fillPlan, hasPlaceholder, packsFor } from '../site/pro/js/packs-data.js';

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

/* ---------- the packs themselves, no browser ---------- */
await test('every pack is complete, has no prices, uses the Line Items names, and keeps to neutral wording', () => {
  const seen = new Set();
  for (const trade of ['Electrician', 'Plumber']) {
    assert.ok(packsFor(trade).length >= 8, trade + ' needs at least 8 packs');
    for (const p of packsFor(trade)) {
      assert.ok(!seen.has(p.id), 'repeated id ' + p.id);
      seen.add(p.id);
      assert.ok(p.name.trim().length >= 3, p.id + ' has no name');
      for (const key of ['scope', 'inclusions', 'exclusions']) assert.ok(p[key].trim().length > 10, p.id + ' has an empty ' + key);
      assert.ok(p.lines.length >= 2 && p.lines.length <= 6, p.id + ' should have 2 to 6 lines');
      for (const l of p.lines) assert.ok(LISTS[trade].includes(l), p.id + ': "' + l + '" is not on the Line Items tab');
      assert.equal(new Set(p.lines).size, p.lines.length, p.id + ' repeats a line');
      assert.ok(hasPlaceholder(p.scope), p.id + ' scope should have [brackets] to fill in');
      const all = [p.name, p.scope, p.inclusions, p.exclusions, ...p.lines].join(' ');
      assert.ok(!/\$|\bAUD\b|\d\s?%/.test(all), p.id + ' must not contain prices or percentages');
      assert.ok(!/\b(color|center|license|organization|gray)\b/i.test(all), p.id + ' has American spelling');
      assert.ok(!/QBCC|HBCF|cooling|Fair Trading|Form 4|Certificate of Electrical Safety/i.test(all), p.id + ' has state-specific legal wording');
    }
  }
  assert.deepEqual(packsFor('Other'), []);
  assert.deepEqual(Object.keys(PACKS), ['Electrician', 'Plumber']);
});

await test('placeholders: words in square brackets are found', () => {
  assert.equal(hasPlaceholder('Fit [number] lights'), true);
  assert.equal(hasPlaceholder('Fit 3 lights'), false);
  assert.equal(hasPlaceholder('[]'), false);
  assert.equal(hasPlaceholder(undefined), false);
});

await test('filling: only empty boxes are filled, typed words are kept, lines go in free rows', () => {
  const pack = packsFor('Electrician')[0];
  const empty = { scope: '', incl: '', excl: '', rows: 8 };
  const a = fillPlan(pack, empty);
  assert.deepEqual(a.filled, ['scope of work', 'inclusions', 'exclusions']);
  assert.deepEqual([a.linesAdded, a.linesSkipped], [5, 0]);
  assert.deepEqual([a.set.d1, a.set.d5, a.set.d6], [pack.lines[0], pack.lines[4], undefined]);
  const b = fillPlan(pack, { ...empty, scope: 'My own scope', d1: 'My item', q1: '1', p1: '50', d2: '', q2: '3' });
  assert.deepEqual(b.kept, ['scope of work']);
  assert.equal(b.set.scope, undefined);
  assert.equal(b.set.d1, undefined);
  assert.equal(b.set.d2, undefined, 'a row with a quantity is not free');
  assert.deepEqual([b.set.d3, b.linesAdded], [pack.lines[0], 5]);
  const c = fillPlan(pack, { ...empty, d1: pack.lines[0], d2: ' ' + pack.lines[1] });
  assert.equal(c.linesAdded, 3, 'a line that is already there is not added twice');
  const rows = { ...empty };
  for (let i = 1; i <= 6; i++) rows['d' + i] = 'x' + i;
  const d = fillPlan(pack, rows);
  assert.deepEqual([d.linesAdded, d.linesSkipped], [2, 3]);
  for (const k of Object.keys(a.set)) assert.ok(!/^[qp]\d/.test(k), 'a quantity or price was filled');
});

/* ---------- the box in a real browser ---------- */
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
  page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && page.outside.push(r.url()));
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const fillPack = async (pg, id) => {
  const before = await pg.locator('#pk-msg').textContent();
  await pg.selectOption('#pk-pick', id);
  await pg.click('#pk-fill');
  await pg.waitForFunction((old) => document.getElementById('pk-msg').textContent !== old, before);
};

await test('the Starter pack box is on the Pro Quote only, and follows the trade on My Details', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Quote');
  assert.equal(await pg.locator('#pk-pick option').count(), 10);
  assert.match(await pg.locator('#m').textContent(), /STARTER PACK \(PRO\)/);
  assert.ok((await pg.locator('#pk-pick option').allTextContents()).includes('Switchboard upgrade'));
  for (const t of ['Tax Invoice', 'Invoice', 'Variation', 'Progress Claim']) {
    await tab(pg, t);
    assert.equal(await pg.locator('#pk-pick').count(), 0, t + ' should not have packs');
  }
  await tab(pg, 'My Details');
  await pg.selectOption('#i-trade', 'Plumber');
  await tab(pg, 'Quote');
  assert.equal(await pg.locator('#pk-pick option').count(), 9);
  assert.ok((await pg.locator('#pk-pick option').allTextContents()).includes('Hot water system replacement'));
  await tab(pg, 'My Details');
  await pg.selectOption('#i-trade', 'Other');
  await tab(pg, 'Quote');
  assert.equal(await pg.locator('#pk-pick').isDisabled(), true);
  assert.equal(await pg.locator('#pk-fill').isDisabled(), true);
  assert.match(await pg.locator('#pk-msg').textContent(), /Starter packs are for Electrician and Plumber/);
  const lite = await open('/app/');
  await tab(lite, 'Quote');
  assert.equal(await lite.locator('#pk-pick').count(), 0);
});

await test('filling a pack puts words in the empty boxes and lines with no prices, and it can all be edited', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Quote');
  await pg.click('#pk-fill');
  assert.equal(await pg.locator('#pk-msg').textContent(), 'Choose a job type first.');
  await fillPack(pg, 'e-power-lights');
  assert.match(await pg.locator('#pk-msg').textContent(), /^Filled scope of work, inclusions and exclusions and 5 lines\. Now add your quantities and prices/);
  assert.match(await pg.inputValue('#i-scope'), /^Supply and install \[number\] double power points/);
  assert.match(await pg.inputValue('#i-incl'), /Labour and materials as listed\.\nTesting of the completed work\./);
  assert.match(await pg.inputValue('#i-excl'), /Painting, plastering and making good after cable runs/);
  assert.deepEqual([await pg.inputValue('[data-k="d1"]'), await pg.inputValue('[data-k="d2"]'), await pg.inputValue('[data-k="d5"]')], ['Labour - licensed electrician', 'Supply and install double power point (GPO)', 'Compliance paperwork and test results (where required in your state)']);
  for (let i = 1; i <= 8; i++) assert.deepEqual([await pg.inputValue(`[data-k="q${i}"]`), await pg.inputValue(`[data-k="p${i}"]`)], ['', ''], 'no quantity or price should be filled');
  assert.equal(await pg.locator('#pk-pick').inputValue(), 'e-power-lights');
  await pg.fill('#i-scope', 'Edited scope for 4 power points at 12 Example St.');
  await pg.reload();
  await tab(pg, 'Quote');
  assert.equal(await pg.inputValue('#i-scope'), 'Edited scope for 4 power points at 12 Example St.');
  assert.match(await pg.inputValue('#i-incl'), /^Labour and materials as listed\./);
  assert.deepEqual(pg.problems, []);
  assert.deepEqual(pg.outside, []);
});

await test('words and lines the person already typed are never replaced', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Quote');
  await pg.fill('#i-scope', 'My own scope of work');
  await pg.fill('[data-k="d1"]', 'My own item');
  await pg.fill('[data-k="q1"]', '2');
  await pg.fill('[data-k="p1"]', '45');
  await fillPack(pg, 'e-switchboard');
  assert.equal(await pg.inputValue('#i-scope'), 'My own scope of work');
  assert.deepEqual([await pg.inputValue('[data-k="d1"]'), await pg.inputValue('[data-k="q1"]'), await pg.inputValue('[data-k="p1"]')], ['My own item', '2', '$45.00']);
  assert.equal(await pg.inputValue('[data-k="d2"]'), 'Switchboard upgrade (supply and install)');
  assert.match(await pg.locator('#pk-msg').textContent(), /^Filled inclusions and exclusions and 5 lines\. Left as you typed: scope of work\./);
  await fillPack(pg, 'e-switchboard');
  assert.match(await pg.locator('#pk-msg').textContent(), /^Nothing to fill: those boxes and lines already have words in them\./);
  assert.equal(await pg.inputValue('[data-k="d7"]'), '', 'a second fill must not add the same lines again');
});

await test('lines that do not fit are explained', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Quote');
  for (let i = 1; i <= 6; i++) await pg.fill(`[data-k="d${i}"]`, 'Item ' + i);
  await fillPack(pg, 'e-switchboard');
  assert.match(await pg.locator('#pk-msg').textContent(), /3 suggested lines did not fit\. Tap \+ Add a line/);
  assert.equal(await pg.inputValue('[data-k="d7"]'), 'Switchboard upgrade (supply and install)');
});

await test('leftover [square brackets] are flagged on screen and in the preview, but never printed', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Quote');
  assert.equal(await pg.locator('#pk-warn').textContent(), '');
  await fillPack(pg, 'e-power-lights');
  assert.equal(await pg.locator('#pk-warn').textContent(), 'Replace the words in [square brackets] before you send this quote.');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .pk-flag').count(), 1);
  assert.match(await pg.locator('#paper .pk-flag').textContent(), /This note is not printed/);
  await pg.emulateMedia({ media: 'print' });
  assert.equal(await pg.locator('#paper .pk-flag').evaluate((e) => getComputedStyle(e).display), 'none');
  await pg.emulateMedia({ media: 'screen' });
  await pg.click('#bk');
  await pg.fill('#i-scope', 'Supply and install 4 double power points in the kitchen.');
  await pg.fill('#i-incl', 'Labour and materials as listed.');
  await pg.fill('#i-excl', 'Painting and making good.');
  assert.equal(await pg.locator('#pk-warn').textContent(), '');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .pk-flag').count(), 0);
});

await test('a filled quote previews with the pack words, also as an Estimate, and a Plumber pack works too', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'My Details');
  await pg.selectOption('#i-trade', 'Plumber');
  await tab(pg, 'Quote');
  await fillPack(pg, 'p-hws');
  await pg.selectOption('#i-ptype', 'Estimate (final price based on actual hours and materials)');
  await pg.fill('[data-k="q1"]', '2');
  await pg.fill('[data-k="p1"]', '100');
  await pg.click('#pv');
  const p = await pg.locator('#paper').textContent();
  for (const s of ['Scope of work:', 'Remove the existing hot water system', 'Inclusions:', 'Removal and disposal of the old system.', 'Exclusions:', 'Hot water system (supply and install)', 'ESTIMATED TOTAL (incl GST)', 'This is an estimate, not a fixed price']) assert.ok(p.includes(s), 'missing: ' + s);
  assert.deepEqual(pg.problems, []);
});

await test('phone: the pack box fits the screen and its button is big enough to tap', async () => {
  const pg = await open('/pro/', PHONE);
  await tab(pg, 'Quote');
  assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'sideways scroll');
  assert.ok((await pg.locator('#pk-fill').boundingBox()).height >= 40);
  assert.ok((await pg.locator('#pk-pick').boundingBox()).height >= 40);
  await fillPack(pg, 'e-fan');
  assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'sideways scroll after filling');
});

await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' starter pack test(s) failed');
  process.exit(1);
}
console.log('starter pack tests passed');
