// The Save button on the Quote and the Variation, and the Clear warning when nothing is saved.
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

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((d) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: {} }));
  }, D);
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
const fillDoc = async (pg, name, no, cust, text) => {
  await go(pg, name);
  await pg.fill('[data-k="no"]', no);
  await pg.fill('[data-k="cust"]', cust);
  await pg.fill(name === 'Quote' ? '#i-scope' : '#i-desc', text);
};
const kept = (pg, slot) => pg.evaluate((s) => {
  const r = JSON.parse(localStorage.getItem('utedocs.v1')).T.Recent || {};
  return [s + '1', s + '2', s + '3'].map((k) => (r[k] ? JSON.parse(r[k]).no : ''));
}, slot);
const msg = (pg) => pg.locator('#dsave-msg').textContent();

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  for (const [name, slot, word] of [['Quote', 'q', 'quote'], ['Variation', 'v', 'variation']]) {
    await test(`${label} ${name}: Save keeps the last 3, newest first, and says how many are saved`, async () => {
      const pg = await open(url);
      await go(pg, name);
      await pg.click('#dsave');
      assert.match(await msg(pg), /^Nothing to save yet\./, 'an empty ' + word + ' is not kept');
      assert.deepEqual(await kept(pg, slot), ['', '', '']);
      await fillDoc(pg, name, 'A-1', 'Ann', 'Work of A-1');
      await pg.click('#dsave');
      assert.equal(await msg(pg), `Saved. You have 1 of 3 saved ${word}s.`);
      await pg.click('#dsave');
      assert.equal(await msg(pg), `Saved. You have 1 of 3 saved ${word}s.`, 'the same one again replaces its copy');
      for (const [no, cust] of [['A-2', 'Ben'], ['A-3', 'Cat'], ['A-4', 'Dan']]) {
        await fillDoc(pg, name, no, cust, 'Work of ' + no);
        await pg.click('#dsave');
      }
      assert.equal(await msg(pg), `Saved. You have 3 of 3 saved ${word}s.`);
      assert.deepEqual(await kept(pg, slot), ['A-4', 'A-3', 'A-2']);
      assert.deepEqual(pg.problems, []);
    });

    await test(`${label} ${name}: Clear warns when it is not saved, and does not keep a copy`, async () => {
      const pg = await open(url);
      await go(pg, name);
      await pg.click('#clr');
      assert.equal(pg.asked, `Clear this ${word}? Your business details stay.`, 'an empty ' + word + ' has nothing to lose');
      await fillDoc(pg, name, 'B-1', 'Bea', 'Work of B-1');
      pg.accept = false;
      await pg.click('#clr');
      assert.match(pg.asked, new RegExp(`^Clear without saving\\? This ${word} is not in your saved ${word}s\\.`));
      assert.equal(await pg.inputValue('[data-k="cust"]'), 'Bea', 'Cancel keeps the ' + word);
      pg.accept = true;
      await pg.click('#clr');
      await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === '');
      assert.deepEqual(await kept(pg, slot), ['', '', ''], 'Clear no longer keeps a copy');
    });

    await test(`${label} ${name}: after Save, Clear does not warn, and the saved copy stays; changing it brings the warning back`, async () => {
      const pg = await open(url);
      await fillDoc(pg, name, 'C-1', 'Cy', 'Work of C-1');
      await pg.click('#dsave');
      await pg.click('#clr');
      assert.equal(pg.asked, `Clear this ${word}? Your business details stay.`);
      await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === '');
      assert.deepEqual(await kept(pg, slot), ['C-1', '', '']);
      await fillDoc(pg, name, 'C-1', 'Cy', 'Work of C-1');
      await pg.click('#dsave');
      await pg.fill(name === 'Quote' ? '#i-scope' : '#i-desc', 'Changed after saving');
      pg.accept = false;
      await pg.click('#clr');
      assert.match(pg.asked, /^Clear without saving\?/);
    });
  }

  await test(label + ': the Quote and the Variation keep separate lists, and the other documents have no Save button', async () => {
    const pg = await open(url);
    await fillDoc(pg, 'Quote', 'Q-1', 'Quinn', 'Quote work');
    await pg.click('#dsave');
    await fillDoc(pg, 'Variation', 'V-1', 'Vic', 'Variation work');
    await pg.click('#dsave');
    assert.deepEqual(await kept(pg, 'q'), ['Q-1', '', '']);
    assert.deepEqual(await kept(pg, 'v'), ['V-1', '', '']);
    for (const other of ['Tax Invoice', 'Invoice']) {
      await go(pg, other);
      assert.equal(await pg.locator('#dsave').count(), 0, other + ' has no Save button');
      await pg.click('#clr');
      assert.equal(pg.asked, 'Clear this document? Your business details stay.');
    }
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Saved quote tests passed');
