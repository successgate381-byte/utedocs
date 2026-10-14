// P4 tests: the Xero invoice CSV (Pro only).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { XERO_COLUMNS, buildXeroCsv, checkXero, xeroFileName } from '../site/pro/js/xero-csv.js';

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

/** Xero's template columns, written out by hand so a mistake in the code cannot hide itself. */
const XERO_HEADER = '*ContactName,EmailAddress,POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,Total,InventoryItemCode,*Description,*Quantity,*UnitAmount,Discount,*AccountCode,*TaxType,TaxAmount,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2,Currency,BrandingTheme'.split(',');

/** A small CSV reader, so the tests check real cells and not just text. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const asObjects = (text) => {
  const [head, ...rest] = parseCsv(text);
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};

/* ---------- the file, no browser ---------- */
const base = {
  contact: 'A. Customer', address: '1 Example St, Parramatta NSW 2150', site: '12 Job Rd', number: 'INV-014', issue: '2026-10-06', terms: '7',
  lines: [{ d: 'Labour', q: '1.5', p: '110', g: 'Yes' }, { d: 'Mixer tap supplied', q: '1', p: '$120.00', g: 'No' }, { d: '', q: '', p: '', g: 'Yes' }],
};

await test('file: Xero columns in Xero order, one row per used line, Australian dates', () => {
  const out = buildXeroCsv(base);
  assert.deepEqual(out.missing, []);
  assert.equal(out.rows, 2);
  assert.ok(out.csv.endsWith('\r\n') && !out.csv.startsWith('\uFEFF'));
  assert.deepEqual(parseCsv(out.csv)[0], XERO_HEADER);
  assert.deepEqual(XERO_COLUMNS, XERO_HEADER);
  const [a, b] = asObjects(out.csv);
  assert.deepEqual(
    [a['*ContactName'], a.POAddressLine1, a['*InvoiceNumber'], a.Reference, a['*InvoiceDate'], a['*DueDate'], a['*Description'], a['*Quantity'], a['*UnitAmount'], a['*AccountCode'], a['*TaxType']],
    ['A. Customer', '1 Example St, Parramatta NSW 2150', 'INV-014', '12 Job Rd', '06/10/2026', '13/10/2026', 'Labour', '1.5', '110.00', '200', 'GST on Income'],
  );
  assert.deepEqual([b['*Description'], b['*Quantity'], b['*UnitAmount'], b['*TaxType']], ['Mixer tap supplied', '1', '120.00', 'GST Free Income']);
  const filled = new Set(['*ContactName', 'POAddressLine1', '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', '*Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType']);
  for (const col of XERO_HEADER) if (!filled.has(col)) assert.equal(a[col], '', col + ' should stay empty');
});

await test('file: the person own account code and tax names are used', () => {
  const [a, b] = asObjects(buildXeroCsv({ ...base, account: ' 210 ', gstName: 'GST (Sales)', freeName: 'No GST (Sales)' }).csv);
  assert.deepEqual([a['*AccountCode'], a['*TaxType'], b['*TaxType']], ['210', 'GST (Sales)', 'No GST (Sales)']);
});

await test('file: missing details are listed and no file is made', () => {
  const none = buildXeroCsv({ contact: '', address: '', site: '', number: '', issue: '', terms: '7', lines: [] });
  assert.equal(none.csv, '');
  assert.deepEqual(none.missing, ['customer name', 'invoice number', 'issue date', 'at least one line with a quantity and price']);
  assert.deepEqual(buildXeroCsv({ ...base, number: ' ' }).missing, ['invoice number']);
});

await test('file: commas, quotes and new lines are safe, and formulas are switched off', () => {
  const out = buildXeroCsv({ ...base, contact: 'Smith, "Bob" & Co', address: '1 Example St\nParramatta', lines: [{ d: '=HYPERLINK("http://x")', q: '1', p: '10', g: 'Yes' }] });
  const [a] = asObjects(out.csv);
  assert.equal(a['*ContactName'], 'Smith, "Bob" & Co');
  assert.equal(a.POAddressLine1, '1 Example St Parramatta');
  assert.equal(a['*Description'], ' =HYPERLINK("http://x")');
  assert.equal(parseCsv(out.csv).length, 2);
});

await test('file: blank description, big amounts and no payment terms', () => {
  const out = buildXeroCsv({ ...base, terms: '', lines: [{ d: '', q: '2', p: '$1,350.5', g: 'Yes' }] });
  const [a] = asObjects(out.csv);
  assert.deepEqual([a['*Description'], a['*Quantity'], a['*UnitAmount'], a['*DueDate']], ['Item 1', '2', '1350.50', '06/10/2026']);
});

