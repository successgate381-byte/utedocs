// P2: the client draws their signature with a finger or Apple Pencil.
// Strokes are saved as small numbers (0 to 1) so the drawing keeps its shape on any screen size.
import { $ } from '../../app/js/dom.js';
import { has } from '../../app/js/format.js';
import { refresh } from '../../app/js/live.js';
import { get, put } from '../../app/js/state.js';

/** Tabs that have a client sign-off. */
export const SIGN_TABS = ['Quote', 'Variation'];

const RATIO = 2.5; // the pad is 2.5 times wider than it is tall
const EXPORT_WIDTH = 600; // the saved picture is 600 px wide
const MAX_POINTS = 3000;
const MAX_STROKES = 60;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** @typedef {number[][]} Stroke */

/** Read saved strokes. Anything odd is ignored, never trusted. */
function readStrokes(tab, key = 'sigstrokes') {
  try {
    const raw = JSON.parse(get(tab, key) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(Array.isArray)
      .map((s) => s.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, MAX_POINTS))
      .filter((s) => s.length > 0)
      .slice(0, MAX_STROKES);
  } catch {
    return [];
  }
}

/** Pen width for a canvas that is w pixels wide. */
const base = (w) => Math.max(1.6, w * 0.0062);

/** The width factor kept with a point: 1 is the normal pen. Older drawings have none. */
const wf = (p) => (Number.isFinite(p[2]) && p[2] > 0 ? p[2] : 1);

