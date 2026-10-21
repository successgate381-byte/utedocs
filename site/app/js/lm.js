// @ts-check
// Hourly rate and Cost plus: the Labour and Materials tables on the edit screen and on the finished document.
// Labour is hours x rate with no markup. Materials are cost x quantity plus the markup. GST is on the marked-up price.
import { setText } from './dom.js';
import { esc, has, money } from './format.js';
import { hooks } from './hooks.js';
import { MAX_LM, get, isLM, labourCount, lmRows, materialCount, put } from './state.js';
import { note, row, sec } from './views.js';

export const MARKUP_SHOWN = 'Show cost and markup';
export const MARKUP_HIDDEN = 'Show the final price only';

const input = (/** @type {string} */ tab, /** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ ph, /** @type {string} */ cls = '', /** @type {string} */ mode = '') =>
  `<input class="${cls}"${mode ? ` inputmode="${mode}"` : ''} placeholder="${ph}" aria-label="${label}" data-s="${tab}" data-k="${key}" autocomplete="off">`;

/** The edit screen's replacement for the plain line items. */
export function lmScreen(/** @type {string} */ tab) {
  let h = sec('LABOUR') + note('Hours times your hourly rate. Labour is charged at your rate, with no markup. The date is optional: type a day or a period.');
  for (let i = 1; i <= labourCount(tab); i++) {
    h += `<div class="lmr"><h4>Labour ${i}</h4>${input(tab, 'lt' + i, 'Labour date ' + i, 'Date or period (optional)')}${input(tab, 'ld' + i, 'Labour description ' + i, 'Description')}<div class="lm3">${input(tab, 'lh' + i, 'Hours ' + i, 'Hours', 'q', 'decimal')}${input(tab, 'lr' + i, 'Hourly rate ' + i, 'Hourly rate', 'p m', 'decimal')}<span class="amt" id="lm-l${i}"></span></div></div>`;
  }
  h += `<div class="btns tight"><button class="b g" id="lm-addl"${labourCount(tab) >= MAX_LM ? ' disabled' : ''}>+ Add labour</button><button class="b g" id="lm-rml"${labourCount(tab) <= 1 ? ' disabled' : ''}>Remove last labour row</button></div>`;
  h += `<div class="lm-sub"><span>Labour (ex GST)</span><b id="lm-lsub"></b></div>`;
  h += sec('MATERIALS') + note('The cost of each item, plus your markup. Each row uses the markup below unless you type its own. Quantity blank means 1.');
  h += row(tab, 'mk', 'Markup on materials (%)', 'n', { ex: 'Blank means no markup.' });
  h += row(tab, 'mkshow', "On the customer's copy", 's', { options: [MARKUP_SHOWN, MARKUP_HIDDEN] });
  for (let i = 1; i <= materialCount(tab); i++) {
    h += `<div class="lmr"><h4>Material ${i}</h4>${input(tab, 'md' + i, 'Material item ' + i, 'Item')}<div class="lm4">${input(tab, 'mq' + i, 'Quantity ' + i, 'Qty', 'q', 'decimal')}${input(tab, 'mc' + i, 'Cost each ' + i, 'Cost each', 'p m', 'decimal')}${input(tab, 'mm' + i, 'Markup percent ' + i, 'Markup %', 'q', 'decimal')}<span class="amt" id="lm-m${i}"></span></div></div>`;
  }
  h += `<div class="btns tight"><button class="b g" id="lm-addm"${materialCount(tab) >= MAX_LM ? ' disabled' : ''}>+ Add material</button><button class="b g" id="lm-rmm"${materialCount(tab) <= 1 ? ' disabled' : ''}>Remove last material row</button></div>`;
  h += `<div class="lm-sub"><span>Materials with markup (ex GST)</span><b id="lm-msub"></b></div>`;
  return h;
}

