// SWMS worker dates: three small boxes (dd / mm / yy) that take digits only and move on by themselves.
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

async function open(url, forms = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.addInitScript(([d, f]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: { Forms: f } }));
  }, [D, forms]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Forms"]');
  await page.click('[data-fm-pick="swms"]');
  await page.waitForSelector('#i-sw_prin');
  return page;
}
const focused = (pg) => pg.evaluate(() => document.activeElement && document.activeElement.id);
const rowsOf = (pg) => pg.locator('#paper .swt').last().locator('tbody tr').allTextContents();

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': the date is three small boxes in a line, dd then mm then yy, with a number keypad', async () => {
    const pg = await open(url);
    const ids = ['#i-sw_wdd1', '#i-sw_wdm1', '#i-sw_wdy1'];
    const boxes = [];
    for (const id of ids) boxes.push(await pg.locator(id).boundingBox());
    assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, 'left to right');
    assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 4 && Math.abs(boxes[1].y - boxes[2].y) < 4, 'all on one line');
    assert.ok(boxes[0].width < 90 && boxes[1].width < 90 && boxes[2].width < 110, 'small boxes, not one wide box');
    assert.equal(await pg.getAttribute(ids[0], 'placeholder'), 'dd');
    assert.equal(await pg.getAttribute(ids[1], 'placeholder'), 'mm');
    assert.equal(await pg.getAttribute(ids[2], 'placeholder'), 'yy');
    for (const id of ids) assert.equal(await pg.getAttribute(id, 'inputmode'), 'numeric');
    assert.equal(await pg.locator('label[for="i-sw_wdd1"]').textContent(), 'Date signed');
    assert.equal(await pg.locator('.dmy span').first().textContent(), '/');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': two digits move on by themselves, a slash moves on after one digit, letters are ignored', async () => {
    const pg = await open(url);
    await pg.click('#i-sw_wdd1');
    await pg.keyboard.type('20');
    assert.equal(await focused(pg), 'i-sw_wdm1');
    await pg.keyboard.type('1/');
    assert.equal(await focused(pg), 'i-sw_wdy1');
    await pg.keyboard.type('ab');
    assert.equal(await pg.inputValue('#i-sw_wdy1'), '');
    await pg.keyboard.type('26');
    assert.equal(await pg.inputValue('#i-sw_wdd1'), '20');
    assert.equal(await pg.inputValue('#i-sw_wdm1'), '1');
    assert.equal(await pg.inputValue('#i-sw_wdy1'), '26');
    await pg.fill('#i-sw_wk1', 'Sam Lee');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal((await rowsOf(pg))[0], 'Sam Lee20 Jan 2026');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': Backspace in an empty box goes back to the box before it', async () => {
    const pg = await open(url);
    await pg.click('#i-sw_wdm1');
    await pg.keyboard.press('Backspace');
    assert.equal(await focused(pg), 'i-sw_wdd1');
    await pg.click('#i-sw_wdy1');
    await pg.keyboard.press('Backspace');
    assert.equal(await focused(pg), 'i-sw_wdm1');
  });

  await test(label + ': a half-typed date shows a hint on screen and prints the numbers typed', async () => {
    const pg = await open(url);
    await pg.fill('#i-sw_wk1', 'Sam Lee');
    await pg.fill('#i-sw_wdd1', '20');
    assert.match(await pg.locator('#wd-hint').textContent(), /Worker 1: that is not a date yet/);
    await pg.fill('#i-sw_wdm1', '10');
    await pg.fill('#i-sw_wdy1', '2026');
    assert.equal(await pg.locator('#wd-hint').textContent(), '');
    await pg.fill('#i-sw_wdy1', '');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal((await rowsOf(pg))[0], 'Sam Lee20/10');
  });

  await test(label + ': a date saved in one box by the first layout is split into the three boxes', async () => {
    const pg = await open(url, { sw_wk1: 'Sam Lee', sw_wd1: '20/10/26', sw_wk2: 'Alex Kim', sw_wd2: 'tomorrow', sw_wn: '4', sw_wm: '1' });
    assert.equal(await pg.inputValue('#i-sw_wdd1'), '20');
    assert.equal(await pg.inputValue('#i-sw_wdm1'), '10');
    assert.equal(await pg.inputValue('#i-sw_wdy1'), '26');
    assert.equal(await pg.inputValue('#i-sw_wdd2'), '');
    const kept = await pg.evaluate(() => JSON.parse(localStorage.getItem('utedocs.v1')).T.Forms);
    assert.equal(kept.sw_wd1, '');
    assert.equal(kept.sw_wd2, '');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const rows = await rowsOf(pg);
    assert.equal(rows[0], 'Sam Lee20 Oct 2026');
    assert.equal(rows[1], 'Alex Kim');
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('SWMS date box tests passed');
