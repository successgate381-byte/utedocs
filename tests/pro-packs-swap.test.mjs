// Starter packs: choosing another job type swaps boxes that still hold the old pack's words.
// Words the person typed or changed, priced lines and typed lines all stay.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';
import { fillPlan, packsFor } from '../site/pro/js/packs-data.js';

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

const [P0, P1, P2] = packsFor('Electrician');
const empty = { scope: '', incl: '', excl: '', rows: 8 };
const after = (cur, plan) => {
  const next = { ...cur };
  for (const [k, v] of Object.entries(plan.set)) next[k] = v;
  return next;
};

/* ---------- the plan, no browser ---------- */
await test('plan: a second pack swaps untouched words and lines', () => {
  const a = fillPlan(P0, empty);
  const cur = after(empty, a);
  const b = fillPlan(P1, cur, a.rec);
  assert.deepEqual(b.swapped, ['scope of work', 'inclusions', 'exclusions']);
  assert.deepEqual(b.filled, []);
  assert.equal(b.set.scope, P1.scope);
  assert.equal(b.linesAdded, P1.lines.filter((l) => !P0.lines.includes(l)).length);
  const next = after(cur, b);
  for (let i = 1; i <= 8; i++) if (next['d' + i]) assert.ok(P1.lines.includes(next['d' + i]), 'an old line was left behind: ' + next['d' + i]);
});

await test('plan: edited words, priced lines and typed lines stay', () => {
  const a = fillPlan(P0, empty);
  let cur = after(empty, a);
  cur = { ...cur, scope: 'My own scope', q2: '2', p2: '50', d3: 'My extra job' };
  const b = fillPlan(P1, cur, a.rec);
  assert.deepEqual(b.kept, ['scope of work']);
  assert.deepEqual(b.swapped, ['inclusions', 'exclusions']);
  assert.equal(b.set.scope, undefined);
  assert.equal(b.set.d2, undefined, 'a priced line must stay');
  assert.equal(b.set.d3, undefined, 'a typed line must stay');
  assert.ok(b.rec.scope === '' && b.rec.incl === P1.inclusions, 'only pack-owned boxes are remembered');
});

await test('plan: the same pack twice changes nothing, and with no record nothing is ever swapped', () => {
  const a = fillPlan(P0, empty);
  const cur = after(empty, a);
  const again = fillPlan(P0, cur, a.rec);
  assert.deepEqual([again.filled, again.swapped, again.linesAdded, again.linesRemoved], [[], [], 0, 0]);
  const noRecord = fillPlan(P1, cur, null);
  assert.deepEqual([noRecord.filled, noRecord.swapped, noRecord.linesRemoved], [[], [], 0]);
  assert.deepEqual(noRecord.kept, ['scope of work', 'inclusions', 'exclusions']);
});

await test('plan: a line that both packs share stays where it is', () => {
  const x = { ...P0, lines: ['Line one', 'Shared line', 'Line three'] };
  const y = { ...P1, lines: ['Shared line', 'New line'] };
  const a = fillPlan(x, empty);
  const cur = after(empty, a);
  const b = fillPlan(y, cur, a.rec);
  const next = after(cur, b);
  assert.equal(next.d2, 'Shared line');
  assert.equal(next.d1, 'New line', 'the new line takes the first free row');
  assert.equal(next.d3, '');
  assert.equal(b.linesRemoved, 1);
});

/* ---------- the box in a real browser ---------- */
const server = await startServer('site', 0);
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('utedocs.v1', JSON.stringify({ D: { trade: 'Electrician' }, T: {} })));
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('page error: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && page.problems.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());
  await page.goto(ORIGIN + '/pro/');
  await page.waitForSelector('nav button');
  await page.click('nav button[data-t="Quote"]');
  return page;
}
const use = async (pg, id) => {
  const before = await pg.locator('#pk-msg').textContent();
  await pg.selectOption('#pk-pick', id);
  await pg.click('#pk-fill');
  await pg.waitForFunction((old) => document.getElementById('pk-msg').textContent !== old, before);
};
const words = (pg) => pg.evaluate(() => ({
  scope: document.getElementById('i-scope').value,
  incl: document.getElementById('i-incl').value,
  excl: document.getElementById('i-excl').value,
  lines: [...document.querySelectorAll('[data-k]')].filter((e) => /^d\d+$/.test(e.dataset.k)).map((e) => e.value),
}));

await test('browser: picking another job type and tapping Use this pack swaps the words and the lines', async () => {
  const pg = await open();
  assert.equal(await pg.locator('#pk-fill').textContent(), 'Use this pack');
  await use(pg, P0.id);
  assert.equal((await words(pg)).scope, P0.scope);
  await use(pg, P1.id);
  const w = await words(pg);
  assert.deepEqual([w.scope, w.incl, w.excl], [P1.scope, P1.inclusions, P1.exclusions]);
  assert.deepEqual(w.lines.filter(Boolean).sort(), [...P1.lines].sort());
  assert.match(await pg.locator('#pk-msg').textContent(), /^Swapped scope of work, inclusions and exclusions to match this job type\. Lines: /);
  assert.deepEqual(pg.problems, []);
});

await test('browser: words you changed, priced lines and typed lines stay when the job type changes', async () => {
  const pg = await open();
  await use(pg, P0.id);
  await pg.fill('#i-scope', 'My own scope of work');
  await pg.fill('[data-k="q2"]', '2');
  await pg.fill('[data-k="p2"]', '50');
  await pg.fill('[data-k="d3"]', 'My extra job');
  await use(pg, P1.id);
  const w = await words(pg);
  assert.equal(w.scope, 'My own scope of work');
  assert.equal(w.incl, P1.inclusions);
  assert.equal(w.lines[1], P0.lines[1], 'the priced line stays');
  assert.equal(w.lines[2], 'My extra job', 'the typed line stays');
  assert.match(await pg.locator('#pk-msg').textContent(), /Left as you typed: scope of work\./);
  assert.equal(await pg.inputValue('[data-k="p2"]'), '$50.00');
});

await test('browser: the same pack twice says nothing to fill, and Clear this document forgets the pack', async () => {
  const pg = await open();
  await use(pg, P0.id);
  await use(pg, P0.id);
  assert.match(await pg.locator('#pk-msg').textContent(), /^Nothing to fill: those boxes and lines already have words in them\./);
  await pg.click('#clr');
  await pg.waitForSelector('#pk-pick');
  await use(pg, P1.id);
  assert.match(await pg.locator('#pk-msg').textContent(), /^Filled scope of work, inclusions and exclusions and \d+ lines?\./);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Pack swap tests passed');