/** Amounts on the edit screen, kept up to date as you type. */
function lmLive(/** @type {string} */ tab) {
  if (!isLM(tab)) return;
  const { labour, mats } = lmRows(tab);
  labour.forEach((r, i) => setText('lm-l' + (i + 1), r.used ? money(r.total) : ''));
  mats.forEach((r, i) => setText('lm-m' + (i + 1), r.used ? money(r.total) : ''));
  setText('lm-lsub', money(labour.reduce((t, r) => t + r.total, 0)));
  setText('lm-msub', money(mats.reduce((t, r) => t + r.total, 0)));
}

const cents = (/** @type {number} */ x) => Math.round(x * 100) / 100;

/** The Labour table and the Materials table on the finished document. */
export function lmTables(/** @type {string} */ tab, /** @type {boolean} */ showGst) {
  const { labour, mats } = lmRows(tab);
  const ex = showGst ? ' (ex GST)' : '';
  const hide = get(tab, 'mkshow') === MARKUP_HIDDEN;
  const L = labour.filter((r) => r.used || has(r.d));
  const M = mats.filter((r) => r.used || has(r.d));
  let h = '';
  if (L.length) {
    const body = L.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.d)}</td><td class="n">${r.used ? esc(String(r.hours)) : ''}</td><td class="n">${r.used ? money(r.rate) : ''}</td><td class="n">${r.used ? money(r.total) : ''}</td></tr>`).join('');
    h += `<table class="lm"><thead><tr><th>Date</th><th>Labour</th><th class="n">Hours</th><th class="n">Rate${ex}</th><th class="n">Amount${ex}</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  if (M.length) {
    const body = M.map((r) => {
      const price = hide ? `<td class="n">${r.used ? money(cents(r.unit)) : ''}</td>` : `<td class="n">${r.used ? money(r.cost) : ''}</td><td class="n">${r.used ? String(+r.pct.toFixed(2)) + '%' : ''}</td>`;
      return `<tr><td>${esc(r.d)}</td><td class="n">${r.used ? esc(String(r.qty)) : ''}</td>${price}<td class="n">${r.used ? money(r.total) : ''}</td></tr>`;
    }).join('');
    const head = hide ? `<th class="n">Price each${ex}</th>` : `<th class="n">Cost each${ex}</th><th class="n">Markup</th>`;
    h += `<table class="lm"><thead><tr><th>Materials</th><th class="n">Qty</th>${head}<th class="n">Amount${ex}</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  return h;
}

/** The Labour and Materials lines at the top of the totals block. */
export function lmSubtotals(/** @type {string} */ tab, /** @type {(label: string, x: string, cls?: string) => string} */ tt, /** @type {string} */ ex) {
  const { labour, mats } = lmRows(tab);
  return tt('Labour' + ex, money(labour.reduce((t, r) => t + r.total, 0))) + tt('Materials' + ex, money(mats.reduce((t, r) => t + r.total, 0)));
}

function reopen() {
  const now = document.querySelector('nav [aria-selected="true"]');
  if (now instanceof HTMLElement) now.click();
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLSelectElement) || t.dataset.k !== 'ptype' || !t.dataset.s) return;
  put(t.dataset.s, 'ptype', t.value);
  reopen();
});

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  const now = document.querySelector('nav [aria-selected="true"]');
  const tab = now instanceof HTMLElement ? now.dataset.t : '';
  if (!b || !tab || !isLM(tab)) return;
  /** @type {Record<string, [string, number]>} */
  const map = { 'lm-addl': ['ln', labourCount(tab) + 1], 'lm-rml': ['ln', labourCount(tab) - 1], 'lm-addm': ['mn', materialCount(tab) + 1], 'lm-rmm': ['mn', materialCount(tab) - 1] };
  const hit = map[b.id];
  if (!hit) return;
  put(tab, hit[0], String(Math.min(MAX_LM, Math.max(1, hit[1]))));
  reopen();
});

hooks.lines.push((tab) => (isLM(tab) ? lmScreen(tab) : null));
hooks.refresh.push(lmLive);
