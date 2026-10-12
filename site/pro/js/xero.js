// P4: the Export for Xero button on the Tax Invoice tab, and the three Xero settings on My Details.
import { $ } from '../../app/js/dom.js';
import { esc, has } from '../../app/js/format.js';
import { get, gstRate, linesOf, registered } from '../../app/js/state.js';
import { row, sec } from '../../app/js/views.js';
import { XERO_DEFAULTS, buildXeroCsv, checkXero, xeroFileName } from './xero-csv.js';

const XERO_TABS = ['Tax Invoice', 'Invoice'];

/** What the person typed, or Xero's usual value. */
const setting = (key) => (has(get('D', key)) ? get('D', key).trim() : XERO_DEFAULTS[key]);

/** Everything the file and the check need, read from what is typed right now. */
function readDoc(/** @type {string} */ tab) {
  return {
    mode: tab === 'Invoice' ? 'plain' : 'tax',
    contact: get(tab, 'cust'),
    address: get(tab, 'addr'),
    site: get(tab, 'site'),
    number: get(tab, 'no'),
    issue: get(tab, 'date'),
    terms: get('D', 'terms'),
    lines: linesOf(tab),
    account: setting('xacct'),
    gstName: setting('xtax'),
    freeName: setting('xfree'),
    noneName: setting('xnone'),
    registered: registered(),
    gstRate: gstRate(),
  };
}

/** The live checklist above the export button. */
export function updateXeroCheck(/** @type {string} */ tab) {
  const box = $('#xe-check');
  if (!box || !XERO_TABS.includes(tab)) return;
  const c = checkXero(readDoc(tab));
  const many = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const state = c.errors.length ? 'bad' : c.warnings.length ? 'warn' : 'ok';
  const status = c.errors.length ? 'Fix ' + many(c.errors.length, 'thing') : c.warnings.length ? 'Ready, with ' + many(c.warnings.length, 'warning') : 'Ready for Xero';
  const item = (cls, word, text) => `<li class="${cls}"><b>${word}</b> ${esc(text)}</li>`;
  box.innerHTML =
    `<div class="xe-h"><span>XERO CHECK</span><b class="xe-st ${state}">${status}</b></div><ul>` +
    c.errors.map((t) => item('bad', 'Fix:', t)).join('') +
    c.warnings.map((t) => item('warn', 'Check:', t)).join('') +
    c.ok.map((t) => item('ok', 'OK:', t)).join('') +
    '</ul><div class="xe-only"><b>Only Xero can check these:</b><ul>' +
    c.reminders.map((t) => `<li>${esc(t)}</li>`).join('') +
    '</ul></div>';
}

/** Save a text file on the phone or computer. */
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Three boxes on My Details, just after the GST rate. */
function mountSettings() {
  const rate = $('#i-rate');
  const after = rate ? rate.closest('.fr') : null;
  if (!after) return;
  after.insertAdjacentHTML(
    'afterend',
    sec('XERO EXPORT (PRO, OPTIONAL)') +
      row('D', 'xacct', 'Xero sales account code', 't', { ex: "The code of your sales account in Xero, as shown in your chart of accounts. 200 is Xero's standard Sales account." }) +
      row('D', 'xtax', 'Xero tax name for GST sales', 't', { ex: 'Must match the name in your Xero tax settings exactly, for example GST on Income.' }) +
      row('D', 'xfree', 'Xero tax name for GST-free sales', 't', { ex: 'Must match the name in your Xero tax settings exactly, for example GST Free Income.' }) +
      row('D', 'xnone', 'Xero tax name when GST does not apply', 't', { ex: 'Used on the plain Invoice tab, for businesses not registered for GST. Many Australian bookkeepers use BAS Excluded. Check the exact name in your Xero tax settings.' }),
  );
  for (const key of Object.keys(XERO_DEFAULTS)) {
    const box = $('#i-' + key);
    if (box instanceof HTMLInputElement) box.value = setting(key);
  }
}

/** The export button, under Preview and Save as PDF. */
function mountButton(/** @type {string} */ tab) {
  const bar = $('#pv') ? $('#pv').closest('.btns') : null;
  if (!bar) return;
  bar.insertAdjacentHTML(
    'afterend',
    '<div class="xe"><div class="xe-check" id="xe-check" aria-live="polite"></div><div class="btns tight"><button class="b g" id="xe-csv">Export for Xero (CSV)</button></div>' +
      '<div class="warn" id="xe-msg"></div>' +
      '<div class="note">This file is for your own Xero, not for your customer. The customer still gets the PDF. In Xero, go to Business, then Invoices, then Import. The invoice arrives as a draft for you to check and approve.</div></div>',
  );
  const button = $('#xe-csv');
  const message = $('#xe-msg');
  if (!button || !message) return;
  button.addEventListener('click', () => {
    const out = buildXeroCsv(readDoc(tab));
    if (out.missing.length) {
      message.textContent = 'Xero needs: ' + out.missing.join(', ') + '.';
      return;
    }
    message.textContent = '';
    download(out.csv, xeroFileName(get(tab, 'no')));
  });
  updateXeroCheck(tab);
}

export function mountXero(/** @type {string} */ tab) {
  if (tab === 'My Details') mountSettings();
  if (XERO_TABS.includes(tab)) mountButton(tab);
}
