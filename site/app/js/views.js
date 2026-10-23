// The editing screens. Each tab builds a string of HTML. Nothing here reads the page.
import { ATO_STAMP, EXCLUSIONS, FOOT, INVOICE_TYPES, LISTS, MARKUPS, NOTES, PRICE_TYPES, PRIVACY, TRADES, UNITS, WHY_OPTIONS } from './data.js';
import { esc } from './format.js';
import { marginForMarkup } from './calc.js';
import { get, lineCount, tradeName } from './state.js';
import { firstText, hooks } from './hooks.js';
import { MAX_DOC, MAX_SAVED, NOTE_MODES, docNoteCount, savedCount } from './notes.js';
import { KINDS, saveable } from './recent.js';

/* ---------- small building blocks ---------- */

/**
 * One input. Types: t text, a growing text area, d date, s select,
 * m money, n number, abn, bsb, c computed (read only).
 */
function control(scope, key, type, o = {}) {
  const a = `data-s="${scope}" data-k="${key}" id="i-${key}"`;
  const ac = o.auto ? ` autocomplete="${o.auto}"` : '';
  if (type === 'a') return `<textarea ${a} rows="1"></textarea>`;
  if (type === 'd') return `<div class="date"><span class="date-t" id="c-${key}f"></span><input type="date" ${a}></div>`;
  if (type === 's') return `<select ${a}>${o.options.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>`;
  if (type === 'm') return `<input class="m" inputmode="decimal" placeholder="$0.00" ${a}>`;
  if (type === 'n') return `<input inputmode="decimal" ${a}>`;
  if (type === 'abn') return `<input class="abn" inputmode="numeric" placeholder="12 345 678 901" ${a}>`;
  if (type === 'bsb') return `<input class="bsb" inputmode="numeric" placeholder="062-000" ${a}>`;
  if (type === 'c') return `<div class="cv" id="c-${key}"></div>`;
  return `<input type="text" ${a}${ac}>`;
}

/** A label and its box. */
export const row = (scope, key, label, type, o = {}) =>
  `<div class="fr"${o.w ? ` id="${o.w}"` : ''}><label for="i-${key}">${label}</label>${control(scope, key, type, o)}${o.ex ? `<div class="ex">${esc(o.ex)}</div>` : ''}</div>`;

export const sec = (t) => `<div class="sec">${t}</div>`;
export const note = (t, cls = '') => `<div class="note ${cls}">${t}</div>`;
export const total = (label, id, cls = '') => `<div class="tr ${cls}"><span id="${id}l">${label}</span><span id="${id}"></span></div>`;
const plain = (a, b) => `<div class="tr plain"><span>${a}</span><span>${b}</span></div>`;
const bz = (l, v) => `<div class="bz"><span>${l}</span><b>${esc(v)}</b></div>`;

/** Business name band and the details list under it. */
export function band(title) {
  const biz = [
    ['ABN', get('D', 'abn') || '00 000 000 000'],
    ['Licence', get('D', 'lic') || 'your licence no.'],
    ['Phone', get('D', 'phone') || 'your phone'],
    ['Email', get('D', 'email') || 'your email'],
  ];
  return `<div class="band"><b>${esc(get('D', 'name') || 'Your Business Name')}</b><i>${title}</i></div><div class="biz">${biz.map((b) => bz(b[0], b[1])).join('')}</div>`;
}

/**
 * Name, signature and date for the CLIENT to fill in.
 * The typed words sit ABOVE the line and the label sits BELOW it,
 * exactly like the finished document.
 */
function signature(scope) {
  const cell = (key, label, type) =>
    `<div class="c">${type === 'd' ? control(scope, key, 'd') : `<input type="text" data-s="${scope}" data-k="${key}" id="i-${key}" autocomplete="off">`}<label for="i-${key}">${label}</label></div>`;
  return `<div class="sg edit">${cell('an', 'Client / customer name', 't')}${cell('as', 'Client / customer signature', 't')}${cell('ad', 'Date', 'd')}</div>`;
}