await test('file name is safe', () => {
  assert.equal(xeroFileName('INV-014'), 'xero-invoice-INV-014.csv');
  assert.equal(xeroFileName('../../etc/passwd x'), 'xero-invoice-etc-passwd-x.csv');
  assert.equal(xeroFileName(''), 'xero-invoice-export.csv');
});

/* ---------- the button in a real browser ---------- */
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

async function open(url, kind = DESKTOP) {
  const page = await (await browser.newContext({ ...kind, acceptDownloads: true })).newPage();
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
const line = (pg, i, d, q, p) => pg.fill(`[data-k="d${i}"]`, d).then(() => pg.fill(`[data-k="q${i}"]`, q)).then(() => pg.fill(`[data-k="p${i}"]`, p));
async function fillInvoice(pg) {
  await tab(pg, 'Tax Invoice');
  await pg.fill('#i-no', 'INV-014');
  await pg.fill('#i-date', '2026-10-06');
  await pg.fill('#i-cust', 'A. Customer');
  await pg.fill('#i-addr', '1 Example St, Parramatta NSW 2150');
  await pg.fill('#i-site', '12 Job Rd');
  await line(pg, 1, 'Labour', '1.5', '110');
  await line(pg, 2, 'Mixer tap supplied', '1', '120');
  await pg.selectOption('[data-k="g2"]', 'No');
}
const gotDownload = (pg, ms = 700) => pg.waitForEvent('download', { timeout: ms }).then((d) => d, () => null);

await test('the button is on the Pro Tax Invoice only; the settings are on the Pro My Details only', async () => {
  const pro = await open('/pro/');
  await tab(pro, 'Tax Invoice');
  assert.equal(await pro.locator('#xe-csv').count(), 1);
  for (const t of ['Quote', 'Variation', 'Progress Claim']) {
    await tab(pro, t);
    assert.equal(await pro.locator('#xe-csv').count(), 0, t + ' should not have the Xero button');
  }
  await tab(pro, 'Invoice');
  assert.equal(await pro.locator('#xe-csv').count(), 1);
  await tab(pro, 'My Details');
  assert.deepEqual([await pro.inputValue('#i-xacct'), await pro.inputValue('#i-xtax'), await pro.inputValue('#i-xfree'), await pro.inputValue('#i-xnone')], ['200', 'GST on Income', 'GST Free Income', 'BAS Excluded']);
  const lite = await open('/app/');
  await tab(lite, 'Tax Invoice');
  assert.equal(await lite.locator('#xe-csv').count(), 0);
  await tab(lite, 'My Details');
  assert.equal(await lite.locator('#i-xacct').count(), 0);
});

await test('an unfinished invoice says what Xero needs and makes no file', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Tax Invoice');
  const waiting = gotDownload(pg);
  await pg.click('#xe-csv');
  assert.equal(await pg.locator('#xe-msg').textContent(), 'Xero needs: customer name, invoice number, issue date, at least one line with a quantity and price.');
  assert.equal(await waiting, null, 'a file was made');
  await pg.fill('#i-cust', 'A. Customer');
  await pg.click('#xe-csv');
  assert.match(await pg.locator('#xe-msg').textContent(), /^Xero needs: invoice number, issue date/);
});

for (const [label, kind] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  await test(`a finished invoice downloads the right file on ${label}`, async () => {
    const pg = await open('/pro/', kind);
    await fillInvoice(pg);
    const waiting = gotDownload(pg, 4000);
    await pg.click('#xe-csv');
    const file = await waiting;
    assert.ok(file, 'no file was downloaded');
    assert.equal(file.suggestedFilename(), 'xero-invoice-INV-014.csv');
    const text = readFileSync(await file.path(), 'utf8');
    assert.ok(!text.startsWith('\uFEFF') && text.endsWith('\r\n'));
    const [a, b] = asObjects(text);
    assert.deepEqual(parseCsv(text)[0], XERO_HEADER);
    assert.deepEqual([a['*ContactName'], a['*InvoiceNumber'], a['*InvoiceDate'], a['*DueDate'], a['*Description'], a['*Quantity'], a['*UnitAmount'], a['*AccountCode'], a['*TaxType']],
      ['A. Customer', 'INV-014', '06/10/2026', '13/10/2026', 'Labour', '1.5', '110.00', '200', 'GST on Income']);
    assert.deepEqual([b['*Description'], b['*UnitAmount'], b['*TaxType']], ['Mixer tap supplied', '120.00', 'GST Free Income']);
    assert.equal(a.POAddressLine1, '1 Example St, Parramatta NSW 2150');
    assert.equal(a.Reference, '12 Job Rd');
    assert.equal(await pg.locator('#xe-msg').textContent(), '');
    assert.deepEqual(pg.problems, []);
    assert.deepEqual(pg.outside, []);
  });
}

