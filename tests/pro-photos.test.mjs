// P5 tests: job photos (Pro only). Uses real image files, including ones with the "phone was held sideways" tag.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { MAX_PHOTOS, MAX_SIDE, fitSize } from '../site/pro/js/photo-math.js';

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

/* ---------- the numbers, no browser ---------- */
await test('sizes: big photos shrink to 1280, small ones stay, shape is kept', () => {
  assert.equal(MAX_SIDE, 1280);
  assert.deepEqual(fitSize(4000, 3000), { w: 1280, h: 960 });
  assert.deepEqual(fitSize(3000, 4000), { w: 960, h: 1280 });
  assert.deepEqual(fitSize(800, 600), { w: 800, h: 600 });
  assert.deepEqual(fitSize(1280, 1280), { w: 1280, h: 1280 });
  assert.deepEqual(fitSize(10000, 10), { w: 1280, h: 1 });
  assert.deepEqual(fitSize(0, 5), { w: 1, h: 1 });
  assert.deepEqual(fitSize(NaN, 5), { w: 1, h: 1 });
});

/* ---------- the tab in a real browser ---------- */
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1100, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const scratch = await (await browser.newContext()).newPage();

/** A real JPEG: left half red, right half blue. */
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
/** The same JPEG with an EXIF "orientation" tag, as phones write when held sideways. */
function withOrientation(buf, o) {
  const exif = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, o, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  return Buffer.concat([buf.subarray(0, 2), exif, buf.subarray(2)]);
}
const file = (name, buffer, mimeType = 'image/jpeg') => ({ name, mimeType, buffer });

async function open(url, kind = DESKTOP) {
  const page = await (await browser.newContext({ ...kind })).newPage();
  page.problems = [];
  page.outside = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && page.outside.push(r.url()));
  page.on('dialog', (d) => d.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const tab = (pg, name) => pg.click(`nav button[data-t="${name}"]`);
const cards = (pg) => pg.locator('#ph-grid .ph-card');
const rows = (pg) => pg.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('utedocs-photos', 1);
  open.onsuccess = () => {
    const q = open.result.transaction('photos').objectStore('photos').getAll();
    q.onsuccess = () => resolve(q.result.map((x) => ({ w: x.w, h: x.h, print: x.print, caption: x.caption, size: x.blob.size, type: x.blob.type })).sort((a, b) => b.w * b.h - a.w * a.h));
    q.onerror = () => reject(q.error);
  };
  open.onerror = () => reject(open.error);
}));
async function addPhotos(pg, files) {
  await tab(pg, 'Photos');
  await pg.setInputFiles('#ph-choose', files);
  await pg.waitForFunction((n) => document.querySelectorAll('#ph-grid .ph-card').length >= n, Math.min(files.length, MAX_PHOTOS));
}

await test('the Photos tab sits after Progress Claim in Pro only, and opens clean on desktop and phone', async () => {
  const lite = await open('/app/');
  assert.equal((await lite.locator('nav button').allTextContents()).includes('Photos'), false);
  for (const kind of [DESKTOP, PHONE]) {
    const pg = await open('/pro/', kind);
    const names = await pg.locator('nav button').allTextContents();
    assert.equal(names[names.indexOf('Progress Claim') + 1], 'Photos');
    await tab(pg, 'Photos');
    const text = await pg.evaluate(() => document.getElementById('m').textContent);
    for (const s of ['JOB PHOTOS', 'Job name or site', 'Take photo', 'Choose photos', 'Remove all photos', 'No photos yet.', 'Nothing is uploaded']) assert.ok(text.includes(s), s + ' is missing');
    assert.equal(await pg.getAttribute('#ph-take', 'capture'), 'environment');
    assert.equal(await pg.getAttribute('#ph-choose', 'accept'), 'image/*');
    assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'sideways scroll');
    assert.deepEqual(pg.problems, []);
    assert.deepEqual(pg.outside, []);
  }
});

await test('photos are shrunk to 1280 and kept small, in the right shape, unticked to start', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('wide.jpg', await jpeg(4000, 3000)), file('tall.jpg', await jpeg(3000, 4000)), file('small.jpg', await jpeg(800, 600))]);
  const saved = await rows(pg);
  assert.deepEqual(saved.map((r) => [r.w, r.h]), [[1280, 960], [960, 1280], [800, 600]].sort((a, b) => b[0] * b[1] - a[0] * a[1]));
  for (const r of saved) {
    assert.equal(r.type, 'image/jpeg');
    assert.ok(r.size < 400000, 'a photo is still big: ' + r.size);
    assert.equal(r.print, false);
  }
  assert.equal(await pg.locator('#ph-count').textContent(), '3 photos kept on this device, 0 ticked to print.');
  for (let i = 0; i < 3; i++) {
    const thumb = await cards(pg).nth(i).locator('img').boundingBox();
    assert.ok(thumb.height <= thumb.width && thumb.height > 40, 'thumbnail ' + (i + 1) + ' has a strange shape: ' + Math.round(thumb.width) + ' x ' + Math.round(thumb.height));
  }
  assert.equal(await pg.locator('#ph-grid input[type=checkbox]:checked').count(), 0);
  assert.deepEqual(pg.problems, [], 'blob pictures must not break the security policy');
});

