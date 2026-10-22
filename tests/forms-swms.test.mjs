// The SWMS starter layout in the Forms tab, in Lite and Pro.
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

const D = { name: 'Smith Electrical', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', email: 'jo@smithelectrical.com.au', gst: 'Yes', trade: 'Electrician', terms: '7' };
const T = { Quote: { no: 'Q-001', cust: 'A. Customer', site: '12 Example St, Sydney', scope: 'Rewire the kitchen.' } };

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript(([d, t]) => {
    if (!localStorage.getItem('utedocs.v1')) localStorage.setItem('utedocs.v1', JSON.stringify({ D: d, T: t }));
  }, [D, T]);
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

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': the SWMS has the 18 high-risk activities, ticks that stay, and steps you can add and remove', async () => {
    const pg = await open(url);
    assert.equal(await pg.locator('input[data-fmk^="sw_h"]').count(), 19, '18 activities and Other');
    assert.equal(await pg.locator('input[data-fmk^="sw_p"]').count(), 9, '8 kinds of PPE and Other');
    assert.deepEqual(await pg.locator('[data-fm-pick]').allTextContents(), ['Get Paid Faster', 'Job Completion Certificate', 'SWMS']);
    for (const n of [1, 7, 11]) await pg.check(`[data-fmk="sw_h${n}"]`);
    await pg.check('[data-fmk="sw_p3"]');
    assert.equal(await pg.locator('.fm-step').count(), 4);
    await pg.click('#fm-addstep');
    await pg.waitForSelector('#i-sw_t5');
    assert.equal(await pg.locator('.fm-step').count(), 5);
    assert.equal(await pg.isChecked('[data-fmk="sw_h7"]'), true, 'ticks must survive a redraw');
    assert.equal(await pg.isChecked('[data-fmk="sw_h2"]'), false);
    await pg.click('#fm-rmstep');
    await pg.click('#fm-rmstep');
    await pg.waitForSelector('#fm-addstep');
    assert.equal(await pg.locator('.fm-step').count(), 3);
    assert.equal(await pg.locator('#fm-rmstep').isDisabled(), true, 'three steps is the least');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': Fill from my Quote tab, then the finished SWMS shows ticks, steps, typed words as text, and a signing table', async () => {
    const pg = await open(url);
    await pg.click('#fm-fill');
    await pg.waitForSelector('#i-sw_site');
    assert.equal(await pg.inputValue('#i-sw_site'), '12 Example St, Sydney');
    assert.equal(await pg.inputValue('#i-sw_desc'), 'Rewire the kitchen.');
    for (const n of [1, 11]) await pg.check(`[data-fmk="sw_h${n}"]`);
    await pg.check('[data-fmk="sw_p2"]');
    await pg.fill('#i-sw_t1', 'Unload materials');
    await pg.fill('#i-sw_z1', '<b>Back strain</b>');
    await pg.selectOption('#i-sw_rb1', 'Medium');
    await pg.fill('#i-sw_c1', 'Use a trolley');
    await pg.selectOption('#i-sw_ra1', 'Low');
    await pg.fill('#i-sw_wk1', 'Sam Lee');
    await pg.fill('#i-sw_wk2', 'Alex Kim');
    await pg.fill('#i-sw_date', '2026-10-20');
    await pg.check('[data-fmk="sw_h3"]');
    await pg.click('#pv');
    await pg.waitForSelector('#paper .ttl');
    const top = await pg.evaluate(() => [...document.getElementById('paper').children].slice(0, 2).map((e) => e.className + ':' + e.textContent.slice(0, 30)));
    assert.equal(top[0], 'ttl:SAFE WORK METHOD STATEMENT');
    assert.ok(top[1].startsWith('lh:Smith Electrical'));
    assert.equal(await pg.locator('#paper .ck').first().locator('.ckr').count(), 19);
    assert.equal(await pg.locator('#paper .ck').first().locator('.bx.on').count(), 3, 'the box ticked after the screen was open must show too');
    assert.equal(await pg.locator('#paper .ck').nth(1).locator('.bx.on').count(), 1);
    const paper = await pg.locator('#paper').textContent();
    for (const s of ['12 Example St, Sydney', 'Rewire the kitchen.', 'Unload materials', '<b>Back strain</b>', 'Medium', 'Low', 'Use a trolley', 'Sam Lee', 'Alex Kim', '20 Oct 2026', 'Risk of a person falling more than 2 metres', 'Diving work', 'Review this SWMS whenever the work changes']) assert.ok(paper.includes(s), 'missing: ' + s);
    assert.equal(await pg.locator('#paper .swt tbody tr').count(), 4 + 4, '4 steps and 4 signing rows');
    assert.equal(await pg.locator('#paper .swt td b').count(), 0, 'typed HTML must stay text');
    assert.equal(await pg.locator('#paper .made').count(), url === '/app/' ? 1 : 0);
    await pg.emulateMedia({ media: 'print' });
    const pdf = await pg.pdf({ format: 'A4', printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.ok(pages >= 1 && pages <= 2, 'the SWMS should be one or two pages, it is ' + pages);
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('SWMS tests passed');
