// Browser tests. They open the real app in Chromium on a desktop and a phone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

const TABS = ['Start Here', 'My Details', 'Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Rate Calculator', 'Line Items', 'Worked Examples', 'Forms'];
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const URL = ORIGIN + '/app/';
const browser = await chromium.launch();

const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

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

/** A fresh browser profile on the app, with watchers for errors and outside requests. */
async function open(kind = DESKTOP) {
  const context = await browser.newContext(kind);
  const page = await context.newPage();
  page.problems = [];
  page.outside = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('response', (r) => r.status() >= 400 && page.problems.push(r.status() + ' ' + r.url()));
  page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && page.outside.push(r.url()));
  await page.goto(URL);
  await page.waitForSelector('nav button');
  return page;
}

const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const text = (pg, id) => pg.evaluate((i) => (document.getElementById(i) ? document.getElementById(i).textContent : null), id);
const body = (pg) => pg.evaluate(() => document.getElementById('m').textContent || '');
const paper = (pg) => pg.evaluate(() => (document.getElementById('paper') || { textContent: '' }).textContent || '');
const line = (pg, i, d, q, p) => pg.fill(`[data-k="d${i}"]`, d).then(() => pg.fill(`[data-k="q${i}"]`, q)).then(() => pg.fill(`[data-k="p${i}"]`, p));

async function details(pg) {
  await tab(pg, 'My Details');
  await pg.fill('#i-name', 'Smith Electrical');
  await pg.fill('#i-abn', '51824753556');
  await pg.fill('#i-lic', 'EC12345');
  await pg.fill('#i-phone', '0412 345 678');
  await pg.fill('#i-email', 'jo@smithelectrical.com.au');
  await pg.fill('#i-bank', 'Commonwealth Bank');
  await pg.fill('#i-acct', 'Smith Electrical');
  await pg.fill('#i-bsb', '062000');
  await pg.fill('#i-acno', '12345678');
  await pg.fill('#i-payid', '0412 345 678');
  await pg.fill('#i-card', 'pay.example.com/smith');
  await pg.click('#i-card');
  await pg.click('#i-name');
}

/** The typed words must sit ABOVE the line and the label BELOW it. */
async function signatureOrder(pg, scope) {
  for (const key of ['an', 'as', 'ad']) {
    const field = await pg.locator(key === 'ad' ? '#c-adf' : `#i-${key}`).boundingBox();
    const label = await pg.locator(`label[for="i-${key}"]`).boundingBox();
    assert.ok(field && label, scope + ' ' + key + ': box or label missing');
    assert.ok(field.y + field.height <= label.y + 1, `${scope} ${key}: typed words are not above the line (box bottom ${field.y + field.height}, line ${label.y})`);
    const rule = await pg.locator(`label[for="i-${key}"]`).evaluate((e) => parseFloat(getComputedStyle(e).borderTopWidth));
    assert.ok(rule >= 1, scope + ' ' + key + ': the line is missing');
  }
}