await test('a photo taken with the phone held sideways is turned the right way up', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('sideways.jpg', withOrientation(await jpeg(400, 200), 6))]);
  const [r] = await rows(pg);
  assert.deepEqual([r.w, r.h], [200, 400], 'the photo was not turned');
  const colours = await pg.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('utedocs-photos', 1);
    open.onsuccess = () => {
      const q = open.result.transaction('photos').objectStore('photos').getAll();
      q.onsuccess = async () => {
        const bmp = await createImageBitmap(q.result[0].blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const x = c.getContext('2d');
        x.drawImage(bmp, 0, 0);
        const top = x.getImageData(100, 50, 1, 1).data;
        const bottom = x.getImageData(100, 350, 1, 1).data;
        resolve({ top: [top[0], top[2]], bottom: [bottom[0], bottom[2]] });
      };
      q.onerror = () => reject(q.error);
    };
  }));
  assert.ok(colours.top[0] > 150 && colours.top[1] < 100, 'the top should be red: ' + JSON.stringify(colours));
  assert.ok(colours.bottom[1] > 150 && colours.bottom[0] < 100, 'the bottom should be blue: ' + JSON.stringify(colours));
});

await test('captions and ticks are saved, and still there after a reload', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('a.jpg', await jpeg(900, 600)), file('b.jpg', await jpeg(600, 900))]);
  await pg.fill('#i-job', '12 Example St');
  await cards(pg).nth(0).locator('input[type=text]').fill('Before: <b>old</b> switchboard');
  await cards(pg).nth(0).locator('input[type=checkbox]').check();
  await cards(pg).nth(1).locator('input[type=text]').fill('Not for printing');
  await cards(pg).nth(1).locator('input[type=text]').blur();
  assert.equal(await pg.locator('#ph-count').textContent(), '2 photos kept on this device, 1 ticked to print.');
  await pg.reload();
  await tab(pg, 'Photos');
  await pg.waitForFunction(() => document.querySelectorAll('#ph-grid .ph-card').length === 2);
  assert.equal(await cards(pg).nth(0).locator('input[type=text]').inputValue(), 'Before: <b>old</b> switchboard');
  assert.equal(await cards(pg).nth(0).locator('input[type=checkbox]').isChecked(), true);
  assert.equal(await cards(pg).nth(1).locator('input[type=checkbox]').isChecked(), false);
  assert.equal(await pg.inputValue('#i-job'), '12 Example St');
  assert.deepEqual((await rows(pg)).map((r) => r.caption).sort(), ['Before: <b>old</b> switchboard', 'Not for printing']);
});

await test('the Photos document shows only ticked photos, and typed words stay words', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('a.jpg', await jpeg(900, 600)), file('b.jpg', await jpeg(600, 900))]);
  await pg.fill('#i-job', 'Smith job');
  await pg.click('#pv');
  assert.match(await pg.locator('#paper').textContent(), /No photos are ticked/);
  await pg.click('#bk');
  await cards(pg).nth(0).locator('input[type=text]').fill('Before: <b>old</b> board');
  await cards(pg).nth(0).locator('input[type=checkbox]').check();
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper img').count(), 1);
  assert.equal(await pg.locator('#paper figcaption').textContent(), 'Before: <b>old</b> board');
  assert.equal(await pg.locator('#paper figcaption b').count(), 0);
  assert.ok((await pg.locator('#paper').textContent()).includes('Smith job'));
  assert.ok(await pg.locator('#paper img').evaluate((e) => e.complete && e.naturalWidth > 0), 'the picture did not load');
  assert.deepEqual(pg.problems, []);
});

