// @ts-check
// The SWMS starter layout for the Forms tab. The high-risk list is the 18 activities on the SafeWork SA page, checked 18 Oct 2026.
import { setText } from './dom.js';
import { esc, fmtDate, has } from './format.js';
import { FORMS, FORMS_TAB, actions, datesLive, getMessage, lines, say } from './forms.js';
import { buildPaper, letterhead, paperFoot } from './paper.js';
import { pickSource } from './recent.js';
import { get, put } from './state.js';
import { note, row, sec } from './views.js';
import { sourceOptions } from './recent.js';

const T = FORMS_TAB;
const MIN_STEPS = 3;
const MAX_STEPS = 12;
const RISK = ['Choose', 'Low', 'Medium', 'High'];

const HRCW = [
  'Risk of a person falling more than 2 metres',
  'On a telecommunication tower',
  'Demolishing a load-bearing or structural element',
  'Disturbing asbestos',
  'Structural alterations or repairs that need temporary support',
  'In or near a confined space',
  'In or near a shaft or trench deeper than 1.5 metres, or a tunnel',
  'Using explosives',
  'On or near pressurised gas mains or piping',
  'On or near chemical, fuel or refrigerant lines',
  'On or near energised electrical installations or services',
  'In an area that may have a contaminated or flammable atmosphere',
  'Tilt-up or precast concrete',
  'On, in or next to a road, railway or other traffic corridor in use',
  'In an area where powered mobile plant moves',
  'In an area with artificial extremes of temperature',
  'In or near water or liquid with a risk of drowning',
  'Diving work',
];
const PPE = ['Hard hat', 'Safety glasses', 'Hearing protection', 'Gloves', 'Safety boots', 'Hi-vis clothing', 'Respirator or dust mask', 'Harness'];

const steps = () => Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.round(Number(get(T, 'sw_n')) || 4)));
const on = (/** @type {string} */ k) => get(T, k) === '1';
const risk = (/** @type {string} */ v) => (v === 'Choose' ? '' : v);

function keys() {
  const k = ['sw_n', 'sw_prin', 'sw_site', 'sw_date', 'sw_by', 'sw_desc', 'sw_hx', 'sw_hxt', 'sw_px', 'sw_pxt', 'sw_fa', 'sw_hos', 'sw_ec', 'sw_addr', 'sw_rep', 'sw_workers', 'sw_signed', 'sw_mon', 'sw_rev', 'sw_revd'];
  HRCW.forEach((_t, i) => k.push('sw_h' + (i + 1)));
  PPE.forEach((_t, i) => k.push('sw_p' + (i + 1)));
  for (let i = 1; i <= MAX_STEPS; i++) k.push('sw_t' + i, 'sw_z' + i, 'sw_rb' + i, 'sw_c' + i, 'sw_ra' + i, 'sw_w' + i);
  return k;
}

const tick = (/** @type {string} */ key, /** @type {string} */ label) =>
  `<label class="fm-ck"><input type="checkbox" data-fmk="${key}"${on(key) ? ' checked' : ''}><span>${esc(label)}</span></label>`;

function stepCards() {
  let h = '';
  for (let i = 1; i <= steps(); i++) {
    h += `<div class="fm-step"><h4>Step ${i}</h4>${row(T, 'sw_t' + i, 'Task', 'a')}${row(T, 'sw_z' + i, 'Hazard', 'a')}${row(T, 'sw_rb' + i, 'Risk before controls', 's', { options: RISK })}${row(T, 'sw_c' + i, 'Control measures', 'a')}${row(T, 'sw_ra' + i, 'Risk after controls', 's', { options: RISK })}${row(T, 'sw_w' + i, 'Who is responsible', 't')}</div>`;
  }
  return h;
}

