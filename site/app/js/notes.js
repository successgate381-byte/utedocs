// @ts-check
// Notes on documents. Saved notes are typed once in My Details. A document can also have notes of its own.
// Every word that prints here was typed by the tradie. The app writes none of it.
import { esc, has } from './format.js';
import { get, put } from './state.js';

export const MAX_SAVED = 8;
export const MAX_DOC = 3;
export const NOTE_MODES = ['Follow my saved setting', 'Print on this document', 'Leave off this document'];

const clamp = (/** @type {string} */ s, /** @type {number} */ max) => Math.max(0, Math.min(max, Math.round(Number(s)) || 0));
export const savedCount = () => clamp(get('D', 'nl_n'), MAX_SAVED);
export const docNoteCount = (/** @type {string} */ tab, /** @type {string} */ pre = '') => clamp(get(tab, pre + 'nx_n'), MAX_DOC);

/** The notes that print on one document: saved notes that are on, then the notes of this document. */
export function printedNotes(/** @type {string} */ tab, /** @type {string} */ pre = '') {
  const out = [];
  for (let i = 1; i <= savedCount(); i++) {
    const mode = get(tab, pre + 'nu' + i);
    const on = mode === NOTE_MODES[1] || (mode !== NOTE_MODES[2] && get('D', 'nl_p' + i) !== 'No');
    if (on && has(get('D', 'nl_b' + i))) out.push({ title: get('D', 'nl_t' + i), text: get('D', 'nl_b' + i) });
  }
  for (let i = 1; i <= docNoteCount(tab, pre); i++) {
    if (get(tab, pre + 'nx_p' + i) !== 'No' && has(get(tab, pre + 'nx_b' + i))) out.push({ title: get(tab, pre + 'nx_t' + i), text: get(tab, pre + 'nx_b' + i) });
  }
  return out;
}

/** Every box key the notes of one document use, so Clear can wipe them. */
export function noteKeys(/** @type {string} */ pre = '') {
  const k = [pre + 'nx_n'];
  for (let i = 1; i <= MAX_DOC; i++) k.push(pre + 'nx_t' + i, pre + 'nx_b' + i, pre + 'nx_p' + i);
  for (let i = 1; i <= MAX_SAVED; i++) k.push(pre + 'nu' + i);
  return k;
}

/** The NOTES block of a finished document, or '' when no note is switched on. */
export function notesPaper(/** @type {string} */ tab, /** @type {string} */ pre = '') {
  const list = printedNotes(tab, pre);
  if (list.length === 0) return '';
  return '<div class="sec">NOTES</div>' + list.map((n) => `<p>${has(n.title) ? '<b>' + esc(n.title.trim()) + ':</b> ' : ''}${esc(n.text).replace(/\n/g, '<br>')}</p>`).join('');
}

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b || !['nl-add', 'nl-rm', 'nt-add', 'nt-rm'].includes(b.id)) return;
  const step = b.id.endsWith('add') ? 1 : -1;
  const tab = b.id.startsWith('nl') ? 'My Details' : b.dataset.tab || '';
  const pre = b.dataset.pre || '';
  if (b.id.startsWith('nl')) put('D', 'nl_n', String(Math.max(0, Math.min(MAX_SAVED, savedCount() + step))));
  else put(tab, pre + 'nx_n', String(Math.max(0, Math.min(MAX_DOC, docNoteCount(tab, pre) + step))));
  const nav = document.querySelector(`#nav [data-t="${tab}"]`);
  if (nav instanceof HTMLElement) nav.click();
});