await test('ticked photos can be added as an extra page on other documents, and the PDF gets a second page', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('a.jpg', await jpeg(900, 600)), file('b.jpg', await jpeg(600, 900))]);
  for (const i of [0, 1]) await cards(pg).nth(i).locator('input[type=checkbox]').check();
  for (const t of ['Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Progress Claim']) {
    await tab(pg, t);
    assert.equal(await pg.locator('#ph-inc').count(), 1, t + ' should have the tick box');
    assert.match(await pg.locator('.ph-inc').textContent(), /\(2 ticked\)/);
  }
  await tab(pg, 'Photos');
  assert.equal(await pg.locator('#ph-inc').count(), 0, 'the Photos tab itself should not have the tick box');
  await tab(pg, 'Quote');
  await pg.fill('[data-k="d1"]', 'Labour');
  await pg.fill('[data-k="q1"]', '1');
  await pg.fill('[data-k="p1"]', '100');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .photopage').count(), 0);
  await pg.click('#bk');
  await pg.check('#ph-inc');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .photopage.extra img').count(), 2);
  assert.match(await pg.locator('#paper .photopage').textContent(), /JOB PHOTOS/);
  await pg.click('#bk');
  await pg.emulateMedia({ media: 'print' });
  const pdf = (await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })).toString('latin1');
  assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 2, 'the photos should be on a second page');
  assert.ok(/\/Subtype\s*\/Image/.test(pdf), 'the photos are not in the PDF');
  await pg.emulateMedia({ media: 'screen' });
  await pg.reload();
  await tab(pg, 'Quote');
  assert.equal(await pg.isChecked('#ph-inc'), true, 'the tick should be remembered');
  await pg.uncheck('#ph-inc');
  await pg.click('#pv');
  assert.equal(await pg.locator('#paper .photopage').count(), 0);
});

await test('Remove takes one photo away, Remove all takes them all away', async () => {
  const pg = await open('/pro/');
  await addPhotos(pg, [file('a.jpg', await jpeg(900, 600)), file('b.jpg', await jpeg(600, 900)), file('c.jpg', await jpeg(300, 300))]);
  await cards(pg).nth(1).locator('button[data-remove]').click();
  await pg.waitForFunction(() => document.querySelectorAll('#ph-grid .ph-card').length === 2);
  assert.equal((await rows(pg)).length, 2);
  await pg.click('#ph-clear');
  await pg.waitForFunction(() => document.querySelectorAll('#ph-grid .ph-card').length === 0);
  assert.equal((await rows(pg)).length, 0);
  assert.equal(await pg.locator('#ph-count').textContent(), 'No photos yet.');
});

await test('a job keeps up to 30 photos, and says so', async () => {
  const pg = await open('/pro/');
  const tiny = await jpeg(40, 30);
  await addPhotos(pg, Array.from({ length: 32 }, (_, i) => file('p' + i + '.jpg', tiny)));
  assert.equal(await cards(pg).count(), MAX_PHOTOS);
  assert.equal((await rows(pg)).length, MAX_PHOTOS);
  assert.match(await pg.locator('#ph-msg').textContent(), /up to 30 photos/);
});

await test('things that are not photos are refused kindly', async () => {
  const pg = await open('/pro/');
  await tab(pg, 'Photos');
  await pg.setInputFiles('#ph-choose', [file('notes.txt', Buffer.from('hello'), 'text/plain'), file('broken.jpg', Buffer.from('not really a picture'), 'image/jpeg')]);
  await pg.waitForFunction(() => document.getElementById('ph-msg').textContent.includes('broken.jpg'));
  const msg = await pg.locator('#ph-msg').textContent();
  assert.ok(msg.includes('notes.txt is not a photo.') && msg.includes('broken.jpg could not be added'), msg);
  assert.equal(await cards(pg).count(), 0);
});

await test('phone: a finished photo page fits the screen', async () => {
  const pg = await open('/pro/', PHONE);
  await addPhotos(pg, [file('a.jpg', await jpeg(4000, 3000)), file('b.jpg', await jpeg(3000, 4000))]);
  for (const i of [0, 1]) await cards(pg).nth(i).locator('input[type=checkbox]').check();
  assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'sideways scroll on the gallery');
  await pg.click('#pv');
  const r = await pg.evaluate(() => {
    const p = document.getElementById('paper');
    return { clipped: p.scrollWidth - p.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
  });
  assert.ok(r.clipped <= 1 && r.page <= 1, JSON.stringify(r));
});

await test('security: pictures from this device are allowed, scripts from anywhere else are not', async () => {
  const csp = (await fetch(ORIGIN + '/pro/')).headers.get('content-security-policy') || '';
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /script-src 'self';/);
  assert.ok(!/script-src[^;]*blob:/.test(csp));
});

await scratch.context().close();
await browser.close();
server.close();
if (failed) {
  console.error('\n' + failed + ' photo test(s) failed');
  process.exit(1);
}
console.log('photo tests passed');