function swmsScreen() {
  return `${note('A starter layout for a safe work method statement (SWMS). A generic SWMS is not acceptable until it is made site-specific. Talk it through with the people doing the work, then fill it in for this job.', 'navy')}
${sec('THE JOB')}
${row(T, 'sw_prin', 'Principal contractor (if any)', 't')}
${row(T, 'sw_site', 'Site address', 't')}
${row(T, 'sw_date', 'Date the work starts', 'd')}
${row(T, 'sw_by', 'Prepared by', 't')}
${row(T, 'sw_desc', 'Description of the work', 'a')}
${sec('1. HIGH-RISK CONSTRUCTION WORK IN THIS JOB')}
${note('Tick every one that applies. These are the 18 activities listed by SafeWork SA (checked 18 Oct 2026). Rules can change and differ by state, so check your regulator.')}
${HRCW.map((t, i) => tick('sw_h' + (i + 1), t)).join('')}
${tick('sw_hx', 'Other')}
${row(T, 'sw_hxt', 'If other, what', 't')}
${sec('2. TASK STEPS, HAZARDS AND CONTROLS')}
${note('Example only: Step 1, unload materials. Hazard: back strain from lifting. Risk before: Medium. Control: use a trolley and lift heavy items as a team. Risk after: Low. Responsible: the leading hand.')}
${stepCards()}
<div class="btns"><button class="b g" id="fm-addstep"${steps() >= MAX_STEPS ? ' disabled' : ''}>+ Add a step</button><button class="b g" id="fm-rmstep"${steps() <= MIN_STEPS ? ' disabled' : ''}>Remove the last step</button></div>
${sec('3. PERSONAL PROTECTIVE EQUIPMENT')}
${PPE.map((t, i) => tick('sw_p' + (i + 1), t)).join('')}
${tick('sw_px', 'Other')}
${row(T, 'sw_pxt', 'If other, what', 't')}
${sec('4. EMERGENCY DETAILS')}
${row(T, 'sw_fa', 'First aid kit location', 't')}
${row(T, 'sw_hos', 'Nearest hospital', 't')}
${row(T, 'sw_ec', 'Emergency contact (name and phone)', 't')}
${row(T, 'sw_addr', 'Site address for an ambulance', 't')}
${row(T, 'sw_rep', 'How incidents are reported', 't')}
${sec('5. WORKERS CONSULTED')}
${row(T, 'sw_workers', 'Names of the workers consulted', 'a', { ex: 'One name per line. They sign on the printed page.' })}
${row(T, 'sw_signed', 'Date the workers signed', 'd', { ex: 'Leave blank to write it by hand.' })}
${sec('6. MONITORING AND REVIEW')}
${row(T, 'sw_mon', 'Who checks the controls are working, and how often', 'a')}
${row(T, 'sw_rev', 'Reviewed by', 't')}
${row(T, 'sw_revd', 'Review date and any changes', 't')}
${row(T, 'fm_src', 'Fill from which quote', 's', { options: sourceOptions(), ex: 'The current quote, or one of your last 3.' })}
<div class="note" id="fm-msg"></div>
${actions('<button class="b" id="fm-fill">Fill from the quote chosen above</button>')}`;
}

function swmsLive() {
  setText('fm-msg', getMessage());
  datesLive();
}

