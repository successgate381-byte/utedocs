// The tiny collapsible Remove button on each saved quote and saved variation.
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
const D = { name: 'Smith Electrical', gst: 'Yes', trade: 'Electrician', terms: '7' };

async function open(url, recent = {}) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript(([d, r]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: { Recent: r } }));
  }, [D, recent]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.accept = true;
  page.asked = '';
  page.on('dialog', (d) => {
    page.asked = d.message();
    return page.accept ? d.accept() : d.dismiss();
  });
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const go = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const saveOne = async (pg, name, no, cust) => {
  await go(pg, name);
  await pg.fill('[data-k="no"]', no);
  await pg.fill('[data-k="cust"]', cust);
  await pg.fill(name === 'Quote' ? '#i-scope' : '#i-desc', 'Work ' + no);
  await pg.click('#dsave');
};
const rows = (pg) => pg.locator('#dsaved .sv span').allTextContents();
const kept = (pg, slot) => pg.evaluate((s) => {
  const r = JSON.parse(localStorage.getItem('utedocs.v1')).T.Recent || {};
  return [s + '1', s + '2', s + '3'].map((k) => (r[k] ? JSON.parse(r[k]).no : ''));
}, slot);

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': every saved row has a tiny collapsed Remove; Cancel keeps it and OK removes only that one', async () => {
    const pg = await open(url);
    await saveOne(pg, 'Quote', 'A-1', 'Ann');
    await saveOne(pg, 'Quote', 'A-2', 'Ben');
    assert.equal((await rows(pg)).length, 2);
    assert.equal(await pg.locator('#dsaved details.svx').count(), 2, 'one Remove for each row');
    assert.equal(await pg.locator('#dsaved details[open]').count(), 0, 'they start collapsed');
    assert.equal(await pg.locator('#drm1').isVisible(), false);
    await pg.locator('#dsaved .sv').nth(0).locator('summary').click();
    assert.equal(await pg.locator('#drm1').isVisible(), true);
    pg.accept = false;
    await pg.click('#drm1');
    assert.match(pg.asked, /^Remove this saved quote\?/);
    assert.equal((await rows(pg)).length, 2, 'Cancel keeps both');
    pg.accept = true;
    await pg.click('#drm1');
    const left = await rows(pg);
    assert.equal(left.length, 1);
    assert.match(left[0], /Ann, A-1/, 'the newest (Ben) went, the other stays');
    assert.equal(await pg.locator('#dsave-msg').textContent(), 'Removed. You have 1 of 3 saved quotes.');
    assert.deepEqual(await kept(pg, 'q'), ['A-1', '', '']);
    assert.equal(await pg.locator('#dsaved details[open]').count(), 0, 'collapsed again');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': an older copy that cannot be reopened can still be removed, and a variation list is separate', async () => {
    const old = JSON.stringify({ no: 'OLD-1', date: '2026-10-01', cust: 'Old Cust', scope: 'Old scope' });
    const pg = await open(url, { q1: old });
    await go(pg, 'Quote');
    await pg.locator('#dsaved .sv').nth(0).locator('summary').click();
    await pg.click('#drm1');
    assert.equal(await pg.locator('#dsaved').textContent(), 'Nothing saved yet.');
    await saveOne(pg, 'Quote', 'Q-1', 'Quinn');
    await saveOne(pg, 'Variation', 'V-1', 'Vic');
    await pg.locator('#dsaved .sv').nth(0).locator('summary').click();
    await pg.click('#drm1');
    assert.equal(await pg.locator('#dsaved').textContent(), 'Nothing saved yet.');
    assert.deepEqual(await kept(pg, 'v'), ['', '', '']);
    assert.deepEqual(await kept(pg, 'q'), ['Q-1', '', ''], 'the quote list is untouched');
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Saved remove tests passed');