await test('the settings change the file and are still there after a reload', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'My Details');
  await pg.fill('#i-xacct', '210');
  await pg.fill('#i-xtax', 'GST on Income (Sales)');
  await pg.fill('#i-xfree', 'No GST Sales');
  await fillInvoice(pg);
  let waiting = gotDownload(pg, 4000);
  await pg.click('#xe-csv');
  let [a, b] = asObjects(readFileSync(await (await waiting).path(), 'utf8'));
  assert.deepEqual([a['*AccountCode'], a['*TaxType'], b['*TaxType']], ['210', 'GST on Income (Sales)', 'No GST Sales']);
  await pg.reload();
  await tab(pg, 'My Details');
  assert.equal(await pg.inputValue('#i-xacct'), '210');
  await pg.fill('#i-xacct', '');
  await tab(pg, 'Tax Invoice');
  waiting = gotDownload(pg, 4000);
  await pg.click('#xe-csv');
  [a, b] = asObjects(readFileSync(await (await waiting).path(), 'utf8'));
  assert.equal(a['*AccountCode'], '200', 'an empty box should fall back to 200');
});

await test('a customer name that looks like a formula cannot run in a spreadsheet', async () => {
  const pg = await open('/pro/');
  await fillInvoice(pg);
  await pg.fill('#i-cust', '=1+1');
  const waiting = gotDownload(pg, 4000);
  await pg.click('#xe-csv');
  const [a] = asObjects(readFileSync(await (await waiting).path(), 'utf8'));
  assert.equal(a['*ContactName'], ' =1+1');
});

/* ---------- against Xero's own template file ---------- */
await test("Xero's own Bill template: every column in it is in our file, with the same name, in the same order", () => {
  const bill = readFileSync('tests/fixtures/xero-bill-template.csv', 'utf8').trim().split(',');
  const plain = (c) => c.replace(/^\*/, '');
  const ours = XERO_HEADER.map(plain);
  const theirs = bill.map(plain);
  assert.equal(bill.length, 26);
  assert.deepEqual(ours.filter((c) => theirs.includes(c)), theirs);
  assert.deepEqual(ours.filter((c) => !theirs.includes(c)), ['Reference', 'Discount', 'BrandingTheme']);
  for (const c of ['POCity', 'PORegion', 'POPostalCode', 'POCountry']) assert.ok(bill.includes(c), c);
});

await test("Xero's own Sales Invoice template: our header is identical, and our files start with it", () => {
  const header = readFileSync('tests/fixtures/xero-sales-invoice-template.csv', 'utf8').split(/\r?\n/)[0];
  assert.equal(header.split(',').length, 29);
  assert.equal(XERO_COLUMNS.join(','), header);
  const csv = buildXeroCsv(base).csv;
  assert.equal(csv.split('\r\n')[0], header);
  assert.ok(csv.endsWith('\r\n'));
});

/* ---------- the check before download ---------- */
const good = { ...base, registered: true, gstRate: 0.1 };

await test('check: a good invoice is ready, and always lists what only Xero can check', () => {
  const c = checkXero({ ...good, lines: [{ d: 'Labour', q: '2', p: '100', g: 'Yes' }] });
  assert.deepEqual([c.errors, c.warnings], [[], []]);
  assert.deepEqual(c.ok, ['Customer name', 'Invoice number', 'Invoice date and due date, as DD/MM/YYYY', '1 line with a quantity and price']);
  assert.equal(c.reminders.length, 4);
  assert.ok(c.reminders[2].includes('(200)') && c.reminders[3].includes('GST on Income'));
});

await test('check: errors that stop the file', () => {
  assert.deepEqual(checkXero({ ...good, number: 'INV\u2013014' }).errors, ['an invoice number using only normal keyboard characters']);
  assert.deepEqual(checkXero({ ...good, lines: [{ d: 'x', q: 'two', p: '$10', g: 'Yes' }, { d: 'y', q: '1', p: 'abc', g: 'Yes' }] }).errors, ['numbers only in the quantity and price (line 1, 2)']);
  assert.deepEqual(checkXero({ ...good, issue: '' }).errors, ['issue date']);
  assert.equal(buildXeroCsv({ ...good, number: 'INV\u2013014' }).csv, '');
});

