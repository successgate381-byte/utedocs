// Light and dark screens. The finished document and the printed page always stay light.
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

const D = { name: 'Smith Electrical Pty Ltd', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', email: 'jo@smithelectrical.com.au', gst: 'Yes', trade: 'Electrician', bank: 'Commonwealth Bank', acct: 'Smith Electrical', bsb: '062-000', acno: '12345678', terms: '7' };
const T = { 'Tax Invoice': { no: 'INV-014', date: '2026-10-06', cust: 'A. Customer', d1: 'Replace mixer tap', q1: '1', p1: '120' } };

async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', ...opts });
  await ctx.addInitScript(([d, t]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: t }));
  }, [D, T]);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  await page.goto(ORIGIN + url);
  await page.waitForSelector('nav button');
  return page;
}
const theme = (pg) => pg.evaluate(() => document.documentElement.dataset.theme);
const bg = (pg, sel) => pg.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
const fg = (pg, sel) => pg.evaluate((s) => getComputedStyle(document.querySelector(s)).color, sel);
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': the switch flips the screens, says what it will do next, and the choice is remembered', async () => {
    const pg = await open(url);
    assert.equal(await theme(pg), 'light');
    assert.equal(await pg.locator('#theme').textContent(), 'Dark mode');
    assert.equal(await pg.locator('#theme').getAttribute('aria-pressed'), 'false');
    await pg.click('#theme');
    assert.equal(await theme(pg), 'dark');
    assert.equal(await pg.locator('#theme').textContent(), 'Light mode');
    assert.equal(await pg.locator('#theme').getAttribute('aria-pressed'), 'true');
    assert.equal(await bg(pg, 'body'), 'rgb(14, 20, 36)');
    assert.equal(await pg.evaluate(() => localStorage.getItem('utedocs.theme')), 'dark');
    await pg.reload();
    await pg.waitForSelector('nav button');
    assert.equal(await theme(pg), 'dark');
    await pg.click('#theme');
    assert.equal(await theme(pg), 'light');
    assert.equal(await bg(pg, 'body'), 'rgb(233, 237, 243)');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': with no saved choice it follows the phone setting', async () => {
    const pg = await open(url, { colorScheme: 'dark' });
    assert.equal(await theme(pg), 'dark');
  });

  await test(label + ': dark screens stay readable (contrast 4.5 or better) and the top bar fits a phone', async () => {
    const pg = await open(url);
    await pg.click('#theme');
    await pg.click('nav button[data-t="My Details"]');
    const pairs = [
      [await fg(pg, '.fr label'), await bg(pg, '.pg')],
      [await fg(pg, '#i-name'), await bg(pg, '#i-name')],
      [await fg(pg, 'nav button[aria-selected="true"]'), await bg(pg, 'nav button[aria-selected="true"]')],
      [await fg(pg, '.top b'), await bg(pg, '.top')],
      [await fg(pg, '#theme'), await bg(pg, '.top')],
    ];
    for (const [a, b] of pairs) assert.ok(contrast(a, b) >= 4.5, 'low contrast ' + a + ' on ' + b + ': ' + contrast(a, b).toFixed(2));
    assert.ok((await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways');
  });

  await test(label + ': the finished document stays light in dark mode, on screen and in print, and prints exactly the same', async () => {
    const pg = await open(url);
    const shot = async () => {
      await pg.click('nav button[data-t="Tax Invoice"]');
      await pg.click('#pv');
      await pg.waitForSelector('#paper .ttl');
      await pg.emulateMedia({ media: 'print' });
      const png = await pg.locator('#paper').screenshot();
      const body = await bg(pg, 'body');
      await pg.emulateMedia({ media: 'screen' });
      await pg.click('#bk');
      return { png, body };
    };
    const light = await shot();
    await pg.click('#theme');
    assert.equal(await theme(pg), 'dark');
    await pg.click('nav button[data-t="Tax Invoice"]');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    assert.equal(await bg(pg, '#paper'), 'rgb(255, 255, 255)');
    assert.equal(await fg(pg, '#paper .ttl'), 'rgb(31, 42, 68)');
    assert.equal(await bg(pg, '#paper .lh'), 'rgb(31, 42, 68)');
    assert.equal(await bg(pg, '#paper .pd'), 'rgb(250, 251, 253)');
    await pg.click('#bk');
    const dark = await shot();
    assert.equal(dark.body, 'rgb(255, 255, 255)', 'the printed page background must be white');
    assert.ok(light.png.equals(dark.png), 'the printed document must look identical in light and dark');
  });
}

await test('Pro: the signature pad stays light so the pen is always visible', async () => {
  const pg = await open('/pro/');
  await pg.click('#theme');
  await pg.click('nav button[data-t="Quote"]');
  const c = pg.locator('.sigpad canvas').first();
  if (await c.count()) assert.equal(await c.evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(255, 251, 235)');
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Theme tests passed');
