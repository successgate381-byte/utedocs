// The signature pad: straight lines stay straight, drawing is incremental (no full redraw while moving),
// speed and pen pressure change the width, a second finger is ignored, and old saved drawings still load.
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

async function open(extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((q) => localStorage.setItem('utedocs.v1', JSON.stringify({ D: { trade: 'Electrician' }, T: { Quote: q } })), extra);
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  await page.goto(ORIGIN + '/pro/');
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Quote"]');
  await page.waitForSelector('#sg-pad');
  await page.locator('#sg-pad').scrollIntoViewIfNeeded();
  return page;
}
const saved = async (pg) => {
  await pg.waitForFunction(() => JSON.parse(localStorage.getItem('utedocs.v1')).T.Quote.sigstrokes);
  return JSON.parse(await pg.evaluate(() => localStorage.getItem('utedocs.v1'))).T.Quote;
};
const ink = (pg) => pg.evaluate(() => {
  const c = document.getElementById('sg-pad');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

await test('a straight line stays straight and ends where the finger started and stopped', async () => {
  const pg = await open();
  const box = await pg.locator('#sg-pad').boundingBox();
  const lines = [[[0.08, 0.5], [0.92, 0.5]], [[0.1, 0.15], [0.9, 0.85]]];
  for (const [a, b] of lines) {
    await pg.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
    await pg.mouse.down();
    await pg.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], { steps: 60 });
    await pg.mouse.up();
  }
  const strokes = JSON.parse((await saved(pg)).sigstrokes);
  assert.equal(strokes.length, 2);
  strokes.forEach((s, k) => {
    const [a, b] = lines[k];
    const px = s.map((p) => [p[0] * box.width, p[1] * box.height]);
    const [x1, y1, x2, y2] = [a[0] * box.width, a[1] * box.height, b[0] * box.width, b[1] * box.height];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const off = Math.max(...px.map(([x, y]) => Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / len));
    assert.ok(off < 1.6, 'line ' + k + ' wobbles by ' + off.toFixed(2) + ' px');
    assert.ok(Math.hypot(px[0][0] - x1, px[0][1] - y1) < 2.5, 'the line should start where the finger went down');
    assert.ok(Math.hypot(px.at(-1)[0] - x2, px.at(-1)[1] - y2) < 2.5, 'the line should end where the finger came up');
  });
  assert.ok((await ink(pg)) > 200);
  assert.deepEqual(pg.problems, []);
});

await test('drawing is incremental: nothing is wiped or redrawn while the finger moves', async () => {
  const pg = await open();
  const box = await pg.locator('#sg-pad').boundingBox();
  await pg.mouse.move(box.x + 20, box.y + 20);
  await pg.mouse.down();
  await pg.evaluate(() => {
    window.__clears = 0;
    const o = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...a) {
      window.__clears++;
      return o.apply(this, a);
    };
  });
  for (let i = 1; i <= 80; i++) await pg.mouse.move(box.x + 20 + i * 4, box.y + 20 + Math.sin(i / 6) * 40);
  assert.equal(await pg.evaluate(() => window.__clears), 0, 'the pad was wiped while drawing');
  await pg.mouse.up();
  assert.ok((await ink(pg)) > 300);
});

await test('slow strokes are drawn a little thicker than fast ones, and the width stays in range', async () => {
  const pg = await open();
  const box = await pg.locator('#sg-pad').boundingBox();
  const run = async (y, step, wait) => {
    await pg.mouse.move(box.x + 20, box.y + y);
    await pg.mouse.down();
    for (let i = 1; i <= 40; i++) {
      await pg.mouse.move(box.x + 20 + i * step, box.y + y);
      if (wait) await pg.waitForTimeout(wait);
    }
    await pg.mouse.up();
  };
  await run(40, 3, 12);
  await run(120, 14, 0);
  const [slow, fast] = JSON.parse((await saved(pg)).sigstrokes).map((s) => s.reduce((t, p) => t + p[2], 0) / s.length);
  assert.ok(slow > fast + 0.15, 'slow ' + slow.toFixed(2) + ' should be thicker than fast ' + fast.toFixed(2));
  for (const s of JSON.parse((await saved(pg)).sigstrokes)) for (const p of s) assert.ok(p[2] >= 0.55 && p[2] <= 1.6, 'width factor out of range: ' + p[2]);
});

await test('a tap makes a dot, and a second finger or a palm is ignored while one is drawing', async () => {
  const pg = await open();
  const box = await pg.locator('#sg-pad').boundingBox();
  await pg.mouse.move(box.x + 60, box.y + 60);
  await pg.mouse.down();
  await pg.mouse.up();
  let q = await saved(pg);
  assert.equal(JSON.parse(q.sigstrokes).length, 1);
  assert.equal(JSON.parse(q.sigstrokes)[0].length, 1);
  assert.match(q.sigimg, /^data:image\/png;base64,/);
  await pg.mouse.move(box.x + 100, box.y + 100);
  await pg.mouse.down();
  await pg.evaluate(() => {
    const c = document.getElementById('sg-pad');
    const ev = (type) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: 300, clientY: 200, bubbles: true, cancelable: true });
    c.dispatchEvent(ev('pointerdown'));
    c.dispatchEvent(ev('pointermove'));
    c.dispatchEvent(ev('pointerup'));
  });
  await pg.mouse.move(box.x + 160, box.y + 110, { steps: 8 });
  await pg.mouse.up();
  q = await saved(pg);
  assert.equal(JSON.parse(q.sigstrokes).length, 2, 'the second finger must not start a stroke');
});

await test('drawings saved by the old pad (two numbers per point) still load and print', async () => {
  const pg = await open({ sigstrokes: '[[[0.1,0.5],[0.3,0.2],[0.6,0.8],[0.9,0.5]],[[0.5,0.5]]]' });
  assert.ok((await ink(pg)) > 100, 'the saved drawing did not appear');
  assert.deepEqual(pg.problems, []);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Signature pad tests passed');