await test('check: warnings that do not stop the file', () => {
  const w = (extra) => checkXero({ ...good, ...extra }).warnings;
  assert.match(w({ lines: [{ d: '', q: '1', p: '5', g: 'Yes' }] })[0], /^Line 1 has no description/);
  assert.match(w({ lines: [{ d: 'x', q: '0', p: '5', g: 'Yes' }, { d: 'y', q: '1', p: '-5', g: 'Yes' }] })[0], /^Line 1, 2 has a zero or negative amount/);
  assert.match(w({ registered: false })[0], /not registered for GST, but this is a Tax Invoice/);
  assert.match(w({ mode: 'plain', registered: true })[0], /registered for GST, but this Invoice has no GST/);
  assert.match(w({ gstName: 'GST', freeName: 'GST' })[0], /same, so GST-free lines would be taxed/);
  assert.match(w({ terms: '-3' })[0], /below zero/);
  assert.notEqual(buildXeroCsv({ ...good, registered: false }).csv, '');
});

await test('check: warns when Xero line-by-line GST would differ from the PDF by a cent', () => {
  const lines = [1, 2, 3].map((n) => ({ d: 'Part ' + n, q: '1', p: '1.25', g: 'Yes' }));
  const w = checkXero({ ...good, lines }).warnings;
  assert.equal(w.length, 1);
  assert.ok(w[0].includes('$0.39') && w[0].includes('$0.38'), w[0]);
  assert.deepEqual(checkXero({ ...good, lines: [{ d: 'x', q: '1', p: '1.25', g: 'No' }, ...lines.slice(0, 1)] }).warnings, []);
});

await test('plain Invoice file: every line uses the no-GST tax name', () => {
  const [a, b] = asObjects(buildXeroCsv({ ...base, mode: 'plain', noneName: ' No GST ' }).csv);
  assert.deepEqual([a['*TaxType'], b['*TaxType']], ['No GST', 'No GST']);
  const [c] = asObjects(buildXeroCsv({ ...base, mode: 'plain' }).csv);
  assert.equal(c['*TaxType'], 'BAS Excluded');
});

await test('the live check shows on the page, updates as you type, and the Invoice tab exports', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Tax Invoice');
  assert.equal(await pg.locator('.xe-st').textContent(), 'Fix 4 things');
  assert.match(await pg.locator('#xe-check').textContent(), /Only Xero can check these/);
  await fillInvoice(pg);
  assert.equal(await pg.locator('.xe-st').textContent(), 'Ready for Xero');
  assert.equal(await pg.locator('#xe-check li.ok').count(), 4);
  await pg.fill('#i-no', 'INV\u2013014');
  assert.equal(await pg.locator('.xe-st').textContent(), 'Fix 1 thing');
  assert.match(await pg.locator('#xe-check li.bad').textContent(), /normal keyboard characters/);
  const waiting = gotDownload(pg);
  await pg.click('#xe-csv');
  assert.equal(await waiting, null, 'a file was made with an invoice number Xero would reject');
  await pg.fill('#i-no', 'INV-014');
  await tab(pg, 'My Details');
  await pg.selectOption('#i-gst', 'No');
  await tab(pg, 'Invoice');
  assert.match(await pg.locator('.xe-st').textContent(), /^Fix/);
  await pg.fill('#i-no', 'INV-015');
  await pg.fill('#i-date', '2026-10-06');
  await pg.fill('#i-cust', 'A. Customer');
  await line(pg, 1, 'Labour', '2', '100');
  assert.equal(await pg.locator('.xe-st').textContent(), 'Ready for Xero');
  const download2 = gotDownload(pg, 4000);
  await pg.click('#xe-csv');
  const file = await download2;
  assert.equal(file.suggestedFilename(), 'xero-invoice-INV-015.csv');
  const [row1] = asObjects(readFileSync(await file.path(), 'utf8'));
  assert.deepEqual([row1['*TaxType'], row1['*UnitAmount'], row1['*InvoiceNumber']], ['BAS Excluded', '100.00', 'INV-015']);
});

await test('the live check warns about a registered business using the plain Invoice tab', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Invoice');
  await line(pg, 1, 'Labour', '1', '10');
  assert.match(await pg.locator('#xe-check li.warn').first().textContent(), /registered for GST, but this Invoice has no GST/);
  assert.equal(await pg.locator('.xe-st').textContent(), 'Fix 3 things');
});

await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' Xero test(s) failed');
  process.exit(1);
}
console.log('Xero tests passed');
