// The last 3 quotes, and choosing which one the Certificate and the SWMS fill from.
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
  page.on('dialog', (d) => (page.accept ? d.accept() : d.dismiss()));
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const newQuote = async (pg, no, cust, site, scope) => {
  await pg.click('nav button[data-t="Quote"]');
  await pg.fill('[data-k="no"]', no);
  await pg.fill('[data-k="cust"]', cust);
  await pg.fill('[data-k="site"]', site);
  await pg.fill('#i-scope', scope);
};
const clearQuote = async (pg) => {
  await pg.click('nav button[data-t="Quote"]');
  await pg.click('#clr');
  await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === '');
};
const kept = (pg) => pg.evaluate(() => {
  const r = JSON.parse(localStorage.getItem('utedocs.v1')).T.Recent || {};
  return ['q1', 'q2', 'q3'].map((k) => (r[k] ? JSON.parse(r[k]).no : ''));
});

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': clearing keeps the last 3 quotes, newest first, and the oldest drops off', async () => {
    const pg = await open(url);
    for (const [no, cust] of [['Q-1', 'Ann'], ['Q-2', 'Ben'], ['Q-3', 'Cat'], ['Q-4', 'Dan']]) {
      await newQuote(pg, no, cust, no + ' Street', 'Scope of ' + no);
      await clearQuote(pg);
    }
    assert.deepEqual(await kept(pg), ['Q-4', 'Q-3', 'Q-2']);
    await newQuote(pg, 'Q-3', 'Cat', 'Q-3 Street', 'Scope again');
    await clearQuote(pg);
    assert.deepEqual(await kept(pg), ['Q-3', 'Q-4', 'Q-2'], 'the same quote again replaces its old copy');
    await clearQuote(pg);
    assert.deepEqual(await kept(pg), ['Q-3', 'Q-4', 'Q-2'], 'an empty quote is not kept');
    await newQuote(pg, 'Q-9', 'Eve', 'Q-9 Street', 'Scope of Q-9');
    pg.accept = false;
    await pg.click('#clr');
    assert.deepEqual(await kept(pg), ['Q-3', 'Q-4', 'Q-2'], 'cancel keeps nothing');
    assert.equal(await pg.inputValue('[data-k="cust"]'), 'Eve');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': the Certificate and the SWMS can fill from any of the last 3', async () => {
    const pg = await open(url);
    for (const [no, cust] of [['Q-1', 'Ann'], ['Q-2', 'Ben']]) {
      await newQuote(pg, no, cust, no + ' Street', 'Scope of ' + no);
      await clearQuote(pg);
    }
    await newQuote(pg, 'Q-3', 'Cat', 'Q-3 Street', 'Scope of Q-3');
    await pg.click('nav button[data-t="Forms"]');
    await pg.click('[data-fm-pick="cert"]');
    await pg.waitForSelector('#i-fm_src');
    const options = await pg.locator('#i-fm_src option').allTextContents();
    assert.equal(options.length, 3);
    assert.equal(options[0], 'Current quote');
    assert.match(options[1], /^1\) Ben, Q-2/);
    assert.match(options[2], /^2\) Ann, Q-1/);
    await pg.selectOption('#i-fm_src', options[2]);
    await pg.fill('#i-jc_work', 'My own words');
    await pg.click('#fm-fill');
    await pg.waitForSelector('#i-jc_cust');
    assert.equal(await pg.inputValue('#i-jc_cust'), 'Ann');
    assert.equal(await pg.inputValue('#i-jc_addr'), 'Q-1 Street');
    assert.equal(await pg.inputValue('#i-jc_no'), 'Q-1');
    assert.equal(await pg.inputValue('#i-jc_work'), 'My own words');
    assert.match(await pg.locator('#fm-msg').textContent(), /^Filled 3 boxes from the quote you chose\./);
    await pg.click('[data-fm-pick="swms"]');
    await pg.waitForSelector('#i-sw_prin');
    await pg.selectOption('#i-fm_src', options[1]);
    await pg.click('#fm-fill');
    await pg.waitForSelector('#i-sw_site');
    assert.equal(await pg.inputValue('#i-sw_site'), 'Q-2 Street');
    assert.equal(await pg.inputValue('#i-sw_desc'), 'Scope of Q-2');
    await pg.click('[data-fm-pick="cert"]');
    await pg.waitForSelector('#i-fm_src');
    await pg.selectOption('#i-fm_src', 'Current quote');
    await pg.fill('#i-jc_cust', '');
    await pg.click('#fm-fill');
    await pg.waitForSelector('#i-jc_cust');
    assert.equal(await pg.inputValue('#i-jc_cust'), 'Cat', 'the current quote still works');
  });

  await test(label + ': clearing the Tax Invoice or the Invoice keeps nothing', async () => {
    const pg = await open(url);
    await pg.click('nav button[data-t="Tax Invoice"]');
    await pg.fill('[data-k="cust"]', 'Zed');
    await pg.click('#clr');
    await pg.waitForFunction(() => document.querySelector('[data-k="cust"]').value === '');
    assert.deepEqual(await kept(pg), ['', '', '']);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Recent quotes tests passed');
