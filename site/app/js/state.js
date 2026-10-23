// Everything the person types is kept here and saved in this browser only.
import { DEFAULTS } from './data.js';
import { has, num } from './format.js';

const KEY = 'utedocs.v1';

/** @type {{ D: Record<string, string>, T: Record<string, Record<string, string>> }} */
const data = { D: { ...DEFAULTS.D }, T: {} };

/** Which tab is open. */
export const view = { tab: 'Start Here' };

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    data.D = { ...DEFAULTS.D, ...(saved.D || {}) };
    data.T = saved.T || {};
  } catch {
    data.D = { ...DEFAULTS.D };
    data.T = {};
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be full or blocked (private mode). The app still works for this visit.
  }
}

/** Read one value. Scope is "D" for My Details or a tab name. Falls back to the starting value. */
export function get(scope, key) {
  const v = scope === 'D' ? data.D[key] : (data.T[scope] || {})[key];
  if (v !== undefined) return v;
  return (DEFAULTS[scope] || {})[key] ?? '';
}

export function put(scope, key, value) {
  if (scope === 'D') data.D[key] = value;
  else (data.T[scope] = data.T[scope] || {})[key] = value;
  save();
}

/** Wipe one document. My Details stay. */
export function clearTab(tab) {
  data.T[tab] = {};
  save();
}

/** A copy of everything typed on one document. */
export function snapshotTab(tab) {
  return { ...(data.T[tab] || {}) };
}

/** Put a copy back as the whole document, replacing what is there. */
export function restoreTab(tab, values) {
  data.T[tab] = { ...values };
  save();
}

export const registered = () => get('D', 'gst') === 'Yes';
export const gstRate = () => (num(get('D', 'rate')) || 10) / 100;

/** Name of the trade to show, using the typed one when "Other" is picked. */
export function tradeName() {
  const t = get('D', 'trade');
  return t === 'Other' && has(get('D', 'tradeo')) ? get('D', 'tradeo') : t;
}

export const minLines = (tab) => (tab === 'Variation' ? 4 : 8);
export const MAX_LINES = 40;

/** How many line rows a document shows: at least the minimum, at most 40. */
export function lineCount(tab) {
  return Math.min(MAX_LINES, Math.max(minLines(tab), parseInt(get(tab, 'n'), 10) || 0));
}

/* ---------- Hourly rate and Cost plus: labour rows and materials rows ---------- */
export const MAX_LM = 15;
/** Documents priced by the hour, or at cost plus, keep labour rows and materials rows. */
export const isLM = (tab) => /^(Hourly|Cost plus)/.test(get(tab, 'ptype') || '');
const rowsFor = (tab, key) => Math.min(MAX_LM, Math.max(1, parseInt(get(tab, key), 10) || 3));
export const labourCount = (tab) => rowsFor(tab, 'ln');
export const materialCount = (tab) => rowsFor(tab, 'mn');
const nz = (x) => {
  const v = parseFloat(String(x ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(v) ? v : 0;
};
const cents = (x) => Math.round(x * 100) / 100;

/** The labour and materials rows with their amounts. Labour has no markup. Materials are cost times quantity, plus the markup. */
export function lmRows(tab) {
  const fallback = nz(get(tab, 'mk'));
  const labour = Array.from({ length: labourCount(tab) }, (_, i) => {
    const k = i + 1;
    const used = get(tab, 'lh' + k) !== '' && get(tab, 'lr' + k) !== '';
    const hours = nz(get(tab, 'lh' + k));
    const rate = nz(get(tab, 'lr' + k));
    return { date: get(tab, 'lt' + k), d: get(tab, 'ld' + k), hours, rate, used, total: used ? cents(hours * rate) : 0 };
  });
  const mats = Array.from({ length: materialCount(tab) }, (_, i) => {
    const k = i + 1;
    const used = get(tab, 'mc' + k) !== '';
    const qty = get(tab, 'mq' + k) === '' ? 1 : nz(get(tab, 'mq' + k));
    const cost = nz(get(tab, 'mc' + k));
    const pct = get(tab, 'mm' + k) === '' ? fallback : nz(get(tab, 'mm' + k));
    const unit = cost * (1 + pct / 100);
    return { d: get(tab, 'md' + k), qty, cost, pct, unit, used, total: used ? cents(qty * unit) : 0 };
  });
  return { labour, mats };
}

/** The same rows as plain lines (description, quantity, price, GST), all taxable. */
export function lmLines(tab) {
  const { labour, mats } = lmRows(tab);
  return [
    ...labour.map((r) => ({ d: r.d, q: r.used ? String(r.hours) : '', p: r.used ? String(r.rate) : '', g: 'Yes' })),
    ...mats.map((r) => ({ d: r.d, q: r.used ? String(r.qty) : '', p: r.used ? String(+r.unit.toFixed(6)) : '', g: 'Yes' })),
  ];
}

/** The lines of a document as plain objects. */
export function linesOf(tab, count = lineCount(tab)) {
  if (isLM(tab)) return lmLines(tab);
  return Array.from({ length: count }, (_, i) => ({
    d: get(tab, 'd' + (i + 1)),
    q: get(tab, 'q' + (i + 1)),
    p: get(tab, 'p' + (i + 1)),
    g: get(tab, 'g' + (i + 1)) || 'Yes',
  }));
}

/** Add one more line, or take the last one away (never below the minimum). */
export function changeLines(tab, delta) {
  const n = lineCount(tab);
  const t = (data.T[tab] = data.T[tab] || {});
  if (delta > 0 && n < MAX_LINES) t.n = String(n + 1);
  if (delta < 0 && n > minLines(tab)) {
    for (const c of ['d', 'q', 'p', 'g']) delete t[c + n];
    t.n = String(n - 1);
  }
  save();
}
