// Customer ABN on a Tax Invoice: a wrong number is flagged, the missing-name warning shows by the buttons too,
// and a wrong ABN does not count as the buyer's identity.
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

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': customer ABN checks, REQUIRED shows by the buttons, a wrong ABN is not accepted as the buyer', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('utedocs.v1', JSON.stringify({ D: { name: 'Smith', abn: '51 824 753 556', gst: 'Yes', trade: 'Plumber' }, T: {} })));
    const pg = await ctx.newPage();
    pg.problems = [];
    pg.on('pageerror', (e) => pg.problems.push(e.message));
    await pg.goto(ORIGIN + url);
    await pg.waitForSelector('nav button');
    await pg.click('nav button[data-t="Tax Invoice"]');
    const text = (s) => pg.locator(s).textContent();
    await pg.fill('[data-k="d1"]', 'Big job');
    await pg.fill('[data-k="q1"]', '1');
    await pg.fill('[data-k="p1"]', '1000');
    assert.match(await text('#req'), /^REQUIRED: add the customer name or ABN/);
    assert.match(await text('#req2'), /^REQUIRED: add the customer name or ABN/);
    assert.equal(await text('#cabn-hint'), '');
    await pg.fill('[data-k="cabn"]', '12 345 678 901');
    assert.match(await text('#cabn-hint'), /^This customer ABN does not look right/);
    assert.match(await text('#req'), /^REQUIRED/, 'a wrong ABN must not count as the buyer');
    await pg.fill('[data-k="cabn"]', '51 824 753 556');
    assert.equal(await text('#cabn-hint'), '');
    assert.equal(await text('#req'), '');
    assert.equal(await text('#req2'), '');
    await pg.fill('[data-k="cabn"]', '');
    await pg.fill('[data-k="cust"]', 'A. Customer');
    assert.equal(await text('#req2'), '');
    await pg.fill('[data-k="cust"]', '');
    await pg.fill('[data-k="p1"]', '900');
    assert.equal(await text('#req2'), '', 'under $1,000 nothing is required');
    await pg.click('nav button[data-t="Invoice"]');
    assert.equal(await pg.locator('#cabn-hint').count(), 0);
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('ABN warning tests passed');
