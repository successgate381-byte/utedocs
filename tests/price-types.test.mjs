// Hourly rate and Cost plus: Labour and Materials tables on the Quote, the Tax Invoice and the Invoice.
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
const HOURLY = 'Hourly rate (labour hours plus materials)';
const COST_PLUS = 'Cost plus (materials at cost plus an agreed markup)';

async function open(url, gst = 'Yes') {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((g) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: { name: 'Smith Electrical', abn: '51 824 753 556', gst: g, trade: 'Electrician', terms: '7', bank: 'CBA', acct: 'Smith', bsb: '062-000', acno: '12345678' }, T: {} }));
  }, gst);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const choose = async (pg, tab, type) => {
  await pg.click(`nav button[data-t="${tab}"]`);
  await pg.selectOption('#i-ptype', type);
  await pg.waitForSelector('[data-k="lh1"]');
};
const fill = async (pg, k, v) => pg.fill(`[data-k="${k}"]`, v);
const txt = (pg, id) => pg.locator('#' + id).textContent();

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': Hourly rate on a Quote shows Labour and Materials and works out every amount', async () => {
    const pg = await open(url);
    await pg.click('nav button[data-t="Quote"]');
    assert.equal(await pg.locator('#i-ptype option').count(), 4);
    await choose(pg, 'Quote', HOURLY);
    assert.equal(await pg.locator('#addl').count(), 0, 'the plain line items are replaced');
    assert.equal(await pg.locator('#lm-addl').count(), 1);
    await fill(pg, 'ld1', 'Install');
    await fill(pg, 'lh1', '6');
    await fill(pg, 'lr1', '95');
    await fill(pg, 'lh2', '2');
    await fill(pg, 'lr2', '100');
    await fill(pg, 'mk', '20');
    await fill(pg, 'md1', 'Cable');
    await fill(pg, 'mc1', '100');
    await fill(pg, 'md2', 'Switch');
    await fill(pg, 'mq2', '2');
    await fill(pg, 'mc2', '50');
    await fill(pg, 'mm2', '50');
    assert.equal(await txt(pg, 'lm-l1'), '$570.00');
    assert.equal(await txt(pg, 'lm-m1'), '$120.00', 'the default markup applies');
    assert.equal(await txt(pg, 'lm-m2'), '$150.00', 'a markup typed on the row wins');
    assert.equal(await txt(pg, 'lm-lsub'), '$770.00');
    assert.equal(await txt(pg, 'lm-msub'), '$270.00');
    assert.equal(await txt(pg, 't1'), '$1,040.00');
    assert.equal(await txt(pg, 't3'), '$104.00');
    assert.equal(await txt(pg, 't4'), '$1,144.00');
    assert.equal(await txt(pg, 't4l'), 'ESTIMATED TOTAL');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal(await pg.locator('#paper table.lm').count(), 2);
    const heads = await pg.locator('#paper table.lm thead').allTextContents();
    assert.match(heads[0], /DateLabourHoursRate \(ex GST\)Amount \(ex GST\)/);
    assert.match(heads[1], /MaterialsQtyCost each \(ex GST\)MarkupAmount \(ex GST\)/);
    const mats = await pg.locator('#paper table.lm').nth(1).locator('tbody tr').allTextContents();
    assert.equal(mats[1], 'Switch2$50.0050%$150.00');
    const tot = await pg.locator('#paper .tot').first().textContent();
    assert.match(tot, /^Labour \(ex GST\)\$770\.00Materials \(ex GST\)\$270\.00Subtotal \(ex GST\)\$1,040\.00GST \(10%\)\$104\.00ESTIMATED TOTAL \(incl GST\)\$1,144\.00/);
    assert.match(await pg.locator('#paper').textContent(), /This is an estimate, not a fixed price/);
    assert.match(await pg.locator('#paper').textContent(), /Price type: Hourly rate/);
    await pg.click('#bk');
    await pg.selectOption('#i-mkshow', 'Show the final price only');
    await pg.click('#pv');
    const hidden = await pg.locator('#paper table.lm thead').nth(1).textContent();
    assert.equal(hidden, 'MaterialsQtyPrice each (ex GST)Amount (ex GST)');
    assert.equal((await pg.locator('#paper table.lm').nth(1).locator('tbody tr').allTextContents())[0], 'Cable1$120.00$120.00');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': switching back to Fixed price brings the plain lines back, and Hourly keeps what you typed', async () => {
    const pg = await open(url);
    await pg.click('nav button[data-t="Quote"]');
    await fill(pg, 'd1', 'Plain line');
    await fill(pg, 'q1', '2');
    await fill(pg, 'p1', '10');
    await choose(pg, 'Quote', HOURLY);
    await fill(pg, 'lh1', '3');
    await fill(pg, 'lr1', '100');
    assert.equal(await txt(pg, 't1'), '$300.00', 'hidden plain lines must not be added');
    await pg.selectOption('#i-ptype', 'Fixed price');
    await pg.waitForSelector('#addl');
    assert.equal(await pg.inputValue('[data-k="d1"]'), 'Plain line');
    assert.equal(await txt(pg, 't1'), '$20.00');
    assert.equal(await pg.locator('[data-k="lh1"]').count(), 0);
    await pg.selectOption('#i-ptype', HOURLY);
    await pg.waitForSelector('[data-k="lh1"]');
    assert.equal(await pg.inputValue('[data-k="lh1"]'), '3');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal(await pg.locator('#paper table:not(.lm)').count(), 0, 'no plain table beside the labour table');
  });

  await test(label + ': Cost plus on a Tax Invoice: same tables, GST on the marked-up price, and the $1,000 customer check still works', async () => {
    const pg = await open(url);
    await choose(pg, 'Tax Invoice', COST_PLUS);
    await fill(pg, 'lh1', '10');
    await fill(pg, 'lr1', '100');
    assert.equal(await txt(pg, 't4'), '$1,100.00');
    assert.match(await txt(pg, 'req'), /^REQUIRED: add the customer name or ABN/);
    await fill(pg, 'md1', 'Pipe');
    await fill(pg, 'mc1', '100');
    await fill(pg, 'mk', '20');
    assert.equal(await txt(pg, 't1'), '$1,120.00');
    assert.equal(await txt(pg, 't3'), '$112.00');
    assert.equal(await txt(pg, 't4'), '$1,232.00');
    await fill(pg, 'cust', 'A. Customer');
    assert.equal(await txt(pg, 'req'), '');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal(await pg.locator('#paper .ttl').textContent(), 'TAX INVOICE');
    assert.equal(await pg.locator('#paper table.lm').count(), 2);
    assert.match(await pg.locator('#paper .tot').first().textContent(), /TOTAL PAYABLE \(incl GST\)\$1,232\.00/);
    assert.match(await pg.locator('#paper').textContent(), /Total price includes GST of \$112\.00/);
  });

  await test(label + ': an Invoice for a business not registered for GST has no GST, and rows can be added and removed', async () => {
    const pg = await open(url, 'No');
    await choose(pg, 'Invoice', HOURLY);
    await fill(pg, 'lh1', '10');
    await fill(pg, 'lr1', '100');
    assert.equal(await txt(pg, 't4'), '$1,000.00');
    assert.equal(await pg.locator('[data-k^="lh"]').count(), 3);
    await pg.click('#lm-addl');
    await pg.waitForSelector('[data-k="lh4"]');
    await pg.click('#lm-addl');
    await pg.waitForSelector('[data-k="lh5"]');
    assert.equal(await pg.locator('[data-k^="lh"]').count(), 5);
    for (let i = 0; i < 6; i++) {
      if (await pg.locator('#lm-rml').isDisabled()) break;
      await pg.click('#lm-rml');
    }
    assert.equal(await pg.locator('[data-k^="lh"]').count(), 1);
    assert.equal(await pg.locator('#lm-rml').isDisabled(), true);
    assert.equal(await pg.inputValue('[data-k="lh1"]'), '10');
  });

  await test(label + ': typed HTML in a labour or material row stays text', async () => {
    const pg = await open(url);
    await choose(pg, 'Quote', COST_PLUS);
    await fill(pg, 'ld1', '<b>Labour</b>');
    await fill(pg, 'lh1', '1');
    await fill(pg, 'lr1', '90');
    await fill(pg, 'md1', '<i>Pipe</i>');
    await fill(pg, 'mc1', '10');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal(await pg.locator('#paper table.lm b, #paper table.lm i').count(), 0);
    assert.ok((await pg.locator('#paper').textContent()).includes('<b>Labour</b>'));
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Price type tests passed');
