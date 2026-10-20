// @ts-check
// The Forms tab, the same in Lite and Pro. Each form lives in the FORMS list. More forms are added from their own files.
import { setText } from './dom.js';
import { sumLines } from './calc.js';
import { addDays, esc, fmtDate, has, money, num } from './format.js';
import { hooks } from './hooks.js';
import { letterhead, paperFoot } from './paper.js';
import { get, gstRate, lineCount, linesOf, put, registered } from './state.js';
import { pickSource, sourceOptions } from './recent.js';
import { band, foot, note, row, sec } from './views.js';

export const FORMS_TAB = 'Forms';
const T = FORMS_TAB;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** @typedef {{ id: string, label: string, screen: () => string, live: () => void, paper: () => string, keys: () => string[], fill?: () => number }} Form */
/** @type {Form[]} */
export const FORMS = [];

/** The form that is open: the one picked last, or the first. */
export const current = () => FORMS.find((f) => f.id === get(T, 'form')) || FORMS[0];

let message = '';

/** The note shown under the Fill button. */
export const getMessage = () => message;
export const say = (/** @type {string} */ t) => {
  message = t;
};

/** The date boxes show "6 Oct 2026" instead of the browser's own format. */
export function datesLive() {
  document.querySelectorAll('.date-t').forEach((e) => {
    const text = fmtDate(get(T, e.id.slice(2, -1)));
    e.textContent = text || 'Pick a date';
    e.classList.toggle('empty', !text);
  });
}

/** Text with line breaks kept, safe to put on the page. */
export const lines = (/** @type {string} */ x) => esc(x).replace(/\n/g, '<br>');

/** The Preview, Save as PDF and Clear buttons for a form that makes a document. */
export const actions = (/** @type {string} */ extra = '') =>
  `<div class="btns"><button class="b" id="pv">Preview</button><button class="b o" id="pdf">Save as PDF</button>${extra}<button class="b g" id="fm-clear">Clear this form</button></div>` +
  note('Preview and Save as PDF show the clean finished document. In the print window choose Save as PDF as the printer. Your work is saved on this device only.');

/* ---------------- Get Paid Faster ---------------- */

const PAY_NOW = 'On completion';
const PAY_TERMS = 'Within your payment terms';
const PAY_KEYS = ['gp_name', 'gp_me', 'gp_job', 'gp_no', 'gp_amt', 'gp_due', 'gp_payby', 'gp_free', 'gp_dep', 'gp_valid', 'gp_pay'];

/** id, name, words. {CAPITALS} are filled in from the boxes above. */
const TEXTS = [
  ['dep', 'Deposit', 'A deposit of {DEP} is due on acceptance. Work is booked once the deposit is received.'],
  ['valid', 'Validity', 'This quote is valid for {VALID} days.'],
  ['payment', 'Payment', 'Balance due {PAYTERM}.'],
  ['day2', 'Day 2', "Hi {NAME}, it's {ME} from {BUSINESS}. Just checking you got the quote for {JOB}. Happy to answer any questions or adjust the scope. Cheers."],
  ['day7', 'Day 7', "Hi {NAME}, following up on the quote for {JOB}. I have {FREE} free if you'd like to lock it in. No worries if you've gone another way."],
  ['before', 'Day before due', 'Hi {NAME}, friendly reminder that invoice {NO} for {AMT} is due tomorrow. Bank details (or a card payment link) are on the invoice. Thanks!'],
  ['od1', '1 day overdue', 'Hi {NAME}, invoice {NO} for {AMT} was due on {DUE}. Could you let me know when I can expect payment? Thanks.'],
  ['od7', '7 days overdue', "Hi {NAME}, I haven't received payment for invoice {NO} ({AMT}, due {DUE}). Please pay by {PAYBY} or call me on {PHONE} so we can sort it out."],
  ['od14', '14 days overdue', "Hi {NAME}, invoice {NO} is now 14 days overdue. Please pay {AMT} by {PAYBY}. If there's a problem with the work, call me today so we can fix it."],
];