function inkStyle(ctx) {
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#111';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** A tap: one round dot. */
function dot(ctx, w, h, p) {
  ctx.beginPath();
  ctx.arc(p[0] * w, p[1] * h, (base(w) * wf(p)) / 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The piece of a stroke that belongs to point i: a smooth curve from the middle of the segment before it
 * to the middle of the segment after it, with point i as the guide. A finished piece never changes, so the
 * line can be drawn as the finger moves and nothing already drawn has to be redrawn.
 */
function piece(ctx, w, h, /** @type {Stroke} */ s, i) {
  const last = s.length - 1;
  const mid = (a, b) => [((s[a][0] + s[b][0]) / 2) * w, ((s[a][1] + s[b][1]) / 2) * h];
  const from = i === 0 ? [s[0][0] * w, s[0][1] * h] : mid(i - 1, i);
  const to = i === last ? [s[last][0] * w, s[last][1] * h] : mid(i, i + 1);
  ctx.lineWidth = base(w) * wf(s[i]);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  if (i === 0 || i === last) ctx.lineTo(to[0], to[1]);
  else ctx.quadraticCurveTo(s[i][0] * w, s[i][1] * h, to[0], to[1]);
  ctx.stroke();
}

/** Draw all the strokes from scratch (after undo, clear or a resize, and for the saved picture). */
function paint(ctx, w, h, /** @type {Stroke[]} */ strokes) {
  ctx.clearRect(0, 0, w, h);
  inkStyle(ctx);
  for (const s of strokes) {
    if (s.length === 1) dot(ctx, w, h, s[0]);
    else for (let i = 0; i < s.length; i++) piece(ctx, w, h, s, i);
  }
}

/** A small picture of the signature with a see-through background. */
function toPng(/** @type {Stroke[]} */ strokes) {
  const c = document.createElement('canvas');
  c.width = EXPORT_WIDTH;
  c.height = Math.round(EXPORT_WIDTH / RATIO);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  paint(ctx, c.width, c.height, strokes);
  return c.toDataURL('image/png');
}

/** Today as 2026-10-10, in the phone's own time. */
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const clamp = (n) => Math.min(1, Math.max(0, Math.round(n * 10000) / 10000));

/** Put the drawing pad above the typed name, signature and date. */
export function mountPad(/** @type {string} */ tab) {
  const anchor = SIGN_TABS.includes(tab) ? $('.sg.edit') : null;
  if (anchor) mountPadAt(anchor, { scope: tab, id: 'sg', title: 'Draw the client signature here (finger or Apple Pencil)', datesToo: true });
}

/** The two pads on the Job Completion Certificate: the customer's and yours. */
export function mountCertPads(/** @type {string} */ tab) {
  if (tab !== 'Forms') return;
  const c = document.getElementById('fm-sig-c');
  const t = document.getElementById('fm-sig-t');
  if (c) mountPadAt(c, { scope: 'Forms', id: 'jc-c', title: 'Customer signature: draw here (finger or Apple Pencil)', imgKey: 'jc_csig', strokeKey: 'jc_cstr', dateKey: 'jc_cdate' });
  if (t) mountPadAt(t, { scope: 'Forms', id: 'jc-t', title: 'Your signature: draw here', imgKey: 'jc_tsig', strokeKey: 'jc_tstr', dateKey: 'jc_tdate' });
}

/**
 * Put a drawing pad in front of an element. It saves its strokes and picture under the keys given.
 * @param {Element} anchor
 * @param {{ scope: string, id: string, title: string, datesToo?: boolean, imgKey?: string, strokeKey?: string, dateKey?: string }} o
 */
export function mountPadAt(anchor, o) {
  const tab = o.scope;
  const imgKey = o.imgKey || 'sigimg';
  const strokeKey = o.strokeKey || 'sigstrokes';
  const box = document.createElement('div');
  box.className = 'sigpad';
  box.innerHTML =
    `<div class="sigpad-h">${o.title}</div>` +
    `<canvas id="${o.id}-pad" role="img" aria-label="Signature pad"></canvas>` +
    `<div class="btns tight"><button class="b g" id="${o.id}-undo">Undo</button><button class="b g" id="${o.id}-clear">Clear signature</button></div>`;
  anchor.before(box);
  const canvas = box.querySelector('canvas');
  const ctx = canvas ? canvas.getContext('2d', { desynchronized: true }) : null;
  if (!canvas || !ctx) return;

  let strokes = readStrokes(tab, strokeKey);
  /** @type {Stroke | null} */
  let current = null;

  const repaint = () => paint(ctx, canvas.width, canvas.height, strokes);
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    repaint();
  };
  new ResizeObserver(fit).observe(canvas);
  fit();

  /** Save the strokes and the picture. Add today's date if the date box is empty. */
  const save = () => {
    put(tab, strokeKey, JSON.stringify(strokes));
    put(tab, imgKey, strokes.length ? toPng(strokes) : '');
    if (o.dateKey && strokes.length && !has(get(tab, o.dateKey))) {
      put(tab, o.dateKey, today());
      const own = $('#i-' + o.dateKey);
      if (own instanceof HTMLInputElement) own.value = today();
    }
    const dateBox = $('#i-ad');
    if (o.datesToo && strokes.length && !has(get(tab, 'ad'))) {
      put(tab, 'ad', today());
      put(tab, 'sigdate', today());
      if (dateBox instanceof HTMLInputElement) dateBox.value = today();
    }
    if (o.datesToo && !strokes.length && has(get(tab, 'sigdate')) && get(tab, 'ad') === get(tab, 'sigdate')) {
      put(tab, 'ad', '');
      put(tab, 'sigdate', '');
      if (dateBox instanceof HTMLInputElement) dateBox.value = '';
    }
    refresh(tab);
  };

  const MIN_STEP = 1.1; // CSS pixels. Points closer than this are hand shake, not drawing.
  let activeId = -1; // only one finger or pen draws at a time, a resting palm is ignored
  /** @type {DOMRect | null} */
  let rect = null;
  let drawn = 0; // pieces of the current stroke already on the canvas
  let sm = [0, 0]; // smoothed position, CSS pixels
  let pushed = [0, 0]; // last position kept, CSS pixels
  let lastT = 0;
  let factor = 1;

  const add = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ f) => {
    if (!current || !rect) return;
    current.push([clamp(x / rect.width), clamp(y / rect.height), Math.round(f * 100) / 100]);
    pushed = [x, y];
  };
  /** Put the finished pieces of the current stroke on the canvas. The newest point waits for the next one. */
  const flush = (/** @type {boolean} */ final) => {
    if (!current) return;
    inkStyle(ctx);
    const upTo = final ? current.length - 1 : current.length - 2;
    for (; drawn <= upTo; drawn++) piece(ctx, canvas.width, canvas.height, current, drawn);
  };
  const pressure = (/** @type {PointerEvent} */ e) => (e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1.5, 0.6 + e.pressure) : 0);

  canvas.addEventListener('pointerdown', (e) => {
    if (activeId !== -1 || strokes.length >= MAX_STROKES) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    activeId = e.pointerId;
    rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    factor = pressure(e) || 1;
    current = [];
    strokes.push(current);
    sm = [x, y];
    lastT = e.timeStamp;
    drawn = 0;
    add(x, y, factor);
    inkStyle(ctx);
    dot(ctx, canvas.width, canvas.height, current[0]);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current || !rect || e.pointerId !== activeId) return;
    e.preventDefault();
    const moves = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const m of moves.length ? moves : [e]) {
      if (current.length >= MAX_POINTS) break;
      const x = m.clientX - rect.left;
      const y = m.clientY - rect.top;
      const speed = Math.hypot(x - sm[0], y - sm[1]) / Math.max(1, m.timeStamp - lastT); // CSS pixels per ms
      lastT = m.timeStamp;
      const a = Math.min(0.95, 0.45 + speed * 0.35); // slow: smooth the shake. Fast: follow the finger.
      sm = [sm[0] + (x - sm[0]) * a, sm[1] + (y - sm[1]) * a];
      if (Math.hypot(sm[0] - pushed[0], sm[1] - pushed[1]) < MIN_STEP) continue;
      const target = pressure(m) || Math.max(0.65, Math.min(1.3, 1.3 - speed * 0.35));
      factor += (target - factor) * 0.2;
      add(sm[0], sm[1], factor);
    }
    flush(false);
  });
  const end = (/** @type {PointerEvent} */ e) => {
    if (!current || e.pointerId !== activeId) return;
    if (rect && Math.hypot(e.clientX - rect.left - pushed[0], e.clientY - rect.top - pushed[1]) > 0.4 && current.length < MAX_POINTS) add(e.clientX - rect.left, e.clientY - rect.top, factor);
    if (current.length > 1) flush(true);
    current = null;
    activeId = -1;
    rect = null;
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const undo = box.querySelector('#' + o.id + '-undo');
  const clear = box.querySelector('#' + o.id + '-clear');
  if (undo) undo.addEventListener('click', () => { strokes.pop(); repaint(); save(); });
  if (clear) clear.addEventListener('click', () => { strokes = []; repaint(); save(); });
}

/** On the finished document, show the drawn signature above the line. */
export function signaturePaper(/** @type {string} */ html, /** @type {string} */ tab) {
  if (!SIGN_TABS.includes(tab)) return html;
  const img = get(tab, 'sigimg');
  if (!PNG.test(img)) return html;
  const cell = /<div class="c"><em>[^<]*<\/em>(<span>Client \/ customer signature<\/span>)/;
  return html.replace(cell, (_all, label) => `<div class="c"><em class="sigem"><img class="sigimg" alt="Client signature" src="${img}"></em>${label}`);
}