function swmsPaper() {
  const g = (/** @type {string} */ k) => get(T, k);
  const kv = (/** @type {string} */ label, /** @type {string} */ x) => (has(x) ? `<p><b>${label}:</b> ${lines(x)}</p>` : '');
  const kl = (/** @type {string} */ label, /** @type {string} */ x) => `<p class="fm-line"><b>${label}:</b> ${lines(x)}</p>`;
  const bx = (/** @type {boolean} */ ticked, /** @type {string} */ text) => `<div class="ckr"><span class="bx${ticked ? ' on' : ''}"></span><span>${esc(text)}</span></div>`;
  const checks = (/** @type {string[]} */ list, /** @type {string} */ pre, /** @type {string} */ otherKey, /** @type {string} */ otherText) =>
    `<div class="ck">${list.map((t, i) => bx(on(pre + (i + 1)), t)).join('')}${bx(on(otherKey), 'Other' + (has(otherText) ? ': ' + otherText : ''))}</div>`;
  let h = letterhead('SAFE WORK METHOD STATEMENT', [['Date', fmtDate(g('sw_date'))]]);
  h += kv('Principal contractor', g('sw_prin')) + kv('Site address', g('sw_site')) + kv('Prepared by', g('sw_by')) + kv('Description of the work', g('sw_desc'));
  h += '<div class="sec">1. HIGH-RISK CONSTRUCTION WORK IN THIS JOB</div>' + checks(HRCW, 'sw_h', 'sw_hx', g('sw_hxt'));
  let body = '';
  for (let i = 1; i <= steps(); i++) {
    body += `<tr><td class="n">${i}</td><td>${lines(g('sw_t' + i))}</td><td>${lines(g('sw_z' + i))}</td><td>${esc(risk(g('sw_rb' + i)))}</td><td>${lines(g('sw_c' + i))}</td><td>${esc(risk(g('sw_ra' + i)))}</td><td>${lines(g('sw_w' + i))}</td></tr>`;
  }
  h += `<div class="sec">2. TASK STEPS, HAZARDS AND CONTROLS</div><table class="swt"><thead><tr><th class="n">#</th><th>Task</th><th>Hazard</th><th>Risk before</th><th>Control measures</th><th>Risk after</th><th>Who</th></tr></thead><tbody>${body}</tbody></table>`;
  h += '<div class="sec">3. PERSONAL PROTECTIVE EQUIPMENT</div>' + checks(PPE, 'sw_p', 'sw_px', g('sw_pxt'));
  h += '<div class="sec">4. EMERGENCY DETAILS</div>' + kl('First aid kit', g('sw_fa')) + kl('Nearest hospital', g('sw_hos')) + kl('Emergency contact', g('sw_ec')) + kl('Site address for an ambulance', g('sw_addr')) + kl('Incidents are reported', g('sw_rep'));
  const names = g('sw_workers').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, MAX_STEPS);
  let who = '';
  for (let i = 0; i < Math.max(4, names.length); i++) who += `<tr><td>${esc(names[i] || '')}</td><td></td><td>${names[i] && has(g('sw_signed')) ? esc(fmtDate(g('sw_signed'))) : ''}</td></tr>`;
  h += `<div class="sec">5. WORKERS CONSULTED AND SIGN-ON</div><table class="swt"><thead><tr><th>Name</th><th>Signature</th><th>Date</th></tr></thead><tbody>${who}</tbody></table>`;
  h += '<div class="sec">6. MONITORING AND REVIEW</div>' + kl('Controls are checked by', g('sw_mon')) + kl('Reviewed by', g('sw_rev')) + kl('Review date and changes', g('sw_revd'));
  h += '<p class="sm">Review this SWMS whenever the work changes, if the controls are not working, and after any incident. Keep a copy at the work site for as long as the work lasts.</p>';
  return h + paperFoot();
}

/** Copy the site address and the description of the work from the Quote tab, into boxes that are empty. */
function swmsFill() {
  const q = pickSource(get(T, 'fm_src'));
  const from = { sw_site: q.site || q.addr, sw_desc: q.scope };
  let n = 0;
  for (const [k, v] of Object.entries(from)) {
    if (has(v) && !has(get(T, k))) {
      put(T, k, v);
      n++;
    }
  }
  say(n ? 'Filled ' + n + (n === 1 ? ' box' : ' boxes') + ' from the quote you chose. Anything you typed stays.' : 'Nothing to fill: your boxes already have words, or there is no quote to fill from.');
  return n;
}

FORMS.push({ id: 'swms', label: 'SWMS', screen: swmsScreen, live: swmsLive, paper: swmsPaper, keys, fill: swmsFill });

function reopen() {
  const nav = document.querySelector(`#nav [data-t="${T}"]`);
  if (nav instanceof HTMLElement) nav.click();
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || !t.dataset.fmk) return;
  put(T, t.dataset.fmk, t.checked ? '1' : '');
  buildPaper(T);
});

document.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b || (b.id !== 'fm-addstep' && b.id !== 'fm-rmstep')) return;
  put(T, 'sw_n', String(steps() + (b.id === 'fm-addstep' ? 1 : -1)));
  reopen();
});