/** Rows for the items, with a header row. */
function lineRows(tab, withGst, heads) {
  const n = lineCount(tab);
  const ni = withGst ? '' : ' ni';
  let h = `<div class="ln th${ni}"><span>#</span><span>${heads[0]}</span><span>Qty</span><span>${heads[1]}</span>${withGst ? '<span>GST on item?</span>' : ''}<span>${heads[2]}</span></div>`;
  for (let i = 1; i <= n; i++) {
    h += `<div class="ln${ni}"><span class="nn">${i}</span><input class="d" list="dl" placeholder="Description" aria-label="Description ${i}" data-s="${tab}" data-k="d${i}"><input class="q" inputmode="decimal" placeholder="Qty" aria-label="Quantity ${i}" data-s="${tab}" data-k="q${i}"><input class="p m" inputmode="decimal" placeholder="$0.00" aria-label="Price ${i}" data-s="${tab}" data-k="p${i}">${withGst ? `<select aria-label="GST on item ${i}" data-s="${tab}" data-k="g${i}"><option value="Yes">GST: Yes</option><option value="No">GST: No</option></select>` : ''}<div class="am" id="c-a${i}"></div></div>`;
  }
  return h + `<div class="btns tight"><button class="b g" id="addl">+ Add a line</button><button class="b g" id="rml">Remove last line</button></div>`;
}

export const payBlock = () => `${sec('PAYMENT DETAILS')}<div class="pd" id="c-pay1"></div>`;

export const buttons = () =>
  `<div class="warn" id="req2"></div><div class="btns"><button class="b" id="pv">Preview</button><button class="b o" id="pdf">Save as PDF</button><button class="b g" id="clr">Clear this document</button></div>` +
  note('Preview and Save as PDF show the clean finished document, without the empty boxes. In the print window choose Save as PDF as the printer. Your work is saved on this device only.');

export const foot = () => note(FOOT);

/* ---------- the nine tabs ---------- */

const START_STEPS = [
  'Open My Details. Type your business name, ABN, trade, bank name, BSB and account number in the cream boxes. You only do this once.',
  'Not sure if you charge GST? Pick Yes or No on My Details. Yes = use Tax Invoice. No = use Invoice. The page warns you if you pick the wrong tab.',
  'Every new job: open Quote, Tax Invoice or Invoice and type over the cream boxes. The sums work themselves out. The Description box suggests common jobs for your trade. Type your own words any time.',
  'Dates: pick them from the calendar. The due date is worked out for you.',
  'Send it: tap Save as PDF at the bottom of the document, then Clear this document for the next job.',
  'Customer wants to pay by card? Paste your card reader or payment link on My Details. Never write card numbers on a quote or invoice, and never ask for them by text or email.',
];

function startHere() {
  return `<div class="pg"><div class="band"><b>UTEDOCS</b></div><div class="sub">Quotes, invoices and sign-off for tradies. Set up in 3 minutes.</div>${sec('SET UP AND USE')}
${START_STEPS.map((s, i) => `<div class="st"><b>${i + 1}</b><span>${s}</span></div>`).join('')}
${sec('WHICH TAB DO I USE?')}
${note('Quote: price a job before you start. Tax Invoice: registered for GST, use this to get paid. Invoice: not registered for GST, use this to get paid. Variation: customer wants extra work or something changes, get it approved first. Rate Calculator: work out your hourly rate and a fair markup on parts. Line Items: pick-list of common jobs for your trade. Worked Examples: see a finished quote and invoice.')}
${sec('WHAT THIS KIT FOLLOWS')}
${note(esc(ATO_STAMP))}
${note(PRIVACY + ' Questions? Reply to your receipt email and I will answer within 24 hours.')}
${foot()}</div>`;
}

/** My Details: words saved once and used on any document. The app writes none of them. */
function notesLibrary() {
  let h = sec('SAVED NOTES (OPTIONAL)') + note('Words you use again and again, for example a warranty line or a licence note. You type them, so they are your own words. Each one can print on every document, and you can leave it off any single document. If a note promises a warranty, the ACCC has required wording about the Australian Consumer Law, so check accc.gov.au first.');
  for (let i = 1; i <= savedCount(); i++) {
    h += `<div class="nt"><h4>Saved note ${i}</h4>${row('D', 'nl_t' + i, 'Title', 't', { ex: 'Warranty' })}${row('D', 'nl_b' + i, 'Words to print', 'a')}${row('D', 'nl_p' + i, 'Print on documents', 's', { options: ['Yes', 'No'], ex: 'Yes means it prints unless you leave it off one document.' })}</div>`;
  }
  return h + `<div class="btns"><button class="b g" id="nl-add"${savedCount() >= MAX_SAVED ? ' disabled' : ''}>+ Add a saved note</button><button class="b g" id="nl-rm"${savedCount() === 0 ? ' disabled' : ''}>Remove the last saved note</button></div>`;
}