/** The words for one text, with what you typed filled in and [BRACKETS] left where something is missing. */
export function fillText(/** @type {string} */ tpl) {
  const g = (/** @type {string} */ k) => get(T, k);
  const d = (/** @type {string} */ k) => fmtDate(g(k));
  /** @type {Record<string, string>} */
  const vals = {
    NAME: g('gp_name') || '[NAME]',
    ME: g('gp_me') || '[YOUR NAME]',
    BUSINESS: get('D', 'name') || '[BUSINESS]',
    JOB: g('gp_job') || '[JOB]',
    FREE: d('gp_free') || '[DATE]',
    NO: g('gp_no') || '[NO.]',
    AMT: has(g('gp_amt')) ? money(num(g('gp_amt'))) : '$[AMOUNT]',
    DUE: d('gp_due') || '[DATE]',
    PAYBY: d('gp_payby') || '[DATE]',
    PHONE: get('D', 'phone') || '[PHONE]',
    DEP: has(g('gp_dep')) ? num(g('gp_dep')) + '%' : '[X%]',
    VALID: has(g('gp_valid')) ? String(num(g('gp_valid'))) : '30',
    PAYTERM: g('gp_pay') === PAY_TERMS ? 'within ' + (get('D', 'terms') || '7') + ' days of the invoice date' : 'on completion',
  };
  return tpl.replace(/\{([A-Z]+)\}/g, (all, k) => vals[k] ?? all);
}

const textBlock = (/** @type {string[]} */ t) =>
  `<div class="fm-t"><div class="fm-h"><b>${t[1]}</b><button type="button" class="b g fm-cp" data-fm-copy="${t[0]}" aria-label="Copy ${t[1]}">Copy</button></div><div class="fm-text" id="fm-t-${t[0]}"></div></div>`;
const textGroup = (/** @type {string} */ title, /** @type {string[]} */ ids) => sec(title) + ids.map((id) => textBlock(TEXTS.find((t) => t[0] === id) || [])).join('');

function payScreen() {
  return `${note('Type the details once. Every text fills itself in. Tap Copy, then paste it into your messages or your quote terms. Anything missing stays in [square brackets].', 'navy')}
${sec('THE DETAILS')}
${row(T, 'gp_name', 'Customer name', 't')}
${row(T, 'gp_me', 'Your name', 't')}
${row(T, 'gp_job', 'The job', 't', { ex: 'For example: the kitchen rewire.' })}
${row(T, 'gp_no', 'Invoice no.', 't')}
${row(T, 'gp_amt', 'Amount owing', 'm')}
${row(T, 'gp_due', 'Invoice due date', 'd')}
${row(T, 'gp_payby', 'Pay by date (for overdue texts)', 'd')}
${row(T, 'gp_free', 'A date you have free (for the day 7 text)', 'd')}
${row(T, 'gp_dep', 'Deposit (%)', 'n')}
${row(T, 'gp_valid', 'Quote valid for (days)', 'n', { ex: 'Blank means 30.' })}
${row(T, 'gp_pay', 'Balance due', 's', { options: [PAY_NOW, PAY_TERMS] })}
<div class="btns"><button class="b" id="fm-fill">Fill from my latest invoice or quote</button><button class="b g" id="fm-clear">Clear this form</button></div>
<div class="note" id="fm-msg"></div>
${textGroup('WORDING FOR YOUR QUOTE TERMS', ['dep', 'valid', 'payment'])}
${note("Check your state's deposit limit for building work before you use a deposit. Ask for payment on completion where you can, by bank transfer or PayID while you are still on site. For card payments, send a payment link from your card reader or provider. Never ask a customer to text or email you card numbers.")}
${textGroup('QUOTE FOLLOW-UP TEXTS', ['day2', 'day7'])}
${textGroup('PAYMENT REMINDER TEXTS', ['before', 'od1', 'od7', 'od14'])}
${note('After the 7-day text, ring them. Emails and texts alone are easy to ignore. Only charge late fees if they were agreed in your quote terms. Check your state rules or ask your accountant before sending final demands.')}`;
}

function payLive() {
  for (const t of TEXTS) setText('fm-t-' + t[0], fillText(t[2]));
  setText('fm-msg', message);
  datesLive();
}

/** Copy the name, number, amount and due date from the latest invoice or quote, into boxes that are empty. */
function payFill() {
  const tab = ['Tax Invoice', 'Invoice', 'Quote'].find((x) => has(get(x, 'cust')) || has(get(x, 'no')));
  if (!tab) return 0;
  const showGst = tab === 'Tax Invoice' || (tab === 'Quote' && registered());
  const total = sumLines(linesOf(tab, lineCount(tab)), showGst, gstRate()).total;
  const from = {
    gp_name: get(tab, 'cust'),
    gp_no: get(tab, 'no'),
    gp_job: get(tab, 'site'),
    gp_amt: total > 0 ? String(total) : '',
    gp_due: has(get(tab, 'date')) ? addDays(get(tab, 'date'), num(get('D', 'terms'))) : '',
  };
  let n = 0;
  for (const [k, v] of Object.entries(from)) {
    if (has(v) && !has(get(T, k))) {
      put(T, k, v);
      n++;
    }
  }
  message = n ? 'Filled ' + n + (n === 1 ? ' box' : ' boxes') + ' from your ' + tab + ' tab. Anything you typed stays.' : 'Nothing to fill: your boxes already have words, or there is no invoice or quote yet.';
  return n;
}

