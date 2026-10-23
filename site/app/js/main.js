// Starts the app: draws the open tab, fills the boxes and listens for typing and taps.
import { LISTS } from './data.js';
import { allTabs, hooks, isDocTab, runAll } from './hooks.js';
import { $, $$ } from './dom.js';
import { esc, formatAbn, formatBsb, has, money, num } from './format.js';
import { refresh } from './live.js';
import { changeLines, clearTab, get, load, put, view } from './state.js';
import { renderTab } from './views.js';
import { initTheme } from './theme.js';
import './forms.js';
import './lm.js';
import { clearText, saveable } from './recent.js';
import './forms-swms.js';
import './notes.js';

initTheme();

/** @typedef {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} Box */

/** @returns {Box | null} */
function asBox(t) {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement ? t : null;
}

/** Make a text area as tall as its words. */
function grow(/** @type {HTMLTextAreaElement} */ e) {
  e.style.height = 'auto';
  e.style.height = e.scrollHeight + 'px';
}

/** Tidy the way a box shows its value: $1,350.00, 51 824 753 556, 062-000. */
function tidy(/** @type {Box} */ e) {
  if (!has(e.value)) return;
  if (e.classList.contains('m')) e.value = money(num(e.value));
  if (e.classList.contains('abn')) e.value = formatAbn(e.value);
  if (e.classList.contains('bsb')) e.value = formatBsb(e.value);
}

function fill() {
  $$('[data-k]').forEach((el) => {
    const e = asBox(el);
    if (!e) return;
    const v = get(e.dataset.s || '', e.dataset.k || '');
    if (v !== '') e.value = v;
    else if (e instanceof HTMLSelectElement && /^g\d+$/.test(e.dataset.k || '')) e.value = 'Yes';
    tidy(e);
    if (e instanceof HTMLTextAreaElement) grow(e);
  });
}

/** Show the "Other" boxes only when "Other" is picked. */
function vis() {
  const a = $('#w-tradeo');
  const b = $('#w-whyo');
  if (a) a.hidden = get('D', 'trade') !== 'Other';
  if (b) b.hidden = get('Variation', 'why') !== 'Other';
}

function setList() {
  const dl = $('#dl');
  if (dl) dl.innerHTML = (LISTS[get('D', 'trade')] || LISTS.Electrician).map((x) => `<option value="${esc(x)}">`).join('');
}

export function go(/** @type {string} */ tab) {
  view.tab = tab;
  const isDoc = isDocTab(tab);
  document.body.classList.remove('pv');
  document.body.classList.toggle('hasp', isDoc);
  const nav = $('#nav');
  const main = $('#m');
  if (!nav || !main) return;
  nav.innerHTML = allTabs().map((x) => `<button role="tab" aria-selected="${x === tab}" data-t="${x}">${x}</button>`).join('');
  main.innerHTML = renderTab(tab) + (isDoc ? '<div class="pbar"><button class="b g" id="bk">Back to editing</button><button class="b o" id="pdf2">Save as PDF</button></div><div id="paper"></div>' : '');
  fill();
  vis();
  setList();
  refresh(tab);
  runAll(hooks.afterRender, tab);
  scrollTo(0, 0);
}

function onEdit(/** @type {Event} */ ev) {
  const t = asBox(ev.target);
  if (!t || !t.dataset.k) return;
  put(t.dataset.s || '', t.dataset.k, t.value);
  if (t instanceof HTMLTextAreaElement) grow(t);
  if (t.dataset.k === 'trade') setList();
  vis();
  refresh(view.tab);
}

function onFocusIn(/** @type {Event} */ ev) {
  const t = asBox(ev.target);
  if (t && t.classList.contains('m') && has(t.value)) {
    t.value = String(num(t.value) || '');
    if (t instanceof HTMLInputElement) t.select();
  }
}

function onFocusOut(/** @type {Event} */ ev) {
  const t = asBox(ev.target);
  if (!t || !t.dataset.k) return;
  if (t.classList.contains('m') || t.classList.contains('abn') || t.classList.contains('bsb')) {
    tidy(t);
    put(t.dataset.s || '', t.dataset.k, t.value);
    refresh(view.tab);
  }
}

function onClick(/** @type {Event} */ ev) {
  const t = ev.target instanceof HTMLElement ? ev.target.closest('button') : null;
  if (!t) return;
  const tab = view.tab;
  runAll(hooks.click, t, tab);
  if (t.dataset.t) go(t.dataset.t);
  if (t.id === 'pv') {
    document.body.classList.add('pv');
    scrollTo(0, 0);
  }
  if (t.id === 'bk') document.body.classList.remove('pv');
  if (t.id === 'addl' || t.id === 'rml') {
    const y = scrollY;
    changeLines(tab, t.id === 'addl' ? 1 : -1);
    go(tab);
    scrollTo(0, y);
    const last = $$('.ln .d').pop();
    if (t.id === 'addl' && last) last.focus();
  }
  if (t.id === 'pdf' || t.id === 'pdf2') {
    const old = document.title;
    document.title = `${tab} ${get(tab, 'no')} ${get('D', 'name')}`.replace(/\s+/g, ' ').trim();
    window.print();
    document.title = old;
  }
  if (t.id === 'clr' && confirm(saveable(tab) ? clearText(tab) : 'Clear this document? Your business details stay.')) {
    clearTab(tab);
    go(tab);
  }
}

load();
document.addEventListener('input', onEdit);
document.addEventListener('change', onEdit);
document.addEventListener('focusin', onFocusIn);
document.addEventListener('focusout', onFocusOut);
document.addEventListener('click', onClick);
go('Start Here');