/** The Save button of a document that keeps saved copies (the Quote and the Variation). */
function saveBox(/** @type {string} */ tab) {
  if (!saveable(tab)) return '';
  const k = KINDS[tab];
  return sec('SAVE THIS ' + k.word.toUpperCase()) + note('Keeps ' + k.keeps + ' of your last 3 ' + k.word + 's.' + k.use + ' Price lines are not kept.') + `<div class="btns"><button class="b" id="dsave" data-tab="${tab}">Save this ${k.word}</button></div><div class="note" id="dsave-msg"></div>`;
}

/** The end of a document screen: saved notes can be left off, and up to three notes for this document only. */
function notesBox(/** @type {string} */ tab) {
  let h = sec('NOTES (OPTIONAL)') + note('Notes print near the end of the document, above the signature. Saved notes come from My Details.');
  for (let i = 1; i <= savedCount(); i++) h += row(tab, 'nu' + i, esc(get('D', 'nl_t' + i) || 'Saved note ' + i), 's', { options: NOTE_MODES });
  for (let i = 1; i <= docNoteCount(tab); i++) {
    h += `<div class="nt"><h4>Note ${i} for this document</h4>${row(tab, 'nx_t' + i, 'Title', 't')}${row(tab, 'nx_b' + i, 'Words to print', 'a')}${row(tab, 'nx_p' + i, 'Print on PDF', 's', { options: ['Yes', 'No'] })}</div>`;
  }
  return h + `<div class="btns"><button class="b g" id="nt-add" data-tab="${tab}"${docNoteCount(tab) >= MAX_DOC ? ' disabled' : ''}>+ Add a note</button><button class="b g" id="nt-rm" data-tab="${tab}"${docNoteCount(tab) === 0 ? ' disabled' : ''}>Remove the last note</button></div>`;
}

function myDetails() {
  return `<div class="pg"><div class="band"><b>MY BUSINESS DETAILS</b></div><div class="sub">Fill this page in once. It appears on the Quote, Tax Invoice and Invoice tabs by itself.</div>
${sec('YOUR BUSINESS')}${row('D', 'name', 'Business name', 't', { ex: 'Smith Electrical', auto: 'organization' })}${row('D', 'abn', 'ABN (11 digits)', 'abn', { ex: '12 345 678 901' })}<div class="warn" id="abn-hint"></div>${row('D', 'lic', 'Licence no. (if you have one)', 't', { ex: 'EC12345' })}${row('D', 'phone', 'Phone', 't', { ex: '0412 345 678', auto: 'tel' })}${row('D', 'email', 'Email', 't', { ex: 'jo@smithelectrical.com.au', auto: 'email' })}
${row('D', 'gst', 'Registered for GST?', 's', { options: ['Yes', 'No'], ex: 'Many sole traders under $75,000 a year are not registered. Check the ATO.' })}${row('D', 'trade', 'Your trade', 's', { options: TRADES, ex: 'Decides which job suggestions show in the Description boxes.' })}${row('D', 'tradeo', 'Type your trade', 't', { w: 'w-tradeo', ex: 'For example: carpenter, painter, landscaper. Shown on your Line Items tab.' })}
${sec('GETTING PAID')}
${row('D', 'bank', 'Bank name', 't', { ex: 'Commonwealth Bank' })}
${row('D', 'acct', 'Bank account name', 't', { ex: 'Smith Electrical' })}
${row('D', 'bsb', 'BSB', 'bsb', { ex: '062-000' })}
${row('D', 'acno', 'Account number', 't', { ex: '12345678' })}
${row('D', 'payid', 'PayID (optional)', 't', { ex: '0412 345 678' })}
${row('D', 'card', 'Card payment link (optional)', 't', { ex: 'Paste the payment link from your card reader or provider. Never type card numbers here or on an invoice.' })}
${row('D', 'terms', 'Payment terms (days)', 'n', { ex: '7' })}
${row('D', 'rate', 'GST rate (%)', 'n', { ex: '10% (Australian GST. Only change it if the law changes.)' })}
${note('The 10% rate is Australian GST. Your Registered for GST answer decides whether the Quote shows GST and which invoice tab to use: Tax Invoice if Yes, Invoice if No.')}${notesLibrary()}${foot()}</div>`;
}

