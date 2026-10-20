// @ts-check
// The last 3 quotes. Clearing the Quote tab keeps a small copy here, newest first, and the oldest drops off.
import { fmtDate, has } from './format.js';
import { get, put } from './state.js';

export const RECENT = 'Recent';
export const CURRENT = 'Current quote';
const MAX = 3;
const FIELDS = ['no', 'date', 'cust', 'phone', 'addr', 'site', 'scope'];

/** The Quote tab as it is now, as a small copy. */
function quoteNow() {
  /** @type {Record<string, string>} */
  const q = {};
  for (const k of FIELDS) q[k] = get('Quote', k);
  return q;
}

/** The kept quotes, newest first. */
export function recents() {
  /** @type {Record<string, string>[]} */
  const out = [];
  for (let i = 1; i <= MAX; i++) {
    try {
      const q = JSON.parse(get(RECENT, 'q' + i) || 'null');
      if (q && typeof q === 'object') out.push(q);
    } catch {
      /* a damaged copy is skipped */
    }
  }
  return out;
}

/** Keep a copy of the Quote tab. An empty quote is not kept, and the same quote again replaces its old copy. */
export function archiveQuote() {
  const q = quoteNow();
  if (!(has(q.cust) || has(q.no) || has(q.scope) || has(get('Quote', 'd1')))) return;
  const list = [q, ...recents().filter((r) => !(r.no === q.no && r.cust === q.cust))].slice(0, MAX);
  for (let i = 1; i <= MAX; i++) put(RECENT, 'q' + i, list[i - 1] ? JSON.stringify(list[i - 1]) : '');
}

const label = (/** @type {Record<string, string>} */ q, /** @type {number} */ i) => i + ') ' + [q.cust || 'No name', q.no || 'no number', fmtDate(q.date)].filter(Boolean).join(', ');

/** The choices for a "Fill from" box. */
export function sourceOptions() {
  return [CURRENT, ...recents().map((q, i) => label(q, i + 1))];
}

/** The quote the person chose, or the Quote tab when the choice is unknown. */
export function pickSource(/** @type {string} */ choice) {
  const all = recents();
  const i = all.findIndex((q, n) => label(q, n + 1) === choice);
  return i >= 0 ? all[i] : quoteNow();
}
