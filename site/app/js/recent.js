// @ts-check
// The last 3 saved quotes, and the last 3 saved variations. The Save button keeps a small copy here, newest first, and the oldest drops off.
import { setText } from './dom.js';
import { esc, fmtDate, has } from './format.js';
import { get, put, restoreTab, snapshotTab } from './state.js';

export const RECENT = 'Recent';
export const CURRENT = 'Current quote';
const MAX = 3;
/** @typedef {{ [k: string]: any, _all?: Record<string, string> }} Copy */
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
  /** @type {Copy[]} */
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

/** The typed values of a document without empty boxes and without caring about key order, so two can be compared. */
const flat = (/** @type {Record<string, string>} */ o) => JSON.stringify(Object.entries(o).filter(([, v]) => v !== '').sort(([a], [b]) => (a < b ? -1 : 1)));

/** A document is saved when a kept copy matches everything typed on it. Older copies hold only the small details. */
export function isSaved(/** @type {string} */ tab) {
  const q = now(tab);
  const all = flat(snapshotTab(tab));
  return recents(tab).some((r) => (r._all ? flat(r._all) === all : KINDS[tab].fields.every((k) => (r[k] || '') === q[k])));
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
  /** @type {Copy} */
  const q = { ...now(tab), _all: snapshotTab(tab) };
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

/** The saved copies as rows with an Open button. Older copies hold only details, so they cannot be reopened. */
export function savedHtml(/** @type {string} */ tab) {
  const rows = recents(tab).map((q, i) => `<div class="sv"><span>${esc(label(q, i + 1))}${q._all ? '' : ' (details only)'}</span><button class="b g" id="dopen${i + 1}" data-tab="${tab}" data-n="${i + 1}"${q._all ? '' : ' disabled'}>Open</button></div>`);
  return rows.length ? rows.join('') : '<div class="note">Nothing saved yet.</div>';
}

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b || b.id !== 'dsave') return;
  const tab = b.dataset.tab || '';
  if (!saveable(tab)) return;
  const ok = archive(tab);
  const box = document.getElementById('dsaved');
  if (box) box.innerHTML = savedHtml(tab);
  setText('dsave-msg', ok ? 'Saved. You have ' + recents(tab).length + ' of ' + MAX + ' saved ' + KINDS[tab].word + 's.' : 'Nothing to save yet. Add ' + KINDS[tab].first + ' first.');
});

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b || !b.id.startsWith('dopen')) return;
  const tab = b.dataset.tab || '';
  const copy = saveable(tab) ? recents(tab)[Number(b.dataset.n) - 1] : undefined;
  if (!copy || !copy._all) return;
  const w = KINDS[tab].word;
  if (worthKeeping(tab) && !isSaved(tab) && !confirm('Open this ' + w + '? What is on the ' + w + ' screen now is not saved, and opening replaces it.')) return;
  restoreTab(tab, copy._all);
  const nav = document.querySelector(`#nav [data-t="${tab}"]`);
  if (nav instanceof HTMLElement) nav.click();
  setText('dsave-msg', 'Opened the saved ' + w + ' for ' + (copy.cust || 'no name') + '.');
});
