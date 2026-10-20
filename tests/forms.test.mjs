// The Forms tab: Get Paid Faster texts and the Job Completion Certificate, in Lite and Pro.
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

const D = { name: 'Smith Electrical', abn: '51 824 753 556', lic: 'EC12345', phone: '0412 345 678', email: 'jo@smithelectrical.com.au', gst: 'Yes', trade: 'Electrician', terms: '14' };
const T = {
  Quote: { no: 'Q-001', date: '2026-10-06', cust: 'A. Customer', site: '12 Example St, Sydney', scope: 'Rewire the kitchen.' },
  'Tax Invoice': { no: 'INV-014', date: '2026-10-06', cust: 'A. Customer', site: '12 Example St, Sydney', d1: 'Labour', q1: '1', p1: '1000' },
};

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
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
  return page;
}
const forms = async (pg, which) => {
  await pg.click('nav button[data-t="Forms"]');
  if (which) {
    await pg.click(`[data-fm-pick="${which}"]`);
    await pg.waitForSelector(which === 'pay' ? '#fm-t-day2' : '#i-jc_cust');
  }
};
const text = (pg, id) => pg.locator('#' + id).textContent();
const preview = async (pg) => {
  await pg.click('#pv');
  await pg.waitForSelector('#paper .ttl');
};

