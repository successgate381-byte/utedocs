// Reopening a saved quote or variation: the whole document comes back, and nothing is replaced without asking.
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
const fillDoc = async (pg, name, no, cust, text, line, price) => {
  await go(pg, name);
  await pg.fill('[data-k="no"]', no);
  await pg.fill('[data-k="cust"]', cust);
  await pg.fill(name === 'Quote' ? '#i-scope' : '#i-desc', text);
  await pg.fill('[data-k="d1"]', line);
  await pg.fill('[data-k="p1"]', price);
};
const cleared = (pg) => pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === '');
const rows = (pg) => pg.locator('#dsaved .sv span').allTextContents();

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': Save, Clear, Open brings the whole quote back, price lines and notes too', async () => {
    const pg = await open(url);
    await go(pg, 'Quote');
    assert.equal(await pg.locator('#dsaved').textContent(), 'Nothing saved yet.');
    await fillDoc(pg, 'Quote', 'Q-1', 'Ann', 'Fit new switchboard', 'Replace mixer tap', '120');
    await pg.click('#nt-add');
    await pg.waitForSelector('#i-nx_b1');
    await pg.fill('#i-nx_t1', 'Access');
    await pg.fill('#i-nx_b1', 'Ladder access needed');
    await pg.click('#dsave');
    const list = await rows(pg);
    assert.equal(list.length, 1);
    assert.match(list[0], /Ann, Q-1/);
    await pg.click('#clr');
    await cleared(pg);
    assert.equal(await pg.inputValue('[data-k="d1"]'), '');
    await pg.click('#dopen1');
    await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === 'Ann');
    assert.equal(await pg.inputValue('#i-scope'), 'Fit new switchboard');
    assert.equal(await pg.inputValue('[data-k="d1"]'), 'Replace mixer tap');
    assert.match(await pg.inputValue('[data-k="p1"]'), /^\$?120(\.00)?$/);
    assert.equal(await pg.inputValue('#i-nx_b1'), 'Ladder access needed');
    assert.match(await pg.locator('#dsave-msg').textContent(), /^Opened the saved quote for Ann\./);
    assert.equal(pg.asked.startsWith('Open this'), false, 'nothing to lose, so nothing to ask');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const txt = await pg.locator('#paper').innerText();
    assert.ok(txt.includes('Replace mixer tap') && txt.includes('Access: Ladder access needed'));
    await pg.click('#bk');
    await pg.click('#clr');
    assert.equal(pg.asked, 'Clear this quote? Your business details stay.', 'a reopened quote is saved, so Clear does not warn');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': changing a price line after saving brings the Clear warning back', async () => {
    const pg = await open(url);
    await fillDoc(pg, 'Quote', 'Q-2', 'Ben', 'Work', 'Item', '50');
    await pg.click('#dsave');
    await pg.fill('[data-k="p1"]', '999');
    pg.accept = false;
    await pg.click('#clr');
    assert.match(pg.asked, /^Clear without saving\?/);
  });

  await test(label + ': Open asks first when what is on the screen is not saved, and Cancel changes nothing', async () => {
    const pg = await open(url);
    await fillDoc(pg, 'Quote', 'A-1', 'Ann', 'Work A', 'Item A', '10');
    await pg.click('#dsave');
    await fillDoc(pg, 'Quote', 'B-1', 'Bea', 'Work B', 'Item B', '20');
    pg.accept = false;
    await pg.click('#dopen1');
    assert.match(pg.asked, /^Open this quote\? What is on the quote screen now is not saved/);
    assert.equal(await pg.inputValue('[data-k="cust"]'), 'Bea');
    pg.accept = true;
    await pg.click('#dopen1');
    await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === 'Ann');
    assert.equal(await pg.inputValue('[data-k="d1"]'), 'Item A');
  });

  await test(label + ': the list shows the newest first, up to three, and Open takes the one you press', async () => {
    const pg = await open(url);
    for (const [no, cust] of [['A-1', 'Ann'], ['A-2', 'Ben'], ['A-3', 'Cat'], ['A-4', 'Dan']]) {
      await fillDoc(pg, 'Quote', no, cust, 'Work ' + no, 'Item ' + no, '10');
      await pg.click('#dsave');
    }
    const list = await rows(pg);
    assert.equal(list.length, 3);
    assert.match(list[0], /Dan, A-4/);
    assert.match(list[2], /Ben, A-2/);
    await pg.click('#dopen2');
    await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === 'Cat');
    assert.equal(await pg.inputValue('[data-k="d1"]'), 'Item A-3');
  });

  await test(label + ': a variation saves and reopens the same way', async () => {
    const pg = await open(url);
    await fillDoc(pg, 'Variation', 'V-1', 'Vic', 'Extra power point', 'Power point', '85');
    await pg.click('#dsave');
    assert.match(await pg.locator('#dsave-msg').textContent(), /^Saved\. You have 1 of 3 saved variations\./);
    await pg.click('#clr');
    await cleared(pg);
    await pg.click('#dopen1');
    await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === 'Vic');
    assert.equal(await pg.inputValue('#i-desc'), 'Extra power point');
    assert.match(await pg.inputValue('[data-k="p1"]'), /^\$?85(\.00)?$/);
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': a copy saved before reopening existed shows as details only and cannot be opened', async () => {
    const old = JSON.stringify({ no: 'OLD-1', date: '2026-10-01', cust: 'Old Cust', scope: 'Old scope' });
    const pg = await open(url, { q1: old });
    await go(pg, 'Quote');
    const list = await rows(pg);
    assert.equal(list.length, 1);
    assert.match(list[0], /Old Cust, OLD-1.*\(details only\)/);
    assert.equal(await pg.locator('#dopen1').isDisabled(), true);
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Reopen tests passed');