function documentTab(tab) {
  const q = tab === 'Quote';
  const ti = tab === 'Tax Invoice';
  const title = q ? 'QUOTE' : ti ? 'TAX INVOICE' : 'INVOICE';
  let h = `<div class="pg">${band(title)}<div class="leg" id="leg"></div>${sec(q ? 'QUOTE DETAILS' : 'INVOICE DETAILS')}`;
  h += row(tab, 'no', q ? 'Quote no.' : 'Invoice no.', 't') + row(tab, 'date', q ? 'Date' : 'Issue date', 'd') + row(tab, 'cust', q ? 'Client / customer name' : 'Bill to', 't', { auto: 'name' });
  h += q
    ? row(tab, 'valid', 'Valid until', 'c') + row(tab, 'phone', 'Phone / email', 't') + row(tab, 'start', 'Estimated start (optional)', 't', { ex: 'For example a date, or TBC on acceptance.' }) + row(tab, 'finish', 'Estimated completion (optional)', 't', { ex: 'For example 2 days from the start.' })
    : row(tab, 'due', 'Due date', 'c');
  if (ti) h += row(tab, 'cabn', 'Customer ABN', 'abn') + '<div class="warn" id="cabn-hint"></div>';
  h += row(tab, 'addr', 'Address', 't') + row(tab, 'site', q ? 'Job site' : 'Job address', 't');
  if (ti) h += '<div class="warn" id="req"></div>';
  if (!q) h += row(tab, 'ptype', 'How the job is priced', 's', { options: INVOICE_TYPES });
  if (q) h += sec('SCOPE AND PRICE') + row(tab, 'scope', 'Scope of work', 'a') + row(tab, 'ptype', 'Price type', 's', { options: PRICE_TYPES });
  const lm = firstText(hooks.lines, tab);
  h += '<div class="gap"></div>' + (lm !== null ? lm : lineRows(tab, tab !== 'Invoice', ['Description', q ? 'Unit price (ex GST)' : ti ? 'Price (ex GST)' : 'Unit price', q || ti ? 'Amount (ex GST)' : 'Amount']));
  if (tab === 'Invoice') h += total('TOTAL PAYABLE', 't4', 'big') + note('GST not applicable. Supplier is not registered for GST.');
  else h += total('Subtotal (ex GST)', 't1') + total('GST', 't3') + total(ti ? 'TOTAL PAYABLE (incl GST)' : 'TOTAL', 't4', 'big') + '<div class="note" id="c-gn"></div>';
  if (q) {
    h += sec('TERMS') + row(tab, 'incl', 'Inclusions', 'a') + row(tab, 'excl', 'Exclusions', 'a') + row(tab, 'dep', 'Deposit (%)', 'n') + '<div class="note" id="c-dn"></div>' + row(tab, 'bal', 'Balance due', 't');
    h += row(tab, 'fee', 'Quote fee ($)', 'm') + row(tab, 'feec', 'Credited if they go ahead?', 's', { options: ['Yes', 'No'] }) + '<div class="note" id="c-fn"></div>';
  }
  h += payBlock();
  if (q) {
    h += note('Variations: any change to the scope of work will be quoted and agreed in writing before the work starts.') + sec('ACCEPTANCE') + note('<b>I accept this quote.</b>') + note('The customer fills this in, not you. Hand them your phone, or print the PDF and let them sign it.') + signature(tab);
  } else {
    h += '<div class="pay" id="c-terms"></div>';
  }
  return h + notesBox(tab) + saveBox(tab) + buttons() + foot() + '</div>';
}

