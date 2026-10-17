// P3: the Progress Claim tab. It sits straight after Variation and has its own finished document.
import { $, setText } from '../../app/js/dom.js';
import { addDays, esc, fmtDate, has, money, num } from '../../app/js/format.js';
import { gstLabel, letterhead, paperFoot, payHtml, quoteTotal } from '../../app/js/paper.js';
import { get, gstRate, registered } from '../../app/js/state.js';
import { band, buttons, foot, note, payBlock, row, sec, total } from '../../app/js/views.js';
import { claimMaths } from './claim-math.js';

export const CLAIM_TAB = 'Progress Claim';
const T = CLAIM_TAB;

/** The sums for what is typed right now. A blank contract box uses the Quote tab total. */
function sums() {
  return claimMaths({
    contract: has(get(T, 'contract')) ? get(T, 'contract') : String(quoteTotal()),
    pct: get(T, 'pct'),
    prev: get(T, 'prev'),
    registered: registered(),
    gstRate: gstRate(),
  });
}

/** The editing screen. */
export function claimScreen() {
  return `<div class="pg">${band('PROGRESS CLAIM')}<div class="leg">Type in the cream boxes. Everything else works itself out. Send a claim when a stage of the job is finished.</div>
${sec('CLAIM DETAILS')}
${row(T, 'no', 'Claim no.', 't')}
${row(T, 'date', 'Date', 'd')}
${row(T, 'cust', 'Client / customer name', 't', { auto: 'name' })}
${row(T, 'site', 'Job site', 't')}
${row(T, 'qno', 'Quote / job no.', 't')}
${row(T, 'due', 'Due date', 'c')}
${sec('WHAT THIS CLAIM COVERS')}
${row(T, 'desc', 'Describe the work', 'a')}
${sec('THE MATHS')}
${row(T, 'contract', 'Contract total (incl GST)', 'm', { ex: 'Leave blank to use the total from your Quote tab. Type a figure if the job was quoted somewhere else.' })}
${row(T, 'pct', 'Work complete to date (%)', 'n', { ex: 'Everything finished so far, including work you already claimed. For example 40.' })}
${row(T, 'prev', 'Earlier claims on this job ($)', 'm', { ex: 'Add up your earlier claims on this job, including GST.' })}
<div class="warn" id="pc-warn"></div>
${row(T, 'todate', 'Work done to date', 'c')}
${total('Subtotal (ex GST)', 't1')}
${total('GST', 't3')}
${total('THIS CLAIM (incl GST)', 't4', 'big')}
${row(T, 'remain', 'Balance remaining on the contract', 'c')}
${payBlock()}
<div class="pay" id="c-terms"></div>
${note('Progress claims on building work have rules in most states, such as what the claim must say, when it can be sent and how long the customer has to respond. Check your state regulator before you rely on this form. This is not legal advice.')}
${buttons()}
${foot()}</div>`;
}

/** Keep the grey boxes and messages up to date. */
export function claimLive() {
  const reg = registered();
  const m = sums();
  const dateText = fmtDate(get(T, 'date'));
  const dateBox = $('#c-datef');
  if (dateBox) {
    dateBox.textContent = dateText || 'Pick a date';
    dateBox.classList.toggle('empty', !dateText);
  }
  setText('c-due', fmtDate(addDays(get(T, 'date'), num(get('D', 'terms')))));
  setText('c-todate', money(m.toDate));
  setText('t1', money(m.exGst));
  setText('t3', reg ? money(m.gst) : '');
  setText('t3l', gstLabel(reg));
  setText('t4l', reg ? 'THIS CLAIM (incl GST)' : 'THIS CLAIM');
  setText('t4', money(m.thisClaim));
  setText('c-remain', money(m.remaining));
  setText('pc-warn', m.warning);
  setText('c-terms', 'Payment due within ' + get('D', 'terms') + ' days of the claim date.');
  const pay = $('#c-pay1');
  if (pay) pay.innerHTML = payHtml(get(T, 'no'));
  const contractBox = $('#i-contract');
  if (contractBox instanceof HTMLInputElement) contractBox.placeholder = money(quoteTotal());
}

/** The clean finished document. */
export function claimPaper() {
  const D = (k) => get('D', k);
  const g = (k) => get(T, k);
  const reg = registered();
  const m = sums();
  const kv = (label, x) => (has(x) ? `<p><b>${label}:</b> ${esc(x).replace(/\n/g, '<br>')}</p>` : '');
  const tt = (label, x, cls = '') => `<div class="tr ${cls}"><span>${label}</span><span>${x}</span></div>`;
  const meta = [
    ['Claim no.', g('no')],
    ['Date', fmtDate(g('date'))],
    ['Due date', fmtDate(addDays(g('date'), num(D('terms'))))],
    ['Quote / job no.', g('qno')],
  ].filter((x) => has(x[1]));
  let h = letterhead('PROGRESS CLAIM', meta);
  h += kv('Client / customer', g('cust')) + kv('Job site', g('site')) + kv('This claim covers', g('desc'));
  h += tt('Contract total', money(m.contract)) + tt('Work complete to date', m.percent + '%') + tt('Work done to date', money(m.toDate)) + tt('Less earlier claims', money(m.earlier));
  if (reg) h += tt('Subtotal (ex GST)', money(m.exGst)) + tt(gstLabel(true), money(m.gst));
  h += tt(reg ? 'THIS CLAIM (incl GST)' : 'THIS CLAIM', money(m.thisClaim), 'big');
  h += tt('Balance remaining on the contract', money(m.remaining));
  if (has(D('bank')) || has(D('acno'))) h += `<div class="sec">PAYMENT DETAILS</div><div class="pd">${payHtml(g('no'))}</div>`;
  h += `<p>Payment due within ${esc(D('terms'))} days of the claim date.</p>`;
  return h + paperFoot();
}
