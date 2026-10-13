// Keeps the grey calculated boxes, warnings and messages up to date.
import { $, $$, setText } from './dom.js';
import { abnLooksValid, addDays, fmtDate, has, money, num, round2 } from './format.js';
import { depositFraction, leftToPay, rateCalc, sumLines, variationNewTotal } from './calc.js';
import { buildPaper, gstLabel, payHtml, quoteTotal } from './paper.js';
import { get, gstRate, lineCount, linesOf, registered } from './state.js';
import { DOC_TABS, isEstimate } from './data.js';
import { hooks, isDocTab, runAll } from './hooks.js';

/** Show the picked date as "6 Oct 2026" in every date box. */
function showDates(tab) {
  $$('.date-t').forEach((e) => {
    const key = e.id.slice(2, -1);
    const text = fmtDate(get(tab, key));
    e.textContent = text || 'Pick a date';
    e.classList.toggle('empty', !text);
  });
}

function showLineAmounts(tab, n) {
  for (let i = 1; i <= n; i++) {
    const used = has(get(tab, 'q' + i)) && has(get(tab, 'p' + i));
    setText('c-a' + i, used ? money(round2(num(get(tab, 'q' + i)) * num(get(tab, 'p' + i)))) : '');
  }
}

function totalsRows(v, showGst) {
  setText('t1', money(v.sub));
  setText('t3', showGst ? money(v.gst) : '');
  setText('t3l', gstLabel(showGst));
  setText('t4', money(v.total));
}

function documentLive(tab) {
  const q = tab === 'Quote';
  const ti = tab === 'Tax Invoice';
  const reg = registered();
  const showGst = ti || (q && reg);
  const n = lineCount(tab);
  const v = sumLines(linesOf(tab, n), showGst, gstRate());
  const date = get(tab, 'date');
  totalsRows(v, showGst);
  if (q) setText('t4l', isEstimate(get(tab, 'ptype')) ? 'ESTIMATED TOTAL' : 'TOTAL');
  showLineAmounts(tab, n);
  showDates(tab);
  setText('c-valid', fmtDate(addDays(date, 30)));
  setText('c-due', fmtDate(addDays(date, num(get('D', 'terms')))));

  let leg = 'Type in the cream boxes. Everything else works itself out.';
  let bad = false;
  if (ti && !reg) {
    leg = 'STOP: you are not registered for GST. Use the Invoice tab, not this one.';
    bad = true;
  }
  if (tab === 'Invoice' && reg) {
    leg = 'STOP: you are registered for GST. Use the Tax Invoice tab, not this one.';
    bad = true;
  }
  const L = $('#leg');
  if (L) {
    L.textContent = leg;
    L.className = 'leg' + (bad ? ' bad' : '');
  }
  setText('req', ti && v.total >= 1000 && !has(get(tab, 'cust')) && !has(get(tab, 'cabn')) ? 'REQUIRED: add the customer name or ABN. The ATO needs it when the total is $1,000 or more including GST.' : '');
  if (ti) setText('c-gn', v.gstFree ? 'GST amount is shown above. Items marked No are GST-free.' : 'Total price includes GST of ' + money(v.gst));
  if (q) {
    setText('c-gn', reg ? 'All prices exclude GST. GST is added to items marked Yes.' : 'Not registered for GST. No GST charged.');
    setText('c-dn', has(get(tab, 'dep'))
      ? 'Deposit due: ' + money(round2(v.total * depositFraction(get(tab, 'dep')))) + ". Check your regulator's current deposit limit for building work before you ask for it."
      : "Deposits on building work are capped in most states, and the cap depends on the contract value. Larger jobs may also need a written contract and home warranty insurance; in Queensland the insurance premium is included in the quote. Check your regulator's current rules before you set a percentage.");
    const fee = has(get(tab, 'fee')) ? num(get(tab, 'fee')) : 0;
    setText('c-fn', fee
      ? 'Quote fee ' + money(fee) + ' is kept separate, so it is not added to the total above. ' + (get(tab, 'feec') === 'No' ? 'It is not credited back.' : 'If the customer goes ahead it is taken off: ' + money(leftToPay(v.total, fee)) + ' left to pay.')
      : 'Optional. A quote fee is kept separate from the quote total. If you are registered for GST, type the amount including GST and ask your accountant how to treat it.');
  }
  const pay = $('#c-pay1');
  if (pay) pay.innerHTML = payHtml(get(tab, 'no'));
  setText('c-terms', 'Payment due within ' + get('D', 'terms') + ' days of the invoice date.');
}

function variationLive() {
  const tab = 'Variation';
  const reg = registered();
  const n = lineCount(tab);
  const v = sumLines(linesOf(tab, n), reg, gstRate());
  const qt = quoteTotal();
  const orig = has(get(tab, 'orig')) ? num(get(tab, 'orig')) : qt;
  totalsRows(v, reg);
  showLineAmounts(tab, n);
  showDates(tab);
  setText('v3', money(v.total));
  setText('v4', money(variationNewTotal(orig, num(get(tab, 'prev')), v.total)));
  const e = $('#i-orig');
  if (e instanceof HTMLInputElement) e.placeholder = money(qt);
}

function rateLive() {
  const t = 'Rate Calculator';
  const r = rateCalc({
    wage: get(t, 'wage'), costs: get(t, 'costs'), weeks: get(t, 'weeks'), hrs: get(t, 'hrs'),
    part: get(t, 'part'), mk: get(t, 'mk'), registered: registered(), gstRate: gstRate(),
  });
  setText('c-need', money(r.need));
  setText('c-hy', r.hoursYear.toLocaleString('en-AU'));
  setText('rt', money(r.hourly));
  setText('c-rg', money(r.hourlyIncl));
  setText('c-sp', money(r.sell));
  setText('c-pf', money(r.profit));
  setText('c-mg', r.margin.toFixed(1) + '%');
}

function detailsLive() {
  const abn = get('D', 'abn');
  setText('abn-hint', has(abn) && !abnLooksValid(abn) ? 'This ABN does not look right. Check the 11 digits against the ABN Lookup site (abr.business.gov.au).' : '');
}

/** Update everything for the open tab. */
export function refresh(tab) {
  if (tab === 'Variation') variationLive();
  else if (tab === 'Rate Calculator') rateLive();
  else if (tab === 'My Details') detailsLive();
  else if (DOC_TABS.includes(tab)) documentLive(tab);
  runAll(hooks.refresh, tab);
  if (isDocTab(tab)) buildPaper(tab);
}