function variation() {
  const tab = 'Variation';
  return `<div class="pg">${band('VARIATION')}<div class="leg">Type in the cream boxes. Everything else works itself out. Get this approved BEFORE you do the extra work.</div>${sec('VARIATION DETAILS')}
${row(tab, 'no', 'Variation no.', 't')}
${row(tab, 'date', 'Date', 'd')}
${row(tab, 'qno', 'Quote / job no.', 't')}
${row(tab, 'days', 'Extra days', 'n')}
${row(tab, 'cust', 'Client / customer name', 't', { auto: 'name' })}
${row(tab, 'site', 'Job site', 't')}
${row(tab, 'why', 'Why the change?', 's', { options: WHY_OPTIONS })}
${row(tab, 'whyo', 'Describe the reason', 't', { w: 'w-whyo' })}
${sec('WHAT IS CHANGING')}
${row(tab, 'desc', 'Describe the change', 'a')}<div class="gap"></div>${lineRows(tab, true, ['Description', 'Unit price (ex GST)', 'Amount (ex GST)'])}
${total('Subtotal (ex GST)', 't1')}
${total('GST', 't3')}
${total('THIS VARIATION (extra cost)', 't4', 'big')}
${sec('NEW CONTRACT TOTAL')}
${row(tab, 'orig', 'Original quote total', 'm', { ex: 'Leave blank to use the total from your Quote tab. Type a figure if this job was quoted somewhere else.' })}
${row(tab, 'prev', 'Earlier approved variations on this job ($)', 'm')}
${total('This variation', 'v3')}
${total('NEW TOTAL', 'v4', 'big')}
${note('Working on a second variation? Put the earlier approved ones in the box above.')}
${row(tab, 'pay', 'How it gets paid', 't')}
${note('On domestic building work most states have strict rules for variations (written, signed, sometimes extra steps). Check your state regulator before you rely on this form. This is not legal advice.')}
${sec('CUSTOMER APPROVAL')}
${note('I approve this variation, the extra cost and any extra days shown above. The extra work starts after I approve.', 'navy')}
${note('The customer fills this in, not you.')}
${signature(tab)}
${notesBox(tab)}
${saveBox(tab)}
${buttons()}
${foot()}</div>`;
}

function rateCalculator() {
  const t = 'Rate Calculator';
  return `<div class="pg"><div class="band"><b>RATE AND MARKUP CALCULATOR</b></div><div class="leg">Work out what to charge so jobs actually pay. The cream boxes hold EXAMPLE numbers: type over them with yours. All prices are ex GST.</div>${sec('1. YOUR MINIMUM HOURLY RATE')}
${row(t, 'wage', 'Wage you want before tax ($ a year)', 'm', { ex: 'Example only. What you want to take home before tax. Ask your accountant how much to set aside for tax and super.' })}
${row(t, 'costs', 'Business costs ($ a year)', 'm', { ex: 'Example only. Vehicle, fuel, insurance, tools, phone, licence, accountant, software, training.' })}
${row(t, 'weeks', 'Weeks you work a year', 'n', { ex: 'Example only. Take out holidays, public holidays, sick days and quiet weeks.' })}
${row(t, 'hrs', 'Chargeable hours a week', 'n', { ex: 'Example only. Quoting, driving, buying parts and paperwork usually eat a big part of the week, so this is lower than hours worked.' })}
${row(t, 'need', 'Money you need to bring in ($ a year)', 'c', { ex: 'Wage plus business costs.' })}
${row(t, 'hy', 'Chargeable hours a year', 'c', { ex: 'Weeks times chargeable hours.' })}
${total('MINIMUM HOURLY RATE (ex GST)', 'rt', 'big')}
${note('Charge at least this. Less than this and you are working for less than you planned.')}
${row(t, 'rg', 'Same rate including GST', 'c', { ex: 'Only adds GST if you said you are registered on My Details.' })}
${sec('2. MATERIALS MARKUP')}
${row(t, 'part', 'What you pay for the part ($)', 'm', { ex: 'Example only. Your cost price, ex GST.' })}
${row(t, 'mk', 'Markup you add (%)', 'n', { ex: 'Example only. Markup is a percentage added ON TOP of what you paid.' })}
${row(t, 'sp', 'Sell price (ex GST)', 'c', { ex: 'What you charge the customer for the part.' })}
${row(t, 'pf', 'Profit on the part ($)', 'c', { ex: 'Sell price minus what you paid.' })}
${row(t, 'mg', 'Margin (profit as % of sell price)', 'c', { ex: 'Markup and margin are different. A 30% markup is only about a 23% margin.' })}
${sec('3. WHAT EACH MARKUP REALLY EARNS')}
${MARKUPS.map((m) => plain(m + '% markup', marginForMarkup(m).toFixed(1) + '% margin')).join('')}
${note('If you want to keep a set margin on parts, check this table first. To keep a 25% margin you need a 33% markup, not 25%.')}
${note('A starting point only. Check what other trades near you charge and talk to your accountant. Numbers above are examples, not advice.')}
${foot()}</div>`;
}