for (const [label, url] of [['Lite', '/app/'], ['Pro', '/pro/']]) {
  await test(label + ': Forms is the last tab and offers the forms', async () => {
    const pg = await open(url);
    const tabs = await pg.locator('nav button').allTextContents();
    assert.equal(tabs.at(-1), 'Forms');
    await forms(pg);
    const picks = await pg.locator('[data-fm-pick]').allTextContents();
    assert.deepEqual(picks.slice(0, 2), ['Get Paid Faster', 'Job Completion Certificate']);
    assert.equal(await pg.locator('[data-fm-pick][aria-pressed="true"]').textContent(), 'Get Paid Faster');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': the texts fill themselves in, keep [brackets] where something is missing, and copy', async () => {
    const pg = await open(url);
    await forms(pg, 'pay');
    assert.equal(await text(pg, 'fm-t-day2'), "Hi [NAME], it's [YOUR NAME] from Smith Electrical. Just checking you got the quote for [JOB]. Happy to answer any questions or adjust the scope. Cheers.");
    assert.equal(await text(pg, 'fm-t-dep'), 'A deposit of [X%] is due on acceptance. Work is booked once the deposit is received.');
    assert.equal(await text(pg, 'fm-t-valid'), 'This quote is valid for 30 days.');
    assert.equal(await text(pg, 'fm-t-payment'), 'Balance due on completion.');
    await pg.fill('#i-gp_name', 'Sam');
    await pg.fill('#i-gp_me', 'Alex');
    await pg.fill('#i-gp_job', 'the kitchen rewire');
    await pg.fill('#i-gp_no', 'INV-9');
    await pg.fill('#i-gp_amt', '737');
    await pg.fill('#i-gp_due', '2026-11-03');
    await pg.fill('#i-gp_dep', '20');
    await pg.selectOption('#i-gp_pay', 'Within your payment terms');
    assert.equal(await text(pg, 'fm-t-day2'), "Hi Sam, it's Alex from Smith Electrical. Just checking you got the quote for the kitchen rewire. Happy to answer any questions or adjust the scope. Cheers.");
    assert.equal(await text(pg, 'fm-t-od1'), 'Hi Sam, invoice INV-9 for $737.00 was due on 3 Nov 2026. Could you let me know when I can expect payment? Thanks.');
    assert.match(await text(pg, 'fm-t-od7'), /\(\$737\.00, due 3 Nov 2026\)\. Please pay by \[DATE\] or call me on 0412 345 678 so/);
    assert.equal(await text(pg, 'fm-t-dep'), 'A deposit of 20% is due on acceptance. Work is booked once the deposit is received.');
    assert.equal(await text(pg, 'fm-t-payment'), 'Balance due within 14 days of the invoice date.');
    await pg.click('[data-fm-copy="od1"]');
    await pg.waitForFunction(() => document.querySelector('[data-fm-copy="od1"]').textContent === 'Copied');
    assert.equal(await pg.evaluate(() => navigator.clipboard.readText()), await text(pg, 'fm-t-od1'));
    await pg.fill('#i-gp_name', '<b>x</b>');
    assert.equal(await text(pg, 'fm-t-day2'), "Hi <b>x</b>, it's Alex from Smith Electrical. Just checking you got the quote for the kitchen rewire. Happy to answer any questions or adjust the scope. Cheers.");
    assert.equal(await pg.locator('#fm-t-day2 b').count(), 0, 'typed HTML must stay text');
    assert.deepEqual(pg.problems, []);
  });

  await test(label + ': Fill from my latest invoice takes the name, number, amount and due date, and never overwrites', async () => {
    const pg = await open(url);
    await forms(pg, 'pay');
    await pg.fill('#i-gp_job', 'My own job words');
    await pg.click('#fm-fill');
    await pg.waitForSelector('#fm-t-day2');
    assert.equal(await pg.inputValue('#i-gp_name'), 'A. Customer');
    assert.equal(await pg.inputValue('#i-gp_no'), 'INV-014');
    assert.equal(await pg.inputValue('#i-gp_amt'), '$1,100.00');
    assert.equal(await pg.inputValue('#i-gp_due'), '2026-10-20');
    assert.equal(await pg.inputValue('#i-gp_job'), 'My own job words');
    assert.match(await text(pg, 'fm-msg'), /^Filled 4 boxes from your Tax Invoice tab\. Anything you typed stays\.$/);
    assert.match(await text(pg, 'fm-t-od1'), /^Hi A\. Customer, invoice INV-014 for \$1,100\.00 was due on 20 Oct 2026\./);
  });

  await test(label + ': the Job Completion Certificate fills from the Quote, previews like the other documents, and clears on its own', async () => {
    const pg = await open(url);
    await forms(pg, 'pay');
    await pg.fill('#i-gp_name', 'Keep me');
    await forms(pg, 'cert');
    await pg.click('#fm-fill');
    await pg.waitForSelector('#i-jc_cust');
    assert.equal(await pg.inputValue('#i-jc_cust'), 'A. Customer');
    assert.equal(await pg.inputValue('#i-jc_addr'), '12 Example St, Sydney');
    assert.equal(await pg.inputValue('#i-jc_no'), 'Q-001');
    assert.equal(await pg.inputValue('#i-jc_work'), 'Rewire the kitchen.');
    await pg.fill('#i-jc_done', '2026-10-20');
    await pg.fill('#i-jc_out', '<b>Touch up paint</b>');
    await pg.fill('#i-jc_tname', 'Jo Smith');
    await preview(pg);
    const top = await pg.evaluate(() => [...document.getElementById('paper').children].slice(0, 3).map((e) => e.className + ':' + e.textContent.slice(0, 32)));
    assert.equal(top[0], 'ttl:JOB COMPLETION CERTIFICATE');
    assert.ok(top[1].startsWith('lh:Smith Electrical'));
    assert.ok(top[2].startsWith('mt:'));
    const paper = await pg.locator('#paper').textContent();
    for (const s of ['A. Customer', '12 Example St, Sydney', '20 Oct 2026', 'Rewire the kitchen.', '<b>Touch up paint</b>', 'I confirm the work described above has been completed, except for any items listed as outstanding.', 'not a statutory certificate of compliance', 'Customer signature', 'Tradie signature', 'Jo Smith']) assert.ok(paper.includes(s), 'missing: ' + s);
    assert.equal(await pg.locator('#paper .fm-box b').count(), 0, 'typed HTML must stay text');
    assert.equal(await pg.locator('#paper .sg').count(), 2);
    assert.equal(await pg.locator('#paper .made').count(), url === '/app/' ? 1 : 0);
    assert.ok(!paper.includes('General template'));
    await pg.emulateMedia({ media: 'print' });
    const pdf = await pg.pdf({ format: 'A4', printBackground: true });
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1);
    await pg.emulateMedia({ media: 'screen' });
    await pg.click('#bk');
    await pg.click('#fm-clear');
    await pg.waitForSelector('#i-jc_cust');
    assert.equal(await pg.inputValue('#i-jc_cust'), '');
    await forms(pg, 'pay');
    assert.equal(await pg.inputValue('#i-gp_name'), 'Keep me', 'clearing one form must not touch another');
    assert.deepEqual(pg.problems, []);
  });
}

await browser.close();
server.close();
if (failed) process.exit(1);
console.log('Forms tests passed');