FORMS.push({ id: 'pay', label: 'Get Paid Faster', screen: payScreen, live: payLive, paper: () => '', keys: () => PAY_KEYS, fill: payFill });

/* ---------------- Job Completion Certificate ---------------- */

const CERT_KEYS = ['jc_cust', 'jc_addr', 'jc_no', 'jc_start', 'jc_done', 'jc_work', 'jc_out', 'jc_fixby', 'jc_warr', 'jc_cname', 'jc_cdate', 'jc_tname', 'jc_tdate', 'jc_csig', 'jc_cstr', 'jc_tsig', 'jc_tstr'];

function certScreen() {
  return `${note('A sign-off sheet for the customer to sign when the job is finished. It is not a statutory certificate of compliance.', 'navy')}
${sec('THE JOB')}
${row(T, 'jc_cust', 'Customer', 't', { auto: 'name' })}
${row(T, 'jc_addr', 'Job address', 't')}
${row(T, 'jc_no', 'Quote / invoice no.', 't')}
${row(T, 'jc_start', 'Start date', 'd')}
${row(T, 'jc_done', 'Completion date', 'd')}
${sec('WORK COMPLETED')}
${row(T, 'jc_work', 'Describe the work', 'a')}
${sec('OUTSTANDING ITEMS OR DEFECTS TO FIX')}
${row(T, 'jc_out', 'List them', 'a', { ex: 'Leave blank if there is nothing outstanding.' })}
${row(T, 'jc_fixby', 'To be fixed by', 'd')}
${sec('WORKMANSHIP / WARRANTY NOTE')}
${row(T, 'jc_warr', 'Note', 'a')}
${sec('SIGN-OFF')}
${row(T, 'jc_cname', 'Customer name (for the signature line)', 't', { ex: 'Blank uses the customer above.' })}
<div id="fm-sig-c"></div>
${row(T, 'jc_cdate', 'Customer sign date', 'd', { ex: 'Leave blank to write it by hand.' })}
${row(T, 'jc_tname', 'Your name', 't')}
<div id="fm-sig-t"></div>
${row(T, 'jc_tdate', 'Your sign date', 'd')}
${row(T, 'fm_src', 'Fill from which quote', 's', { options: sourceOptions(), ex: 'The current quote, or one of your last 3.' })}
<div class="note" id="fm-msg"></div>
${actions('<button class="b" id="fm-fill">Fill from the quote chosen above</button>')}`;
}

function certPaper() {
  const g = (/** @type {string} */ k) => get(T, k);
  const kv = (/** @type {string} */ label, /** @type {string} */ x) => (has(x) ? `<p><b>${label}:</b> ${lines(x)}</p>` : '');
  const box = (/** @type {string} */ x) => `<div class="fm-box">${lines(x)}</div>`;
  const sign = (/** @type {string} */ who, /** @type {string} */ name, /** @type {string} */ date, /** @type {string} */ img) => {
    const drawn = PNG.test(img) ? `<em class="sigem"><img class="sigimg" alt="${who} signature" src="${img}"></em>` : '<em></em>';
    return `<div class="sg"><div class="c"><em>${esc(name)}</em><span>${who} name</span></div><div class="c">${drawn}<span>${who} signature</span></div><div class="c"><em>${esc(date)}</em><span>Date</span></div></div>`;
  };
  let h = letterhead('JOB COMPLETION CERTIFICATE', [['Quote / invoice no.', g('jc_no')], ['Completed', fmtDate(g('jc_done'))]]);
  h += kv('Customer', g('jc_cust')) + kv('Job address', g('jc_addr')) + kv('Start date', fmtDate(g('jc_start'))) + kv('Completion date', fmtDate(g('jc_done')));
  h += '<div class="sec">WORK COMPLETED</div>' + box(g('jc_work'));
  h += '<div class="sec">OUTSTANDING ITEMS OR DEFECTS TO FIX</div>' + box(g('jc_out')) + kv('To be fixed by', fmtDate(g('jc_fixby')));
  h += '<div class="sec">WORKMANSHIP / WARRANTY NOTE</div>' + box(g('jc_warr'));
  h += '<div class="sec">CUSTOMER ACKNOWLEDGEMENT</div><p class="keep">I confirm the work described above has been completed, except for any items listed as outstanding.</p>';
  h += sign('Customer', g('jc_cname') || g('jc_cust'), fmtDate(g('jc_cdate')), g('jc_csig'));
  h += '<div class="sec">TRADIE</div>' + sign('Tradie', g('jc_tname'), fmtDate(g('jc_tdate')), g('jc_tsig'));
  h += '<p class="sm">This is a job sign-off sheet, not a statutory certificate of compliance. Licensed trades must still lodge any certificates required in their state or territory.</p>';
  return h + paperFoot();
}