function lineItems() {
  const trade = get('D', 'trade') || 'Electrician';
  const items = LISTS[trade];
  const units = UNITS[trade];
  const hints = NOTES[trade] || {};
  const list = items.map((d, i) => `<div class="tr plain"><span>${esc(d)}${hints[i] ? `<br><small>${esc(hints[i])}</small>` : ''}</span><span class="mut">${units[i]}</span></div>`).join('');
  return `<div class="pg"><div class="band"><b>${esc(tradeName().toUpperCase())} LINE ITEMS</b></div><div class="leg">Tap a Description box on the Quote, Tax Invoice, Invoice or Variation tab to pick from this list, or just type your own words. Prices are blank on purpose: set your own. To change this list, change "Your trade" on My Details.</div>${sec('COMMON LINE ITEMS')}
${list}
${sec('SUGGESTED EXCLUSIONS (copy what applies into the Exclusions box on your Quote)')}
${EXCLUSIONS[trade].map((x) => note('&bull; ' + esc(x), 'dark')).join('')}
${note('Starter wording only. Change it to suit your trade, your state and each job.')}
${foot()}</div>`;
}

function workedExamples() {
  return `<div class="pg"><div class="band"><b>WORKED EXAMPLES</b></div><div class="leg">EXAMPLES ONLY. The names and figures are made up to show what a finished quote and invoice look like. Set your own rates.</div>${sec('EXAMPLE A: SPARKY QUOTE (Q-001)')}
${note('Replace 6 downlights in living room. Prices exclude GST.', 'dark')}
${plain('1. Labour (hours) &nbsp; 3 &times; $95.00 &nbsp; GST: Yes', '$285.00')}
${plain('2. LED downlights &nbsp; 6 &times; $30.00 &nbsp; GST: Yes', '$180.00')}<div class="tr"><span>Subtotal (ex GST)</span><span>$465.00</span></div><div class="tr"><span>GST (10%)</span><span>$46.50</span></div><div class="tr big"><span>TOTAL</span><span>$511.50</span></div>${note('No deposit for a job this size. Balance due on completion. Exclusions: plastering and painting.')}
${sec('EXAMPLE B: PLUMBER TAX INVOICE (INV-014)')}
${note('Replace kitchen mixer tap. Bill to: A. Customer.', 'dark')}
${plain('1. Labour (hours) &nbsp; 1.5 &times; $110.00 &nbsp; GST: Yes', '$165.00')}
${plain('2. Mixer tap supplied &nbsp; 1 &times; $120.00 &nbsp; GST: Yes', '$120.00')}<div class="tr"><span>Subtotal (ex GST)</span><span>$285.00</span></div><div class="tr"><span>GST (10%)</span><span>$28.50</span></div><div class="tr big"><span>TOTAL PAYABLE (incl GST)</span><span>$313.50</span></div>${note('Total price includes GST of $28.50. Payment due within 7 days.')}
${note('To make your own: open the Quote, Tax Invoice or Invoice tab and type in the cream boxes. Tap Clear this document when you are ready for the next job.')}
${foot()}</div>`;
}

/** The HTML for one tab's editing screen. */
export function renderTab(tab) {
  const extra = firstText(hooks.render, tab);
  if (extra !== null) return extra;
  if (tab === 'Start Here') return startHere();
  if (tab === 'My Details') return myDetails();
  if (tab === 'Variation') return variation();
  if (tab === 'Rate Calculator') return rateCalculator();
  if (tab === 'Line Items') return lineItems();
  if (tab === 'Worked Examples') return workedExamples();
  return documentTab(tab);
}

