// Photos on a PDF: large framed photos, two per page (or one), numbered, dated, and full screen on a tap.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { stampText } from '../site/pro/js/photo-math.js';

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

await test('date stamp: day, month, year and 12-hour time', () => {
  assert.equal(stampText(new Date(2026, 9, 6, 14, 45).getTime()), '6 Oct 2026, 2:45 pm');
  assert.equal(stampText(new Date(2026, 0, 15, 0, 5).getTime()), '15 Jan 2026, 12:05 am');
  assert.equal(stampText(new Date(2026, 11, 31, 12, 0).getTime()), '31 Dec 2026, 12:00 pm');
  assert.equal(stampText(NaN), '');
});

const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const scratch = await (await browser.newContext()).newPage();

async function jpeg(w, h) {
  const b64 = await scratch.evaluate(([W, H]) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#e00000';
    x.fillRect(0, 0, W / 2, H);
    x.fillStyle = '#0000e0';
    x.fillRect(W / 2, 0, W / 2, H);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [w, h]);
  return Buffer.from(b64, 'base64');
}
const file = (name, buffer) => ({ name, mimeType: 'image/jpeg', buffer });

async function openWithPhotos() {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('utedocs.v1')) {
      localStorage.setItem('utedocs.v1', JSON.stringify({ D: { name: 'Smith Electrical', trade: 'Electrician', gst: 'Yes' }, T: { Quote: { no: 'Q-001', cust: 'A. Customer', d1: 'Labour', q1: '2', p1: '95' } } }));
    }
  });
  const pg = await ctx.newPage();
  pg.problems = [];
  pg.on('pageerror', (e) => pg.problems.push('page error: ' + e.message));
  pg.on('console', (m) => m.type() === 'error' && pg.problems.push('console: ' + m.text()));
  pg.on('dialog', (d) => d.accept());
  await pg.goto(ORIGIN + '/pro/');
  await pg.waitForSelector('nav button');
  await pg.click('nav button[data-t="Photos"]');
  await pg.setInputFiles('#ph-choose', [file('a.jpg', await jpeg(1200, 900)), file('b.jpg', await jpeg(900, 1200)), file('c.jpg', await jpeg(1200, 900)), file('d.jpg', await jpeg(900, 1200))]);
  await pg.waitForFunction(() => document.querySelectorAll('#ph-grid .ph-card').length === 4);
  const caps = ['Before - leaking pipe', 'After - replaced', '', ''];
  for (let i = 0; i < 4; i++) {
    if (caps[i]) await pg.locator('#ph-grid input[type="text"]').nth(i).fill(caps[i]);
    await pg.locator('#ph-grid input[type="checkbox"]').nth(i).check();
  }
  return pg;
}
const pageCount = async (pg) => {
  await pg.emulateMedia({ media: 'print' });
  const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await pg.emulateMedia({ media: 'screen' });
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};

await test('the Photos tab: captions suggest Before and After, thumbnails are not cropped, and a page-size choice is there', async () => {
  const pg = await openWithPhotos();
  assert.ok((await pg.locator('#ph-caps option').count()) >= 4);
  assert.equal(await pg.locator('#ph-grid input[type="text"]').first().getAttribute('list'), 'ph-caps');
  assert.equal(await pg.locator('.ph-card img').first().evaluate((e) => getComputedStyle(e).objectFit), 'contain');
  assert.deepEqual(await pg.locator('[data-k="pp"] option').allTextContents(), ['2 per page', '1 per page (largest)']);
  assert.deepEqual(pg.problems, []);
});

await test('the photo page: numbered, captioned, dated, framed, and large', async () => {
  const pg = await openWithPhotos();
  await pg.click('nav button[data-t="Quote"]');
  await pg.check('#ph-inc');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .photopage.extra figure').count(), 4);
  const text = await pg.locator('#paper .photopage').textContent();
  assert.match(text, /Photo 1 - Before - leaking pipe/);
  assert.match(text, /Photo 2 - After - replaced/);
  assert.match(text, /Photo 3/);
  assert.equal((text.match(/Added \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} (am|pm)/g) || []).length, 4);
  assert.equal(await pg.locator('#paper .photopage figure').first().evaluate((e) => getComputedStyle(e).borderTopWidth), '1px');
  await pg.emulateMedia({ media: 'print' });
  await pg.setViewportSize({ width: 703, height: 1000 });
  const r = await pg.evaluate(() => {
    const page = document.getElementById('paper').getBoundingClientRect().width;
    const img = document.querySelector('#paper .photopage img').getBoundingClientRect();
    return { share: img.width / page, ok: document.querySelector('#paper .photopage img').naturalWidth > 0 };
  });
  assert.ok(r.ok);
  assert.ok(r.share >= 0.5, 'a landscape photo should be at least half the page wide, it is ' + Math.round(r.share * 100) + '%');
});

await test('PDF pages: the quote is one page, 2 photos per page makes 3 pages, 1 per page makes 5', async () => {
  const pg = await openWithPhotos();
  await pg.click('nav button[data-t="Quote"]');
  assert.equal(await pageCount(pg), 1);
  await pg.check('#ph-inc');
  assert.equal(await pageCount(pg), 3);
  await pg.click('nav button[data-t="Photos"]');
  await pg.selectOption('[data-k="pp"]', '1 per page (largest)');
  await pg.click('nav button[data-t="Quote"]');
  assert.equal(await pageCount(pg), 5);
});

await test('full screen: tap a photo in the gallery or in the preview, Close or Escape leaves', async () => {
  const pg = await openWithPhotos();
  await pg.locator('.ph-open').first().click();
  assert.equal(await pg.locator('.lb').count(), 1);
  assert.equal(await pg.locator('.lb img').evaluate((e) => e.naturalWidth > 0), true);
  assert.match(await pg.locator('.lb-c').textContent(), /Before - leaking pipe/);
  assert.match(await pg.locator('.lb-c').textContent(), /Added \d/);
  assert.equal(await pg.evaluate(() => document.activeElement.className.includes('lb-x')), true);
  await pg.click('.lb-x');
  assert.equal(await pg.locator('.lb').count(), 0);
  await pg.click('nav button[data-t="Quote"]');
  await pg.check('#ph-inc');
  await pg.click('#pv');
  await pg.locator('#paper .photopage img').nth(1).click();
  assert.equal(await pg.locator('.lb').count(), 1);
  await pg.keyboard.press('Escape');
  assert.equal(await pg.locator('.lb').count(), 0);
  assert.deepEqual(pg.problems, []);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Photo page tests passed');
