// Notes on the Job Completion Certificate: saved notes, notes of its own, and where they print.
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

async function open(url, form = 'cert', d = BASE) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((dd) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: dd, T: {} }));
  }, d);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (x) => x.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Forms"]');
  await page.click(`[data-fm-pick="${form}"]`);
  await page.waitForSelector(form === 'cert' ? '#i-jc_cust' : '#i-sw_prin');
  return page;
}
const paperText = async (pg) => {
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
  return pg.locator('#paper').innerText();
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': the certificate has a Notes section with a true guide, and no note boxes until you add one', async () => {
    const pg = await open(url, 'cert', { ...BASE, ...SAVED });
    const guide = await pg.getByText(/^Notes print /).first().innerText();
    assert.match(guide, /above the customer acknowledgement and the signatures/);
    assert.equal(await pg.locator('#i-jc_nu1').inputValue(), 'Follow my saved setting');
    assert.equal(await pg.locator('[data-k^="jc_nx_t"]').count(), 0);
    assert.equal(await pg.locator('#nt-rm').isDisabled(), true);
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': a saved note that is on prints between the warranty note and the acknowledgement; one that is off does not', async () => {
    const pg = await open(url, 'cert', { ...BASE, ...SAVED });
    const txt = await paperText(pg);
    assert.ok(txt.includes('NOTES') && txt.includes('Warranty: Words one'));
    assert.ok(!txt.includes('Words two'));
    assert.ok(txt.indexOf('WORKMANSHIP / WARRANTY NOTE') < txt.indexOf('Words one'), 'after the warranty note');
    assert.ok(txt.indexOf('Words one') < txt.indexOf('CUSTOMER ACKNOWLEDGEMENT'), 'above the acknowledgement');
  });

  await test(label + ': the certificate can print a saved note that is off, or leave one off, without touching other documents', async () => {
    const pg = await open(url, 'cert', { ...BASE, ...SAVED });
    await pg.selectOption('#i-jc_nu2', 'Print on this document');
    await pg.selectOption('#i-jc_nu1', 'Leave off this document');
    const txt = await paperText(pg);
    assert.ok(txt.includes('Licence: Words two') && !txt.includes('Words one'));
    await pg.click('#bk');
    await pg.click('nav button[data-t="Quote"]');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const q = await pg.locator('#paper').innerText();
    assert.ok(q.includes('Words one') && !q.includes('Words two'), 'the Quote still follows the saved setting');
  });

  await test(label + ': notes of its own add up to three, print as text, can be switched off, and Clear this form removes them', async () => {
    const pg = await open(url);
    for (let n = 1; n <= 3; n++) {
      await pg.click('#nt-add');
      await pg.waitForSelector('#i-jc_nx_t' + n);
    }
    assert.equal(await pg.locator('#nt-add').isDisabled(), true, 'three is the most');
    await pg.fill('#i-jc_nx_t1', 'Test result');
    await pg.fill('#i-jc_nx_b1', 'RCD tested <b>ok</b>');
    await pg.fill('#i-jc_nx_b2', 'Hidden words');
    await pg.selectOption('#i-jc_nx_p2', 'No');
    const txt = await paperText(pg);
    assert.ok(txt.includes('Test result: RCD tested <b>ok</b>'));
    assert.equal(await pg.locator('#paper b', { hasText: 'ok' }).count(), 0, 'typed HTML must stay text');
    assert.ok(!txt.includes('Hidden words'));
    await pg.click('#bk');
    await pg.click('#fm-clear');
    await pg.waitForSelector('#i-jc_cust');
    assert.equal(await pg.locator('[data-k^="jc_nx_t"]').count(), 0, 'Clear this form removes the notes');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': with no notes the certificate prints no NOTES heading, and the SWMS has no Notes section', async () => {
    const pg = await open(url);
    assert.ok(!(await paperText(pg)).includes('NOTES'));
    await pg.click('#bk');
    await pg.click('[data-fm-pick="swms"]');
    await pg.waitForSelector('#i-sw_prin');
    assert.equal(await pg.locator('#nt-add').count(), 0);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Certificate notes tests passed');
