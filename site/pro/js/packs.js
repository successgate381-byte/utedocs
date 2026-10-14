// P6: the Starter pack box on the Quote tab. Pick a job type and it fills the empty boxes with starter words.
// It never replaces anything the person already typed, and it never fills in a price.
import { $, setText } from '../../app/js/dom.js';
import { esc } from '../../app/js/format.js';
import { get, lineCount, put } from '../../app/js/state.js';
import { sec } from '../../app/js/views.js';
import { fillPlan, hasPlaceholder, packsFor } from './packs-data.js';

const TAB = 'Quote';
const WARNING = 'Replace the words in [square brackets] before you send this quote.';

let lastMessage = '';
let lastPick = '';

const joinWords = (/** @type {string[]} */ words) => (words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0] || '');

/** Say what happened, in plain words. */
function describe(plan) {
  const parts = [];
  const added = plan.linesAdded + (plan.linesAdded === 1 ? ' line' : ' lines');
  if (!plan.filled.length && !plan.linesAdded) parts.push('Nothing to fill: those boxes and lines already have words in them.');
  else {
    if (plan.filled.length) parts.push('Filled ' + joinWords(plan.filled) + (plan.linesAdded ? ' and ' + added : '') + '.');
    else parts.push('Added ' + added + '.');
    if (plan.kept.length) parts.push('Left as you typed: ' + joinWords(plan.kept) + '.');
  }
  if (plan.linesSkipped) parts.push(plan.linesSkipped + ' suggested ' + (plan.linesSkipped === 1 ? 'line' : 'lines') + ' did not fit. Tap + Add a line, then pick it from the Description box.');
  parts.push('Now add your quantities and prices, and replace any words in [square brackets].');
  return parts.join(' ');
}

/** The warning about leftover [brackets], under the pack box. */
export function updatePackWarn(/** @type {string} */ tab) {
  if (tab !== TAB) return;
  setText('pk-warn', hasPlaceholder([get(TAB, 'scope'), get(TAB, 'incl'), get(TAB, 'excl')].join(' ')) ? WARNING : '');
}

/** On the screen preview only (never printed), flag a quote that still has [brackets] in it. */
export function bracketFlag(/** @type {string} */ html, /** @type {string} */ tab) {
  if (tab !== TAB || !hasPlaceholder([get(TAB, 'scope'), get(TAB, 'incl'), get(TAB, 'excl')].join(' '))) return html;
  return `<div class="pk-flag">${WARNING} This note is not printed.</div>` + html;
}

export function mountPacks(/** @type {string} */ tab) {
  if (tab !== TAB) return;
  const scope = $('#i-scope');
  const anchor = scope ? scope.closest('.fr') : null;
  if (!anchor) return;
  const trade = get('D', 'trade');
  const packs = packsFor(trade);
  const off = packs.length ? '' : ' disabled';
  const options = packs.length
    ? '<option value="">Choose a job type...</option>' + packs.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')
    : '<option value="">No packs for this trade</option>';
  anchor.insertAdjacentHTML(
    'beforebegin',
    sec('STARTER PACK (PRO)') +
      `<div class="fr"><label for="pk-pick">Job type</label><select id="pk-pick"${off}>${options}</select></div>` +
      `<div class="btns tight"><button class="b g" id="pk-fill"${off}>Fill empty boxes</button></div>` +
      '<div class="note" id="pk-msg"></div><div class="warn" id="pk-warn"></div>',
  );
  const pick = $('#pk-pick');
  const fill = $('#pk-fill');
  if (!(pick instanceof HTMLSelectElement) || !fill) return;
  if (packs.some((p) => p.id === lastPick)) pick.value = lastPick;
  setText(
    'pk-msg',
    lastMessage ||
      (packs.length
        ? 'Pick a job type and tap the button. It fills only the boxes that are empty. You can edit everything, and no prices are filled in.'
        : 'Starter packs are for Electrician and Plumber. Change "Your trade" on My Details to use them.'),
  );
  updatePackWarn(tab);
  fill.addEventListener('click', async () => {
    const pack = packs.find((p) => p.id === pick.value);
    if (!pack) {
      setText('pk-msg', 'Choose a job type first.');
      return;
    }
    const rows = lineCount(TAB);
    /** @type {Record<string, any>} */
    const cur = { scope: get(TAB, 'scope'), incl: get(TAB, 'incl'), excl: get(TAB, 'excl'), rows };
    for (let i = 1; i <= rows; i++) for (const c of ['d', 'q', 'p']) cur[c + i] = get(TAB, c + i);
    const plan = fillPlan(pack, cur);
    for (const [key, value] of Object.entries(plan.set)) put(TAB, key, value);
    lastMessage = describe(plan);
    lastPick = pack.id;
    const y = scrollY;
    const { go } = await import('../../app/js/main.js');
    go(TAB);
    scrollTo(0, y);
  });
}
