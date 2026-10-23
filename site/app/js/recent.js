// @ts-check
// The last 3 saved quotes, and the last 3 saved variations. The Save button keeps a small copy here, newest first, and the oldest drops off.
import { setText } from './dom.js';
import { fmtDate, has } from './format.js';
import { get, put } from './state.js';

export const RECENT = 'Recent';
export const CURRENT = 'Current quote';
const MAX = 3;
/**
 * The documents that have a Save button: what each keeps, and what counts as worth keeping.
 * @type {Record<string, { slot: string, word: string, fields: string[], worth: string[], keeps: string, use: string, first: string }>}
 */
export const KINDS = {
  Quote: {
    slot: 'q',
    word: 'quote',
    fields: ['no', 'date', 'cust', 'phone', 'addr', 'site', 'scope'],
    worth: ['cust', 'no', 'scope', 'd1'],
    keeps: 'the name, number, date, phone, address, site and scope',
    use: ' The Job Completion Certificate and the SWMS can fill from them.',
    first: 'a customer name, a quote number or a job description',
  },
  Variation: {
    slot: 'v',
    word: 'variation',
    fields: ['no', 'date', 'qno', 'days', 'cust', 'site', 'why', 'whyo', 'desc', 'pay'],
    worth: ['cust', 'no', 'desc', 'd1'],
    keeps: 'the number, date, job number, extra days, client, site, reason, description and how it gets paid',
    use: ' Nothing fills from saved variations yet.',
    first: 'a client name, a variation number or a description of the change',
  },
};

/** One document as it is now, as a small copy. */
function now(/** @type {string} */ tab) {
  /** @type {Record<string, string>} */
  const q = {};
  for (const k of KINDS[tab].fields) q[k] = get(tab, k);
  return q;
}
const quoteNow = () => now('Quote');

/** The kept copies of one document (the quotes unless told otherwise), newest first. */
export function recents(/** @type {string} */ tab = 'Quote') {
  /** @type {Record<string, string>[]} */
  const out = [];
  for (let i = 1; i <= MAX; i++) {
    try {
      const q = JSON.parse(get(RECENT, KINDS[tab].slot + i) || 'null');
      if (q && typeof q === 'object') out.push(q);
    } catch {
      /* a damaged copy is skipped */
    }
  }
  return out;
}

/** Does this document have a Save button? */
export const saveable = (/** @type {string} */ tab) => tab in KINDS;

/** Is there anything on this document worth keeping? */
const worthKeeping = (/** @type {string} */ tab) => KINDS[tab].worth.some((k) => has(get(tab, k)));

/** A document is saved when one kept copy matches it in every kept field. */
export function isSaved(/** @type {string} */ tab) {
  const q = now(tab);
  return recents(tab).some((r) => KINDS[tab].fields.every((k) => (r[k] || '') === q[k]));
}

/** What the Clear box says. It warns when the document is not in the saved copies. */
export function clearText(/** @type {string} */ tab) {
  const w = KINDS[tab].word;
  return worthKeeping(tab) && !isSaved(tab)
    ? 'Clear without saving? This ' + w + ' is not in your saved ' + w + 's. Your business details stay.'
    : 'Clear this ' + w + '? Your business details stay.';
}

/** Keep a copy. An empty document is not kept, and the same one again replaces its old copy. */
export function archive(/** @type {string} */ tab) {
  const q = now(tab);
  if (!worthKeeping(tab)) return false;
  const list = [q, ...recents(tab).filter((r) => !(r.no === q.no && r.cust === q.cust))].slice(0, MAX);
  for (let i = 1; i <= MAX; i++) put(RECENT, KINDS[tab].slot + i, list[i - 1] ? JSON.stringify(list[i - 1]) : '');
  return true;
}

export const archiveQuote = () => archive('Quote');

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

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b || b.id !== 'dsave') return;
  const tab = b.dataset.tab || '';
  if (!saveable(tab)) return;
  setText('dsave-msg', archive(tab) ? 'Saved. You have ' + recents(tab).length + ' of ' + MAX + ' saved ' + KINDS[tab].word + 's.' : 'Nothing to save yet. Add ' + KINDS[tab].first + ' first.');
});
