// Job Completion Certificate signatures (Pro), the SWMS date signed box, and the SWMS print note.
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
const D = { name: 'Smith Electrical', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', gst: 'Yes', trade: 'Electrician', terms: '7' };

async function open(url, form) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((d) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: {} }));
  }, D);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Forms"]');
  await page.click(`[data-fm-pick="${form}"]`);
  await page.waitForSelector(form === 'cert' ? '#i-jc_cust' : '#i-sw_prin');
  return page;
}
const draw = async (pg, id) => {
  const box = await pg.locator('#' + id).boundingBox();
  await pg.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await pg.mouse.down();
  await pg.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 12 });
  await pg.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.65, { steps: 12 });
  await pg.mouse.up();
};
const saved = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('utedocs.v1')).T.Forms);

await test('Pro: the customer and you can sign the certificate, the date fills in, and it prints above the line', async () => {
  const pg = await open('/pro/', 'cert');
  assert.equal(await pg.locator('.sigpad').count(), 2);
  await pg.locator('#jc-c-pad').scrollIntoViewIfNeeded();
  await draw(pg, 'jc-c-pad');
  let f = await saved(pg);
  assert.match(f.jc_csig, /^data:image\/png;base64,/);
  assert.match(f.jc_cdate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(await pg.inputValue('#i-jc_cdate'), f.jc_cdate);
  assert.equal(f.jc_tsig || '', '');
  await pg.locator('#jc-t-pad').scrollIntoViewIfNeeded();
  await draw(pg, 'jc-t-pad');
  f = await saved(pg);
  assert.match(f.jc_tsig, /^data:image\/png;base64,/);
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
  assert.equal(await pg.locator('#paper .sg img.sigimg').count(), 2);
  assert.equal(await pg.locator('#paper .sg').count(), 2);
  await pg.emulateMedia({ media: 'print' });
  const pdf = await pg.pdf({ format: 'A4', printBackground: true });
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1);
  await pg.emulateMedia({ media: 'screen' });
  await pg.click('#bk');
  await pg.click('#fm-clear');
  await pg.waitForSelector('#jc-c-pad');
  f = await saved(pg);
  assert.equal(f.jc_csig, '');
  assert.equal(f.jc_cstr, '');
  assert.equal(f.jc_tsig, '');
  assert.deepEqual(pg.problems, []);
});

await test('Lite: no pads on the certificate, and it still prints with blank lines to sign by hand', async () => {
  const pg = await open('/app/', 'cert');
  assert.equal(await pg.locator('.sigpad').count(), 0);
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
  assert.equal(await pg.locator('#paper img').count(), 0);
  assert.equal(await pg.locator('#paper .sg').count(), 2);
});

await test('a typed signature picture that is not a real PNG is never printed', async () => {
  const pg = await open('/pro/', 'cert');
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('utedocs.v1'));
    s.T.Forms = { ...(s.T.Forms || {}), jc_csig: 'data:image/png;base64,AAAA" onerror="alert(1)' };
    localStorage.setItem('utedocs.v1', JSON.stringify(s));
  });
  await pg.reload();
  await pg.waitForSelector('nav button');
  await pg.click('nav button[data-t="Forms"]');
  await pg.click('[data-fm-pick="cert"]');
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
  assert.equal(await pg.locator('#paper .sg img').count(), 0);
});

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': the SWMS date signed fills the date on every named row, and the print note keeps only the review rule', async () => {
    const pg = await open(url, 'swms');
    await pg.fill('#i-sw_workers', 'Sam Lee\nAlex Kim');
    await pg.fill('#i-sw_signed', '2026-10-20');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const rows = await pg.locator('#paper .swt').last().locator('tbody tr').allTextContents();
    assert.equal(rows.length, 4);
    assert.equal(rows[0], 'Sam Lee20 Oct 2026');
    assert.equal(rows[1], 'Alex Kim20 Oct 2026');
    assert.equal(rows[2], '');
    const text = await pg.locator('#paper').textContent();
    assert.ok(text.includes('Review this SWMS whenever the work changes'));
    assert.ok(text.includes('Keep a copy at the work site for as long as the work lasts.'));
    assert.ok(!text.includes('A starter layout only'), 'advice to you belongs on the edit screen, not on the printed page');
    await pg.click('#bk');
    assert.match(await pg.locator('.note').first().textContent(), /A generic SWMS is not acceptable/);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Certificate signature tests passed');
