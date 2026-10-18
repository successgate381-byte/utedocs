// The clean finished document. Empty boxes are left out. This is what Preview and Save as PDF show.
import { isEstimate } from './data.js';
import { firstText, hooks, pipe } from './hooks.js';
import { addDays, esc, fmtDate, has, money, num, round2, safeUrl } from './format.js';
import { depositFraction, leftToPay, sumLines, variationNewTotal } from './calc.js';
import { get, gstRate, lineCount, linesOf, registered } from './state.js';

const TITLES = { Quote: 'QUOTE', 'Tax Invoice': 'TAX INVOICE', Invoice: 'INVOICE', Variation: 'VARIATION' };

/** The GST row label, for example "GST (10%)". */
export const gstLabel = (on) => (on ? 'GST (' + Math.round(gstRate() * 100) + '%)' : 'GST (not registered, none charged)');

/**
 * The top of a finished document: the title on its own line, then the business name with its
 * ABN, licence, phone and email together in one block, then the number and dates in a strip.
 * @param {string} title
 * @param {string[][]} meta  label and value pairs. Empty values are left out.
 */
export function letterhead(title, meta) {
  const D = (k) => get('D', k);
  const bit = (label, x) => (has(x) ? `<span><i>${label}</i> <b>${esc(x)}</b></span>` : '');
  const ids = bit('ABN', D('abn')) + bit('Licence', D('lic'));
  const contact = bit('Phone', D('phone')) + bit('Email', D('email'));
  const cells = meta.filter((m) => has(m[1])).map((m) => `<div class="mc"><span>${esc(m[0])}</span><b>${esc(m[1])}</b></div>`).join('');
  return `<div class="ttl">${title}</div><div class="lh"><b class="lhn">${esc(D('name') || 'Your Business Name')}</b>${ids ? `<div class="lhl">${ids}</div>` : ''}${contact ? `<div class="lhl">${contact}</div>` : ''}</div>${cells ? `<div class="mt">${cells}</div>` : ''}`;
}

/** The line under a finished document. Lite shows a small "Made with UteDocs" mark. Pro shows nothing. */
export function paperFoot() {
  if (hooks.edition === 'pro') return '';
  return '<div class="made"><svg viewBox="0 0 96 96" width="16" height="16" aria-hidden="true"><rect width="96" height="96" rx="22" fill="#1F2A44"/><path d="M27 17h29l15 15v44a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V22a5 5 0 0 1 5-5z" fill="#fff"/><path d="M56 17l15 15H61a5 5 0 0 1-5-5z" fill="#F28C28"/><path d="M32 40h22M32 50h14" stroke="#C5CCDA" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M35 66l8 8 18-19" stroke="#F28C28" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg><span>Made with UteDocs</span></div>';
}