/* ---------- 1. every tab, desktop and phone ---------- */
for (const [label, kind] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  await test(`every tab opens clean on ${label}`, async () => {
    const pg = await open(kind);
    for (const t of TABS) {
      await tab(pg, t);
      const b = await body(pg);
      assert.ok(!/undefined|NaN|\[object/.test(b), t + ': shows undefined or NaN');
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(wide <= 1, t + ': sideways scroll of ' + wide + 'px');
    }
    assert.deepEqual(pg.problems, []);
    assert.deepEqual(pg.outside, [], 'the app asked another website for something');
  });
}

await test('phone: boxes and buttons are big enough to tap', async () => {
  const pg = await open(PHONE);
  for (const t of ['My Details', 'Quote', 'Tax Invoice']) {
    await tab(pg, t);
    const small = await pg.evaluate(() =>
      [...document.querySelectorAll('#m input:not([type=date]), #m select, #m textarea, #m button')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).map((e) => e.id || e.dataset.k || e.textContent));
    assert.deepEqual(small, [], t + ' has small tap targets');
  }
});

/* ---------- 2. nothing dropped ---------- */
await test('feature lock: every label, field and button is still there', async () => {
  const pg = await open();
  const must = {
    'Start Here': ['SET UP AND USE', 'WHICH TAB DO I USE?', 'WHAT THIS KIT FOLLOWS', 'Open My Details.', 'Not sure if you charge GST?', 'Dates: pick them from the calendar.', 'Send it: tap Save as PDF', 'Customer wants to pay by card?', 'last updated 18 September 2026', 'Not approved or endorsed by the ATO', 'Your details stay on this device. Nothing you type is sent to anyone.', 'General template for administrative and educational use only'],
    'My Details': ['Business name', 'ABN (11 digits)', 'Licence no. (if you have one)', 'Phone', 'Email', 'Registered for GST?', 'Your trade', 'Type your trade', 'Bank name', 'Bank account name', 'BSB', 'Account number', 'PayID (optional)', 'Card payment link (optional)', 'Payment terms (days)', 'GST rate (%)'],
    Quote: ['QUOTE DETAILS', 'Quote no.', 'Client / customer name', 'Valid until', 'Phone / email', 'Job site', 'SCOPE AND PRICE', 'Scope of work', 'Price type', 'Unit price (ex GST)', 'Subtotal (ex GST)', 'TERMS', 'Inclusions', 'Exclusions', 'Deposit (%)', 'Balance due', 'Quote fee ($)', 'Credited if they go ahead?', 'PAYMENT DETAILS', 'ACCEPTANCE', 'I accept this quote.', 'Client / customer signature', 'Variations: any change to the scope of work'],
    'Tax Invoice': ['INVOICE DETAILS', 'Invoice no.', 'Issue date', 'Bill to', 'Due date', 'Customer ABN', 'Job address', 'GST on item?', 'TOTAL PAYABLE (incl GST)', 'PAYMENT DETAILS'],
    Invoice: ['Invoice no.', 'Issue date', 'Bill to', 'Due date', 'Job address', 'TOTAL PAYABLE', 'GST not applicable. Supplier is not registered for GST.'],
    Variation: ['VARIATION DETAILS', 'Variation no.', 'Quote / job no.', 'Extra days', 'Why the change?', 'Describe the reason', 'WHAT IS CHANGING', 'Describe the change', 'THIS VARIATION (extra cost)', 'NEW CONTRACT TOTAL', 'Original quote total', 'Earlier approved variations on this job ($)', 'NEW TOTAL', 'How it gets paid', 'CUSTOMER APPROVAL', 'I approve this variation', 'Client / customer signature'],
    'Rate Calculator': ['1. YOUR MINIMUM HOURLY RATE', 'Wage you want before tax ($ a year)', 'Business costs ($ a year)', 'Weeks you work a year', 'Chargeable hours a week', 'MINIMUM HOURLY RATE (ex GST)', 'Same rate including GST', '2. MATERIALS MARKUP', 'Margin (profit as % of sell price)', '3. WHAT EACH MARKUP REALLY EARNS', '50% markup', '33% markup, not 25%'],
    'Line Items': ['ELECTRICIAN LINE ITEMS', 'COMMON LINE ITEMS', 'Supply and install safety switch (RCD)', 'SUGGESTED EXCLUSIONS'],
    'Worked Examples': ['EXAMPLE A: SPARKY QUOTE (Q-001)', '$511.50', 'EXAMPLE B: PLUMBER TAX INVOICE (INV-014)', '$313.50'],
  };
  const keys = {
    'My Details': ['name', 'abn', 'lic', 'phone', 'email', 'gst', 'trade', 'tradeo', 'bank', 'acct', 'bsb', 'acno', 'payid', 'card', 'terms', 'rate'],
    Quote: ['no', 'date', 'cust', 'phone', 'addr', 'site', 'scope', 'ptype', 'incl', 'excl', 'dep', 'bal', 'fee', 'feec', 'an', 'as', 'ad', 'd1', 'q1', 'p1', 'g1'],
    'Tax Invoice': ['no', 'date', 'cust', 'cabn', 'addr', 'site', 'd1', 'q1', 'p1', 'g1'],
    Invoice: ['no', 'date', 'cust', 'addr', 'site', 'd1', 'q1', 'p1'],
    Variation: ['no', 'date', 'qno', 'days', 'cust', 'site', 'why', 'whyo', 'desc', 'orig', 'prev', 'pay', 'an', 'as', 'ad', 'd1', 'g1'],
    'Rate Calculator': ['wage', 'costs', 'weeks', 'hrs', 'part', 'mk'],
  };
  const buttons = { Quote: ['pv', 'pdf', 'clr', 'addl', 'rml'], 'Tax Invoice': ['pv', 'pdf', 'clr', 'addl', 'rml'], Invoice: ['pv', 'pdf', 'clr', 'addl', 'rml'], Variation: ['pv', 'pdf', 'clr', 'addl', 'rml'] };
  for (const [t, list] of Object.entries(must)) {
    await tab(pg, t);
    const b = await body(pg);
    for (const s of list) assert.ok(b.includes(s), `${t}: "${s}" is missing`);
    for (const k of keys[t] || []) assert.ok((await pg.locator(`#m [data-k="${k}"]`).count()) > 0, `${t}: field ${k} is missing`);
    for (const id of buttons[t] || []) assert.ok((await pg.locator('#' + id).count()) === 1, `${t}: button #${id} is missing`);
  }
  await tab(pg, 'Line Items');
  assert.equal(await pg.locator('#m .tr.plain').count(), 17);
});

await test('feature lock list: every text, field and button from the earlier app is still here', async () => {
  const lock = JSON.parse(readFileSync('tests/lock.json', 'utf8'));
  const pg = await open();
  const seen = { text: '', keys: new Set(), ids: new Set() };
  for (const trade of ['Electrician', 'Plumber', 'Other']) {
    await tab(pg, 'My Details');
    await pg.selectOption('#i-trade', trade);
    for (const t of TABS) {
      await tab(pg, t);
      if (t === 'Variation') await pg.selectOption('#i-why', 'Other');
      const r = await pg.evaluate(() => ({
        text: document.body.textContent + ' ' + [...document.querySelectorAll('[placeholder]')].map((e) => e.getAttribute('placeholder')).join(' | '),
        keys: [...document.querySelectorAll('#m [data-k]')].map((e) => e.dataset.k),
        ids: [...document.querySelectorAll('#m [id]')].map((e) => e.id),
      }));
      seen.text += ' ' + r.text;
      r.keys.forEach((k) => seen.keys.add(k));
      r.ids.forEach((i) => seen.ids.add(i));
      if (['Quote', 'Tax Invoice', 'Invoice', 'Variation'].includes(t)) {
        await pg.click('#pv');
        seen.text += ' ' + (await paper(pg));
        await pg.click('#bk');
      }
    }
  }
  const flat = seen.text.replace(/\s+/g, ' ');
  const lostText = lock.strings.filter((s) => !flat.includes(s.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(lostText, [], 'texts that went missing');
  assert.deepEqual(lock.keys.filter((k) => !seen.keys.has(k)), [], 'fields that went missing');
  assert.deepEqual(lock.ids.filter((i) => !seen.ids.has(i)), [], 'buttons that went missing');
});

/* ---------- 3. My Details ---------- */
await test('My Details: ABN, BSB and money tidy up, Other boxes show', async () => {
  const pg = await open();
  await tab(pg, 'My Details');
  await pg.fill('#i-abn', '51824753556');
  await pg.fill('#i-bsb', '062000');
  await pg.click('#i-name');
  assert.equal(await pg.inputValue('#i-abn'), '51 824 753 556');
  assert.equal(await pg.inputValue('#i-bsb'), '062-000');
  assert.equal(await text(pg, 'abn-hint'), '');
  await pg.fill('#i-abn', '51 824 753 557');
  assert.match(await text(pg, 'abn-hint'), /does not look right/);
  assert.equal(await pg.isVisible('#w-tradeo'), false);
  await pg.selectOption('#i-trade', 'Other');
  assert.equal(await pg.isVisible('#w-tradeo'), true);
  await pg.fill('#i-tradeo', 'Carpenter');
  await tab(pg, 'Line Items');
  assert.match(await body(pg), /CARPENTER LINE ITEMS/);
  await tab(pg, 'Variation');
  assert.equal(await pg.isVisible('#w-whyo'), false);
  await pg.selectOption('#i-why', 'Other');
  assert.equal(await pg.isVisible('#w-whyo'), true);
});

/* ---------- 4. Tax Invoice ---------- */
await test('Tax Invoice: maths, dates, GST-free line, warning, lines, saved after reload', async () => {
  const pg = await open();
  await details(pg);
  await tab(pg, 'Tax Invoice');
  await line(pg, 1, 'Switchboard upgrade', '1', '1350');
  await line(pg, 2, 'Labour', '4', '110');
  assert.deepEqual([await text(pg, 't1'), await text(pg, 't3'), await text(pg, 't4')], ['$1,790.00', '$179.00', '$1,969.00']);
  assert.equal(await text(pg, 'c-gn'), 'Total price includes GST of $179.00');
  assert.match(await text(pg, 'req'), /REQUIRED: add the customer name or ABN/);
  await pg.fill('#i-cust', 'A. Customer');
  assert.equal(await text(pg, 'req'), '');
  await pg.fill('#i-date', '2026-10-06');
  assert.equal(await text(pg, 'c-datef'), '6 Oct 2026');
  assert.equal(await text(pg, 'c-due'), '13 Oct 2026');
  await pg.selectOption('[data-k="g1"]', 'No');
  assert.deepEqual([await text(pg, 't3'), await text(pg, 't4')], ['$44.00', '$1,834.00']);
  assert.match(await text(pg, 'c-gn'), /Items marked No are GST-free/);
  assert.equal(await pg.locator('#m .ln:not(.th)').count(), 8);
  await pg.click('#addl');
  assert.equal(await pg.locator('#m .ln:not(.th)').count(), 9);
  assert.equal(await pg.inputValue('[data-k="d1"]'), 'Switchboard upgrade');
  await pg.click('#rml');
  assert.equal(await pg.locator('#m .ln:not(.th)').count(), 8);
  await pg.reload();
  await tab(pg, 'Tax Invoice');
  assert.equal(await pg.inputValue('[data-k="d1"]'), 'Switchboard upgrade');
  assert.equal(await pg.inputValue('[data-k="p1"]'), '$1,350.00');
  assert.equal(await text(pg, 't4'), '$1,834.00');
  assert.deepEqual(pg.problems, []);
});

await test('GST warnings send people to the right tab', async () => {
  const pg = await open();
  await tab(pg, 'Invoice');
  assert.match(await text(pg, 'leg'), /STOP: you are registered for GST\. Use the Tax Invoice tab/);
  await tab(pg, 'My Details');
  await pg.selectOption('#i-gst', 'No');
  await tab(pg, 'Invoice');
  assert.match(await text(pg, 'leg'), /Type in the cream boxes/);
  await line(pg, 1, 'Labour', '2', '100');
  assert.equal(await text(pg, 't4'), '$200.00');
  await tab(pg, 'Tax Invoice');
  assert.match(await text(pg, 'leg'), /STOP: you are not registered for GST\. Use the Invoice tab/);
  await tab(pg, 'Quote');
  await line(pg, 1, 'Labour', '3', '95');
  assert.deepEqual([await text(pg, 't3'), await text(pg, 't4')], ['', '$285.00']);
  assert.match(await text(pg, 'c-gn'), /Not registered for GST/);
});

/* ---------- 5. preview and print ---------- */
await test('Preview: clean finished tax invoice with payment details', async () => {
  const pg = await open();
  await details(pg);
  await tab(pg, 'Tax Invoice');
  await pg.fill('#i-no', 'INV-014');
  await pg.fill('#i-date', '2026-10-06');
  await pg.fill('#i-cust', 'A. Customer');
  await line(pg, 1, 'Replace mixer tap', '1', '120');
  await pg.click('#pv');
  const p = await paper(pg);
  for (const s of ['TAX INVOICE', 'Smith Electrical', '51 824 753 556', 'EC12345', 'jo@smithelectrical.com.au', 'INV-014', '6 Oct 2026', '13 Oct 2026', 'Bill to:', 'A. Customer', 'Replace mixer tap', 'TOTAL PAYABLE (incl GST)', '$132.00', 'Total price includes GST of $12.00', 'PAYMENT DETAILS', 'Commonwealth Bank', '062-000', '12345678', 'Reference', 'Pay by card:', 'Payment due within 7 days'])
    assert.ok(p.includes(s), 'preview is missing: ' + s);
  assert.equal(await pg.locator('#paper tr').count(), 2, 'empty lines should be left out');
  assert.equal(await pg.locator('#paper .pc b').count(), 1);
  assert.equal(await pg.evaluate(() => getComputedStyle(document.querySelector('#paper .pc b')).fontWeight), '700');
  assert.equal(await pg.getAttribute('#paper .pc a', 'href'), 'https://pay.example.com/smith');
  await pg.click('#bk');
  assert.equal(await pg.isVisible('#paper'), false);
});

await test('Print: one A4 page for a blank and a busy document', async () => {
  const pg = await open();
  await details(pg);
  for (const t of ['Tax Invoice', 'Quote']) {
    await tab(pg, t);
    for (let i = 1; i <= 6; i++) await line(pg, i, 'Item number ' + i, '2', '45.50');
    await pg.fill('#i-cust', 'A. Customer');
    await pg.emulateMedia({ media: 'print' });
    const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1, t + ' is more than one page');
    await pg.emulateMedia({ media: 'screen' });
  }
});

/* ---------- 6. Quote ---------- */
await test('Quote: GST, valid until, deposit, quote fee, preview', async () => {
  const pg = await open();
  await details(pg);
  await tab(pg, 'Quote');
  await pg.fill('#i-no', 'Q-001');
  await pg.fill('#i-date', '2026-10-06');
  await pg.fill('#i-cust', 'A. Customer');
  await line(pg, 1, 'Labour', '3', '95');
  assert.equal(await text(pg, 'c-valid'), '5 Nov 2026');
  assert.deepEqual([await text(pg, 't1'), await text(pg, 't3'), await text(pg, 't4')], ['$285.00', '$28.50', '$313.50']);
  assert.match(await text(pg, 'c-gn'), /GST is added to items marked Yes/);
  await pg.fill('#i-dep', '20');
  assert.match(await text(pg, 'c-dn'), /^Deposit due: \$62\.70/);
  await pg.fill('#i-fee', '50');
  assert.match(await text(pg, 'c-fn'), /\$263\.50 left to pay/);
  await pg.selectOption('#i-feec', 'No');
  assert.match(await text(pg, 'c-fn'), /not credited back/);
  await pg.selectOption('#i-feec', 'Yes');
  await pg.click('#pv');
  const p = await paper(pg);
  for (const s of ['QUOTE', 'Prepared for:', 'Valid until', '5 Nov 2026', 'Fixed price', 'TOTAL (incl GST)', 'Deposit:', '$62.70', 'Quote fee:', '$263.50 left to pay', 'I accept this quote.', 'Client / customer name', 'Client / customer signature', 'Variations: any change'])
    assert.ok(p.includes(s), 'quote preview is missing: ' + s);
});

await test('Quote: an Estimate is labelled as an estimate, a fixed price is not, and start and completion show when typed', async () => {
  const pg = await open();
  await tab(pg, 'Quote');
  await line(pg, 1, 'Labour', '3', '95');
  assert.equal(await text(pg, 't4l'), 'TOTAL');
  await pg.click('#pv');
  let p = await paper(pg);
  assert.ok(p.includes('TOTAL (incl GST)') && !p.includes('ESTIMATED TOTAL') && !p.includes('This is an estimate') && !p.includes('Estimated start'), 'a fixed price should look as before');
  await pg.click('#bk');
  await pg.selectOption('#i-ptype', 'Estimate (final price based on actual hours and materials)');
  assert.equal(await text(pg, 't4l'), 'ESTIMATED TOTAL');
  await pg.fill('#i-start', 'TBC on acceptance');
  await pg.fill('#i-finish', '2 days from start');
  await pg.click('#pv');
  p = await paper(pg);
  for (const s of ['ESTIMATED TOTAL (incl GST)', '$313.50', 'This is an estimate, not a fixed price', 'Price type:', 'Estimated start:', 'TBC on acceptance', 'Estimated completion:', '2 days from start']) assert.ok(p.includes(s), 'estimate quote is missing: ' + s);
  await pg.click('#bk');
  await pg.selectOption('#i-ptype', 'Fixed price');
  assert.equal(await text(pg, 't4l'), 'TOTAL');
  assert.match(await text(pg, 'c-dn'), /home warranty insurance/);
});

/* ---------- 7. the signature fix ---------- */
for (const [label, kind] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  await test(`signature: typed words sit above the line on ${label} (Quote and Variation, editing and preview)`, async () => {
    const pg = await open(kind);
    for (const t of ['Quote', 'Variation']) {
      await tab(pg, t);
      await pg.fill('#i-an', 'A. Customer');
      await pg.fill('#i-as', 'A Customer');
      await pg.fill('#i-ad', '2026-10-06');
      assert.equal(await text(pg, 'c-adf'), '6 Oct 2026');
      await signatureOrder(pg, t + ' editing');
      await pg.locator('#i-an').scrollIntoViewIfNeeded();
      await pg.click('#pv');
      const em = await pg.locator('#paper .sg .c em').first().boundingBox();
      const span = await pg.locator('#paper .sg .c span').first().boundingBox();
      assert.ok(em && span && em.y + em.height <= span.y + 1, t + ' preview: typed name is not above the line');
      const shown = await pg.locator('#paper .sg .c em').allTextContents();
      assert.deepEqual(shown, ['A. Customer', 'A Customer', '6 Oct 2026']);
      await pg.click('#bk');
    }
  });
}

await test('phone: the finished document fits the screen with nothing cut off', async () => {
  const pg = await open(PHONE);
  await details(pg);
  for (const t of ['Quote', 'Tax Invoice', 'Variation']) {
    await tab(pg, t);
    await line(pg, 1, 'Supply and install LED downlight', '12', '1234.50');
    await pg.click('#pv');
    const r = await pg.evaluate(() => {
      const p = document.getElementById('paper');
      const tb = p.querySelector('table').getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return { clipped: p.scrollWidth - p.clientWidth, over: tb.right - pr.right, page: document.documentElement.scrollWidth - innerWidth };
    });
    assert.ok(r.clipped <= 1 && r.over <= 1 && r.page <= 1, t + ' preview is cut off on a phone: ' + JSON.stringify(r));
    await pg.click('#bk');
  }
});

/* ---------- 8. Variation and Rate Calculator ---------- */
await test('Variation: totals follow the Quote, and can be overridden', async () => {
  const pg = await open();
  await tab(pg, 'Quote');
  await line(pg, 1, 'Labour', '3', '95');
  await line(pg, 2, 'Downlights', '6', '30');
  assert.equal(await text(pg, 't4'), '$511.50');
  await tab(pg, 'Variation');
  await line(pg, 1, 'Labour', '1', '95');
  await line(pg, 2, 'Downlights', '2', '30');
  assert.deepEqual([await text(pg, 't1'), await text(pg, 't3'), await text(pg, 't4')], ['$155.00', '$15.50', '$170.50']);
  assert.deepEqual([await text(pg, 'v3'), await text(pg, 'v4')], ['$170.50', '$682.00']);
  assert.equal(await pg.getAttribute('#i-orig', 'placeholder'), '$511.50');
  await pg.fill('#i-orig', '1000');
  await pg.fill('#i-prev', '100');
  assert.equal(await text(pg, 'v4'), '$1,270.50');
  await pg.click('#pv');
  const p = await paper(pg);
  for (const s of ['VARIATION', 'Why the change:', 'Customer asked for it', 'Original quote total', '$1,000.00', 'NEW TOTAL', '$1,270.50', 'How it gets paid', 'Added to the final invoice'])
    assert.ok(p.includes(s), 'variation preview is missing: ' + s);
});

await test('Rate Calculator: starting numbers and changes', async () => {
  const pg = await open();
  await tab(pg, 'Rate Calculator');
  assert.deepEqual([await text(pg, 'c-need'), await text(pg, 'c-hy'), await text(pg, 'rt'), await text(pg, 'c-rg')], ['$115,000.00', '1,150', '$100.00', '$110.00']);
  assert.deepEqual([await text(pg, 'c-sp'), await text(pg, 'c-pf'), await text(pg, 'c-mg')], ['$156.00', '$36.00', '23.1%']);
  await pg.fill('#i-mk', '50');
  assert.equal(await text(pg, 'c-sp'), '$180.00');
  await tab(pg, 'My Details');
  await pg.selectOption('#i-gst', 'No');
  await tab(pg, 'Rate Calculator');
  assert.equal(await text(pg, 'c-rg'), '$100.00');
});

/* ---------- 9. clear, security, privacy ---------- */
await test('Clear this document keeps My Details', async () => {
  const pg = await open();
  await details(pg);
  await tab(pg, 'Invoice');
  await line(pg, 1, 'Labour', '1', '100');
  await pg.click('#addl');
  pg.once('dialog', (d) => d.accept());
  await pg.click('#clr');
  assert.equal(await pg.inputValue('[data-k="d1"]'), '');
  assert.equal(await pg.locator('#m .ln:not(.th)').count(), 8);
  await tab(pg, 'My Details');
  assert.equal(await pg.inputValue('#i-bank'), 'Commonwealth Bank');
});

await test('security: typed HTML stays text, bad links are not links', async () => {
  const pg = await open();
  await tab(pg, 'My Details');
  await pg.fill('#i-name', '<img src=x onerror="window.hacked=1">');
  await pg.fill('#i-bank', 'Bank');
  await pg.fill('#i-card', 'javascript:alert(1)');
  await tab(pg, 'Invoice');
  await pg.fill('#i-cust', '<b>Bold</b>');
  await line(pg, 1, '<script>window.hacked=2</script>', '1', '10');
  await pg.click('#pv');
  assert.equal(await pg.evaluate(() => window.hacked), undefined);
  assert.equal(await pg.locator('#paper img, #paper script, #paper b:text("Bold")').count(), 0);
  assert.equal(await pg.locator('#paper .pc a').count(), 0);
  assert.ok((await paper(pg)).includes('<img src=x'));
});

await test('security headers are served and nothing breaks the policy', async () => {
  const res = await fetch(URL);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /style-src 'self'(?!.*unsafe-inline)/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  const home = await fetch(ORIGIN + '/');
  assert.match(await home.text(), /url=\/app\//);
});

await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' browser test(s) failed');
  process.exit(1);
}
console.log('browser tests passed');
