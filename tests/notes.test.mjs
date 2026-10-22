// Notes: saved notes in My Details, notes for one document, and what prints.
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
const BASE = { name: 'Smith Electrical', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', gst: 'Yes', trade: 'Electrician', terms: '7' };
const SAVED = { nl_n: '2', nl_t1: 'Warranty', nl_b1: 'Words one', nl_t2: 'Licence', nl_b2: 'Words two', nl_p2: 'No' };
const line = { d1: 'Replace mixer tap', q1: '1', p1: '120' };
const DOCS = ['Quote', 'Tax Invoice', 'Invoice', 'Variation'];
const T = Object.fromEntries(DOCS.map((n) => [n, { no: 'N-001', date: '2026-10-06', cust: 'A. Customer', ...line }]));

async function open(url, d = BASE) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript(([dd, tt]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: dd, T: tt }));
  }, [d, T]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (x) => x.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const paperText = async (pg, name) => {
  await tab(pg, name);
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
  return pg.locator('#paper').innerText();
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': My Details starts with no saved notes, adds up to 8, removes down to none, and keeps typed words as text', async () => {
    const pg = await open(url);
    await tab(pg, 'My Details');
    assert.equal(await pg.locator('[data-k^="nl_t"]').count(), 0);
    assert.equal(await pg.locator('#nl-rm').isDisabled(), true);
    for (let n = 1; n <= 8; n++) {
      await pg.click('#nl-add');
      await pg.waitForSelector('#i-nl_t' + n);
    }
    assert.equal(await pg.locator('#nl-add').isDisabled(), true, 'eight is the most');
    await pg.fill('#i-nl_t1', '<b>Hi</b>');
    await pg.fill('#i-nl_b1', 'Line one\nLine two');
    for (let n = 8; n >= 1; n--) {
      await pg.click('#nl-rm');
      await pg.waitForSelector('#i-nl_t' + n, { state: 'detached' });
    }
    assert.equal(await pg.locator('#nl-rm').isDisabled(), true);
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': a saved note that is on prints under NOTES on all four documents, above the signature; one that is off does not', async () => {
    const pg = await open(url, { ...BASE, ...SAVED });
    for (const name of DOCS) {
      const txt = await paperText(pg, name);
      assert.ok(txt.includes('NOTES'), name + ' has a NOTES heading');
      assert.ok(txt.includes('Warranty: Words one'), name + ' prints the saved note with its title');
      assert.ok(!txt.includes('Words two'), name + ' leaves out the note set to No');
    }
    const q = await paperText(pg, 'Quote');
    assert.ok(q.indexOf('TOTAL') < q.indexOf('Words one'), 'notes come after the totals');
    assert.ok(q.indexOf('Words one') < q.indexOf('I accept this quote'), 'notes come before the acceptance block');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': a document can print a saved note that is off, or leave off one that is on, without touching the others', async () => {
    const pg = await open(url, { ...BASE, ...SAVED });
    await tab(pg, 'Quote');
    assert.equal(await pg.locator('#i-nu1').inputValue(), 'Follow my saved setting');
    await pg.selectOption('#i-nu2', 'Print on this document');
    await pg.selectOption('#i-nu1', 'Leave off this document');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const q = await pg.locator('#paper').innerText();
    assert.ok(q.includes('Licence: Words two') && !q.includes('Words one'));
    const ti = await paperText(pg, 'Tax Invoice');
    assert.ok(ti.includes('Words one') && !ti.includes('Words two'), 'the Tax Invoice still follows the saved setting');
  });

  await test(label + ': notes for one document add up to three, print as text, can be switched off, and Clear removes them', async () => {
    const pg = await open(url);
    await tab(pg, 'Quote');
    assert.equal(await pg.locator('#nt-rm').isDisabled(), true);
    for (let n = 1; n <= 3; n++) {
      await pg.click('#nt-add');
      await pg.waitForSelector('#i-nx_t' + n);
    }
    assert.equal(await pg.locator('#nt-add').isDisabled(), true, 'three is the most');
    await pg.fill('#i-nx_t1', 'ESV note');
    await pg.fill('#i-nx_b1', 'Typed <b>words</b>\nsecond line');
    await pg.fill('#i-nx_b2', 'Hidden words');
    await pg.selectOption('#i-nx_p2', 'No');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const txt = await pg.locator('#paper').innerText();
    assert.ok(txt.includes('ESV note: Typed <b>words</b>'), 'typed words print as text');
    assert.equal(await pg.locator('#paper b', { hasText: 'words' }).count(), 0, 'typed HTML must stay text');
    assert.ok(!txt.includes('Hidden words'), 'Print on PDF set to No');
    await pg.click('#bk');
    await pg.click('#clr');
    await tab(pg, 'Quote');
    assert.equal(await pg.locator('[data-k^="nx_t"]').count(), 0, 'Clear this document removes the notes');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': with no notes the printed page has no NOTES heading', async () => {
    const pg = await open(url);
    for (const name of DOCS) assert.ok(!(await paperText(pg, name)).includes('NOTES'), name);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Notes tests passed');
