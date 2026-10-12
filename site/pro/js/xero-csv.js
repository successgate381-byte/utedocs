// P4: turn a finished Tax Invoice into a CSV file for Xero's sales invoice import.
// Pure functions only (no page code), so the numbers and columns are easy to test.
import { sumLines } from '../../app/js/calc.js';
import { addDays, has, money, num } from '../../app/js/format.js';

/** Used when the person has not set their own. Xero's standard Sales account is 200. */
export const XERO_DEFAULTS = { xacct: '200', xtax: 'GST on Income', xfree: 'GST Free Income', xnone: 'BAS Excluded' };

/** Xero's sales invoice template columns, in Xero's order. A star means Xero requires it. */
export const XERO_COLUMNS = [
  '*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'Total', 'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', 'Discount',
  '*AccountCode', '*TaxType', 'TaxAmount', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency', 'BrandingTheme',
];

/** 2026-10-06 becomes 06/10/2026, the format Xero expects in Australia. */
function dmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

/** One CSV cell. Quotes anything with a comma, quote or new line. */
function cell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Stop a spreadsheet treating typed words as a formula (a leading equals, plus, minus or at sign). */
function safeText(v) {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

/**
 * @param {{ contact: string, address: string, site: string, number: string, issue: string, terms: string,
 *   lines: { d?: string, q?: string, p?: string, g?: string }[], account?: string, gstName?: string, freeName?: string,
 *   noneName?: string, mode?: string, registered?: boolean, gstRate?: number }} i
 * @returns {{ csv: string, missing: string[], rows: number }}
 */
export function buildXeroCsv(i) {
  const used = i.lines.filter((l) => has(l.q) && has(l.p));
  const { errors } = checkXero(i);
  if (errors.length) return { csv: '', missing: errors, rows: 0 };

  const account = has(i.account) ? String(i.account).trim() : XERO_DEFAULTS.xacct;
  const gstName = has(i.gstName) ? String(i.gstName).trim() : XERO_DEFAULTS.xtax;
  const freeName = has(i.freeName) ? String(i.freeName).trim() : XERO_DEFAULTS.xfree;
  const noneName = has(i.noneName) ? String(i.noneName).trim() : XERO_DEFAULTS.xnone;
  const due = dmy(addDays(i.issue, num(i.terms)));

  const rows = used.map((l, n) => {
    const r = Object.fromEntries(XERO_COLUMNS.map((c) => [c, '']));
    r['*ContactName'] = safeText(i.contact);
    r.POAddressLine1 = safeText(i.address);
    r['*InvoiceNumber'] = safeText(i.number);
    r.Reference = safeText(i.site);
    r['*InvoiceDate'] = dmy(i.issue);
    r['*DueDate'] = due;
    r['*Description'] = safeText(l.d) || 'Item ' + (n + 1);
    r['*Quantity'] = String(num(l.q));
    r['*UnitAmount'] = num(l.p).toFixed(2);
    r['*AccountCode'] = account;
    r['*TaxType'] = i.mode === 'plain' ? noneName : l.g === 'No' ? freeName : gstName;
    return XERO_COLUMNS.map((c) => cell(r[c])).join(',');
  });
  const csv = [XERO_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
  return { csv, missing: [], rows: rows.length };
}

/** A safe file name such as xero-invoice-INV-014.csv */
export function xeroFileName(number) {
  const clean = String(number || '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return 'xero-invoice-' + (clean || 'export') + '.csv';
}

const isNumber = (v) => /^-?\d+(\.\d+)?$/.test(String(v ?? '').replace(/[$,\s]/g, ''));
const pick = (v, fallback) => (has(v) ? String(v).trim() : fallback);

/**
 * The checks shown before the download. Errors stop the file. Warnings do not.
 * "reminders" are the things only Xero itself can check.
 * Takes the same input as buildXeroCsv.
 */
export function checkXero(i) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const plain = i.mode === 'plain';
  const lines = i.lines.map((l, n) => ({ ...l, n: n + 1 })).filter((l) => has(l.q) && has(l.p));
  const account = pick(i.account, XERO_DEFAULTS.xacct);
  const gstName = pick(i.gstName, XERO_DEFAULTS.xtax);
  const freeName = pick(i.freeName, XERO_DEFAULTS.xfree);
  const noneName = pick(i.noneName, XERO_DEFAULTS.xnone);

  if (has(i.contact)) ok.push('Customer name');
  else errors.push('customer name');
  if (!has(i.number)) errors.push('invoice number');
  else if (!/^[\x20-\x7E]+$/.test(String(i.number).trim())) errors.push('an invoice number using only normal keyboard characters');
  else ok.push('Invoice number');
  if (dmy(i.issue)) ok.push('Invoice date and due date, as DD/MM/YYYY');
  else errors.push('issue date');
  if (!lines.length) errors.push('at least one line with a quantity and price');
  else {
    const bad = lines.filter((l) => !isNumber(l.q) || !isNumber(l.p)).map((l) => l.n);
    if (bad.length) errors.push('numbers only in the quantity and price (line ' + bad.join(', ') + ')');
    else ok.push(lines.length + (lines.length === 1 ? ' line' : ' lines') + ' with a quantity and price');
  }

  const noDescription = lines.filter((l) => !has(l.d)).map((l) => l.n);
  if (noDescription.length) warnings.push('Line ' + noDescription.join(', ') + ' has no description. Xero needs one, so the file calls it Item and a number.');
  const odd = lines.filter((l) => isNumber(l.q) && isNumber(l.p) && (num(l.q) <= 0 || num(l.p) < 0)).map((l) => l.n);
  if (odd.length) warnings.push('Line ' + odd.join(', ') + ' has a zero or negative amount. Check that is right.');
  if (!plain && i.registered === false) warnings.push('My Details says you are not registered for GST, but this is a Tax Invoice. Use the Invoice tab, or fix My Details.');
  if (plain && i.registered === true) warnings.push('My Details says you are registered for GST, but this Invoice has no GST. Use the Tax Invoice tab for GST sales.');
  const usesFree = !plain && lines.some((l) => l.g === 'No');
  if (usesFree && gstName === freeName) warnings.push('Your GST tax name and your GST-free tax name are the same, so GST-free lines would be taxed. Fix them on My Details.');
  if (!plain && lines.length && lines.every((l) => isNumber(l.q) && isNumber(l.p))) {
    const rate = typeof i.gstRate === 'number' ? i.gstRate : 0.1;
    const sums = lines.map((l) => ({ q: l.q, p: l.p, g: l.g }));
    const whole = sumLines(sums, true, rate).gst;
    const eachLine = sums.reduce((total, l) => total + sumLines([l], true, rate).gst, 0);
    if (Math.abs(whole - eachLine) > 0.004) warnings.push('Xero may work out GST line by line. That gives ' + money(eachLine) + ' of GST, but your PDF shows ' + money(whole) + '. Check the total on the draft in Xero before you approve it.');
  }
  if (num(i.terms) < 0) warnings.push('Your payment terms are below zero, so the due date comes before the invoice date.');

  const taxNames = plain ? noneName : gstName + (usesFree ? ', ' + freeName : '');
  const reminders = [
    'The customer name must match the customer in Xero exactly, or Xero adds a second customer.',
    'Xero rejects an invoice number it already has.',
    'The account code (' + account + ') must be in your Xero chart of accounts.',
    'The tax name (' + taxNames + ') must match your Xero tax settings exactly.',
  ];
  return { errors, warnings, ok, reminders };
}