/** Bank details and card link. Used on screen and on the finished document. */
export function payHtml(reference) {
  const D = (k) => get('D', k);
  const r = (label, v) => (has(v) ? `<div class="pr"><span>${label}</span><b>${esc(v)}</b></div>` : '');
  const link = safeUrl(D('card'));
  const card = has(D('card'))
    ? `<div class="pc"><b>Pay by card:</b> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(D('card'))}</a>` : esc(D('card'))}</div>`
    : '';
  return r('Bank', D('bank')) + r('Account name', D('acct')) + r('BSB', D('bsb')) + r('Account number', D('acno')) + r('PayID', D('payid')) + r('Reference', reference) + card;
}

/** Quote total used by a Variation when no original total is typed. */
export function quoteTotal() {
  return sumLines(linesOf('Quote', lineCount('Quote')), registered(), gstRate()).total;
}

/** Build the finished document for this tab into #paper. */
export function buildPaper(tab) {
  const P = document.getElementById('paper');
  if (!P) return;
  P.dataset.doc = tab;
  const whole = firstText(hooks.paperFull, tab);
  if (whole !== null) {
    P.innerHTML = pipe(hooks.paperAfter, whole, tab);
    return;
  }
  const D = (k) => get('D', k);
  const g = (k) => get(tab, k);
  const q = tab === 'Quote';
  const ti = tab === 'Tax Invoice';
  const inv = tab === 'Invoice';
  const vr = tab === 'Variation';
  const reg = registered();
  const showGst = ti || ((q || vr) && reg);
  const n = lineCount(tab);
  const v = sumLines(linesOf(tab, n), showGst, gstRate());
  const date = g('date');
  const kv = (label, x) => (has(x) ? `<p><b>${label}:</b> ${esc(x).replace(/\n/g, '<br>')}</p>` : '');
  const tt = (label, x, cls = '') => `<div class="tr ${cls}"><span>${label}</span><span>${x}</span></div>`;

  const meta = [
    [(vr ? 'Variation' : q ? 'Quote' : 'Invoice') + ' no.', g('no')],
    ['Date', fmtDate(date)],
    q ? ['Valid until', fmtDate(addDays(date, 30))] : vr ? ['Quote / job no.', g('qno')] : ['Due date', fmtDate(addDays(date, num(D('terms'))))],
    vr ? ['Extra days', g('days')] : ['', ''],
  ].filter((m) => has(m[1]));

  let h = letterhead(TITLES[tab], meta);
  h += kv(ti ? 'Bill to' : q ? 'Prepared for' : 'Client / customer', (g('cust') || '') + (has(g('cabn')) ? ' (ABN ' + g('cabn') + ')' : ''));
  h += kv('Phone / email', g('phone')) + kv('Address', g('addr')) + kv(q || vr ? 'Job site' : 'Job address', g('site'));
  if (q) h += kv('Scope of work', g('scope')) + kv('Price type', g('ptype') || 'Fixed price') + kv('Estimated start', g('start')) + kv('Estimated completion', g('finish'));
  if (vr) h += kv('Why the change', g('why') === 'Other' && has(g('whyo')) ? g('whyo') : g('why') || 'Customer asked for it') + kv('What is changing', g('desc'));

  let rows = '';
  for (let i = 1; i <= n; i++) {
    const used = has(g('q' + i)) && has(g('p' + i));
    if (!used && !has(g('d' + i))) continue;
    rows += `<tr><td>${esc(g('d' + i))}</td><td class="n">${esc(g('q' + i))}</td><td class="n">${used ? money(num(g('p' + i))) : ''}</td>${showGst ? `<td>${g('g' + i) === 'No' ? 'No' : 'Yes'}</td>` : ''}<td class="n">${used ? money(round2(num(g('q' + i)) * num(g('p' + i)))) : ''}</td></tr>`;
  }
  const ex = showGst ? ' (ex GST)' : '';
  if (rows) h += `<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">${q || vr ? 'Unit price' : 'Price'}${ex}</th>${showGst ? '<th>GST?</th>' : ''}<th class="n">Amount${ex}</th></tr></thead><tbody>${rows}</tbody></table>`;

  h += '<div class="tot">';
  h += tt('Subtotal' + ex, money(v.sub)) + (showGst ? tt(gstLabel(showGst), money(v.gst)) : '');
  h += tt(vr ? 'THIS VARIATION' + (showGst ? ' (incl GST)' : '') : ti ? 'TOTAL PAYABLE (incl GST)' : q ? (isEstimate(g('ptype')) ? 'ESTIMATED TOTAL' : 'TOTAL') + (showGst ? ' (incl GST)' : '') : 'TOTAL PAYABLE', money(v.total), 'big');
  if (ti) h += `<p class="sm">${v.gstFree ? 'GST amount is shown above. Items marked No are GST-free.' : 'Total price includes GST of ' + money(v.gst)}</p>`;
  if (q) h += `<p class="sm">${reg ? 'All prices exclude GST. GST is added to items marked Yes.' : 'Not registered for GST. No GST charged.'}</p>`;
  if (q && isEstimate(g('ptype'))) h += '<p class="sm">This is an estimate, not a fixed price. The final price depends on the actual hours and materials.</p>';
  if (inv) h += '<p class="sm">GST not applicable. Supplier is not registered for GST.</p>';
  h += '</div>';

  if (q) {
    const fee = num(g('fee'));
    h += kv('Inclusions', g('incl')) + kv('Exclusions', g('excl'));
    h += has(g('dep'))
      ? `<p><b>Deposit:</b> ${money(round2(v.total * depositFraction(g('dep'))))} due on acceptance.${has(g('bal')) ? ' <b>Balance:</b> ' + esc(g('bal')) + '.' : ''}</p>`
      : kv('Balance due', g('bal'));
    if (has(g('fee'))) {
      h += `<p><b>Quote fee:</b> ${money(fee)} (kept separate from the quote total). ${g('feec') === 'No' ? 'Not credited back.' : 'Taken off if you go ahead: ' + money(leftToPay(v.total, fee)) + ' left to pay.'}</p>`;
    }
  }
  if (vr) {
    const orig = has(g('orig')) ? num(g('orig')) : quoteTotal();
    h += '<div class="tot">' + tt('Original quote total', money(orig)) + tt('Earlier approved variations', money(num(g('prev')))) + tt('This variation', money(v.total));
    h += tt('NEW TOTAL', money(variationNewTotal(orig, num(g('prev')), v.total)), 'big') + kv('How it gets paid', g('pay')) + '</div>';
  }
  if (!vr && (has(D('bank')) || has(D('acno')))) h += `<div class="sec">PAYMENT DETAILS</div><div class="pd">${payHtml(g('no'))}</div>`;
  if (ti || inv) h += `<p>Payment due within ${esc(D('terms'))} days of the invoice date.</p>`;
  if (q) h += '<p class="sm keep">Variations: any change to the scope of work will be quoted and agreed in writing before the work starts.</p>';
  if (q || vr) {
    const f = (k) => (has(g(k)) ? (k === 'ad' ? fmtDate(g(k)) : esc(g(k))) : '&nbsp;');
    const ref = (vr ? 'Variation' : 'Quote') + (has(g('no')) ? ' ' + g('no') : '') + (has(g('cust')) ? ' for ' + g('cust') : '') + ': ' + (vr ? 'this variation ' : 'total ') + money(v.total) + (showGst ? ' (incl GST)' : '');
    h += `<p class="aref">${esc(ref)}</p>`;
    h += `<p class="accept"><b>${vr ? 'I approve this variation, the extra cost and any extra days shown above. The extra work starts after I approve.' : 'I accept this quote.'}</b></p>`;
    h += `<div class="sg"><div class="c"><em>${f('an')}</em><span>Client / customer name</span></div><div class="c"><em>${f('as')}</em><span>Client / customer signature</span></div><div class="c"><em>${f('ad')}</em><span>Date</span></div></div>`;
  }
  P.innerHTML = pipe(hooks.paperAfter, h + paperFoot(), tab);
}