/** Copy the customer, address, number and scope from the Quote tab, into boxes that are empty. */
function certFill() {
  const q = pickSource(get(T, 'fm_src'));
  const from = { jc_cust: q.cust, jc_addr: q.site || q.addr, jc_no: q.no, jc_work: q.scope };
  let n = 0;
  for (const [k, v] of Object.entries(from)) {
    if (has(v) && !has(get(T, k))) {
      put(T, k, v);
      n++;
    }
  }
  message = n ? 'Filled ' + n + (n === 1 ? ' box' : ' boxes') + ' from the quote you chose. Anything you typed stays.' : 'Nothing to fill: your boxes already have words, or there is no quote to fill from.';
  return n;
}

FORMS.push({ id: 'cert', label: 'Job Completion Certificate', screen: certScreen, live: () => { setText('fm-msg', message); datesLive(); }, paper: certPaper, keys: () => CERT_KEYS, fill: certFill });

/* ---------------- the tab itself ---------------- */

function formsScreen() {
  const open = current();
  const pick = FORMS.map((f) => `<button type="button" class="b${f.id === open.id ? '' : ' g'}" data-fm-pick="${f.id}" aria-pressed="${f.id === open.id}">${f.label}</button>`).join('');
  return `<div class="pg">${band('FORMS')}<div class="fm-pick" role="group" aria-label="Choose a form">${pick}</div>${open.screen()}${foot()}</div>`;
}

/** Show the screen again, with the saved words. */
function reopen() {
  const nav = document.querySelector(`#nav [data-t="${T}"]`);
  if (nav instanceof HTMLElement) nav.click();
}

function fallbackCopy(/** @type {string} */ text) {
  const a = document.createElement('textarea');
  a.value = text;
  a.setAttribute('readonly', '');
  a.className = 'fm-hide';
  document.body.appendChild(a);
  a.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  a.remove();
  return ok;
}

async function copyText(/** @type {HTMLElement} */ btn) {
  const el = document.getElementById('fm-t-' + btn.dataset.fmCopy);
  const text = el ? el.textContent || '' : '';
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = fallbackCopy(text);
  }
  const label = btn.dataset.fmLabel || (btn.dataset.fmLabel = btn.textContent || 'Copy');
  btn.textContent = ok ? 'Copied' : 'Press and hold the text to copy';
  setTimeout(() => {
    btn.textContent = label;
  }, 1800);
}

function onFormsClick(/** @type {HTMLElement} */ btn, /** @type {string} */ tab) {
  if (tab !== T) return;
  if (btn.dataset.fmPick) {
    put(T, 'form', btn.dataset.fmPick);
    message = '';
    reopen();
  } else if (btn.dataset.fmCopy) {
    copyText(btn);
  } else if (btn.id === 'fm-fill') {
    const f = current();
    if (f.fill) f.fill();
    reopen();
  } else if (btn.id === 'fm-clear' && confirm('Clear this form? Your business details stay.')) {
    for (const k of current().keys()) put(T, k, '');
    message = '';
    reopen();
  }
}

hooks.tabAfter['Worked Examples'] = [...(hooks.tabAfter['Worked Examples'] || []), FORMS_TAB];
hooks.docTabs.push(FORMS_TAB);
hooks.render.push((tab) => (tab === FORMS_TAB ? formsScreen() : null));
hooks.refresh.push((tab) => {
  if (tab === FORMS_TAB) current().live();
});
hooks.paperFull.push((tab) => (tab === FORMS_TAB ? current().paper() : null));
hooks.click.push(onFormsClick);
