// P5: the Photos tab. Take or choose photos, shrink them, keep them on this device,
// and tick the ones to print. Ticked photos can also be added as an extra page on any document.
import { $, setText } from '../../app/js/dom.js';
import { letterhead, paperFoot } from '../../app/js/paper.js';
import { esc, has } from '../../app/js/format.js';
import { refresh } from '../../app/js/live.js';
import { get, put, view } from '../../app/js/state.js';
import { band, foot, note, row, sec } from '../../app/js/views.js';
import { MAX_PHOTOS, QUALITY, fitSize, stampText } from './photo-math.js';
import { clearPhotos, deletePhoto, listPhotos, savePhoto } from './photos-db.js';

export const PHOTOS_TAB = 'Photos';
/** Finished documents that can carry the photo page. */
export const PHOTO_DOC_TABS = ['Quote', 'Tax Invoice', 'Invoice', 'Variation', 'Progress Claim'];

/** @typedef {{ id: string, caption: string, print: boolean, w: number, h: number, added: number, blob: Blob, url: string }} Photo */
/** @type {Photo[]} */
const photos = [];

const find = (/** @type {string | undefined} */ id) => photos.find((p) => p.id === id);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const keep = (/** @type {Photo} */ p) => savePhoto({ id: p.id, caption: p.caption, print: p.print, w: p.w, h: p.h, added: p.added, blob: p.blob });

/** Load the saved photos when the app starts. */
export async function initPhotos() {
  wireLightbox();
  try {
    const rows = await listPhotos();
    rows.sort((a, b) => a.added - b.added);
    photos.length = 0;
    for (const r of rows) {
      photos.push({ id: String(r.id), caption: String(r.caption || ''), print: r.print === true, w: Number(r.w) || 1, h: Number(r.h) || 1, added: Number(r.added) || 0, blob: r.blob, url: URL.createObjectURL(r.blob) });
    }
  } catch {
    // Storage can be blocked (private mode). The Photos tab then says so when a photo is added.
  }
  renderGrid();
  refresh(view.tab);
}

/** Decode a photo, turning it the way the phone was held. */
async function decode(/** @type {File} */ file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/** A smaller JPEG of the photo. */
async function shrink(/** @type {File} */ file) {
  const bitmap = await decode(file);
  const { w, h } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY));
  return { blob, w, h };
}

async function addFiles(/** @type {FileList | null} */ files) {
  const problems = [];
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => false);
  let added = 0;
  for (const file of files ? [...files] : []) {
    if (photos.length >= MAX_PHOTOS) {
      problems.push('You can keep up to ' + MAX_PHOTOS + ' photos. Remove some to add more.');
      break;
    }
    if (!file.type.startsWith('image/')) {
      problems.push(file.name + ' is not a photo.');
      continue;
    }
    try {
      const { blob, w, h } = await shrink(file);
      const photo = { id: newId(), caption: '', print: false, w, h, added: Date.now() + added, blob, url: URL.createObjectURL(blob) };
      await keep(photo);
      photos.push(photo);
      added++;
    } catch {
      problems.push(file.name + ' could not be added. Try a JPEG or PNG photo.');
    }
  }
  setText('ph-msg', problems.join(' '));
  renderGrid();
  refresh(view.tab);
}

async function removePhoto(/** @type {string} */ id) {
  const photo = find(id);
  if (!photo) return;
  await deletePhoto(id);
  URL.revokeObjectURL(photo.url);
  photos.splice(photos.indexOf(photo), 1);
  renderGrid();
  refresh(view.tab);
}

async function removeAll() {
  await clearPhotos();
  for (const p of photos) URL.revokeObjectURL(p.url);
  photos.length = 0;
  renderGrid();
  refresh(view.tab);
}

/** Draw the thumbnails, captions and tick boxes. */
function renderGrid() {
  const grid = $('#ph-grid');
  if (!grid) return;
  grid.innerHTML = photos
    .map(
      (p, n) =>
        `<div class="ph-card"><button class="ph-open" type="button" data-open="${esc(p.id)}" aria-label="Open photo ${n + 1} full screen"><img src="${p.url}" alt="Job photo ${n + 1}" width="${p.w}" height="${p.h}"></button>` +
        `<input type="text" maxlength="80" list="ph-caps" data-ph="${esc(p.id)}" aria-label="Caption for photo ${n + 1}" placeholder="Caption (optional)" value="${esc(p.caption)}">` +
        `<label class="ph-tick"><input type="checkbox" data-print="${esc(p.id)}"${p.print ? ' checked' : ''}> Print</label>` +
        `<button class="b g" data-remove="${esc(p.id)}">Remove</button></div>`,
    )
    .join('');
  const ticked = photos.filter((p) => p.print).length;
  setText('ph-count', photos.length ? photos.length + (photos.length === 1 ? ' photo' : ' photos') + ' kept on this device, ' + ticked + ' ticked to print.' : 'No photos yet.');
}

/** @type {HTMLElement | null} */
let lightbox = null;
/** @type {Element | null} */
let lightboxFrom = null;

function closeLightbox() {
  if (!lightbox) return;
  lightbox.remove();
  lightbox = null;
  document.body.classList.remove('lb-open');
  if (lightboxFrom instanceof HTMLElement) lightboxFrom.focus();
  lightboxFrom = null;
}

/** One photo, full screen. Pinch to zoom works as on any page. Close, Escape or the dark area leaves. */
function openLightbox(/** @type {string} */ id) {
  const p = find(id);
  if (!p) return;
  closeLightbox();
  lightboxFrom = document.activeElement;
  const box = document.createElement('div');
  box.className = 'lb';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo full screen');
  box.innerHTML = `<button class="b lb-x" type="button">Close</button><div class="lb-i"><img src="${p.url}" alt="${esc(has(p.caption) ? p.caption : 'Job photo')}"></div><div class="lb-c">${has(p.caption) ? '<b>' + esc(p.caption) + '</b>' : ''}<span>Added ${stampText(p.added)}</span></div>`;
  document.body.appendChild(box);
  document.body.classList.add('lb-open');
  lightbox = box;
  const x = box.querySelector('.lb-x');
  if (x instanceof HTMLElement) x.focus();
}

function wireLightbox() {
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (lightbox) {
      if (t.closest('.lb-x') || t === lightbox || t.classList.contains('lb-i')) closeLightbox();
      return;
    }
    const opener = t.closest('[data-open]');
    const shown = t.closest('#paper .photopage img[data-pid]');
    const id = opener instanceof HTMLElement ? opener.dataset.open : shown instanceof HTMLElement ? shown.dataset.pid : '';
    if (id) openLightbox(id);
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'Tab') {
      e.preventDefault();
      const x = lightbox.querySelector('.lb-x');
      if (x instanceof HTMLElement) x.focus();
    }
  });
}

/** The page of ticked photos. Empty text when none are ticked. */
function photoPage(/** @type {boolean} */ extra) {
  const picked = photos.filter((p) => p.print);
  if (!picked.length) return '';
  const job = get(PHOTOS_TAB, 'job');
  const one = get(PHOTOS_TAB, 'pp') === '1 per page (largest)';
  const figures = picked.map((p, n) => `<figure><div class="pfr"><img src="${p.url}" alt="${esc(has(p.caption) ? p.caption : 'Job photo ' + (n + 1))}" data-pid="${esc(p.id)}"></div><figcaption><span class="pt">Photo ${n + 1}${has(p.caption) ? ' - ' + esc(p.caption) : ''}</span><span class="pdate">Added ${stampText(p.added)}</span></figcaption></figure>`).join('');
  return `<div class="photopage${extra ? ' extra' : ''}${one ? ' one' : ''}"><div class="sec">JOB PHOTOS</div>${extra && has(job) ? `<p><b>Job:</b> ${esc(job)}</p>` : ''}<div class="pgrid">${figures}</div></div>`;
}

/** The Photos screen. */
export function photosScreen() {
  return `<div class="pg">${band('JOB PHOTOS')}<div class="leg">Take or choose photos of the job. They are made smaller and kept on this device only. Nothing is uploaded. Tick the ones you want on a PDF page.</div>
${sec('THE JOB')}
${row(PHOTOS_TAB, 'job', 'Job name or site', 't')}
${row(PHOTOS_TAB, 'pp', 'Photos on each PDF page', 's', { options: ['2 per page', '1 per page (largest)'], ex: 'Two per page is large and clear. One per page fills the page.' })}
${sec('ADD PHOTOS')}
<div class="ph-actions"><input class="vh" id="ph-take" type="file" accept="image/*" capture="environment"><label class="b o" for="ph-take">Take photo</label><input class="vh" id="ph-choose" type="file" accept="image/*" multiple><label class="b" for="ph-choose">Choose photos</label></div>
<div class="warn" id="ph-msg"></div>
<div class="note" id="ph-count"></div>
<datalist id="ph-caps"><option value="Before"><option value="After"><option value="Fault found"><option value="Work completed"><option value="Damage"><option value="Materials used"></datalist>
<div class="ph-grid" id="ph-grid"></div>
<div class="btns"><button class="b" id="pv">Preview</button><button class="b o" id="pdf">Save as PDF</button><button class="b g" id="ph-clear">Remove all photos</button></div>
${note('Photos are only added to a PDF when you tick them. You can also add the ticked photos as an extra page on a Quote, Tax Invoice, Invoice, Variation or Progress Claim PDF.')}
${foot()}</div>`;
}

/** The finished Photos document. */
export function photosPaper() {
  const job = get(PHOTOS_TAB, 'job');
  let h = letterhead('JOB PHOTOS', [['Job', job]]);
  h += photoPage(false) || '<p class="sm">No photos are ticked. Tick photos on the Photos tab to print them here.</p>';
  return h + paperFoot();
}

/** Add the photo page to another document, when that document has the box ticked. */
export function addPhotoPage(/** @type {string} */ html, /** @type {string} */ tab) {
  if (!PHOTO_DOC_TABS.includes(tab) || get(tab, 'photos') !== '1') return html;
  return html + photoPage(true);
}

/** The tick box under the buttons of each document. */
function mountInclude(/** @type {string} */ tab) {
  const bar = $('#pv') ? $('#pv').closest('.btns') : null;
  if (!bar) return;
  const ticked = photos.filter((p) => p.print).length;
  bar.insertAdjacentHTML(
    'afterend',
    `<label class="ph-inc"><input type="checkbox" id="ph-inc"> Add the ticked job photos as an extra page on this PDF <span>(${ticked} ticked)</span></label>`,
  );
  const box = $('#ph-inc');
  if (!(box instanceof HTMLInputElement)) return;
  box.checked = get(tab, 'photos') === '1';
  box.addEventListener('change', () => {
    put(tab, 'photos', box.checked ? '1' : '');
    refresh(tab);
  });
}

/** Wire up the buttons, captions and tick boxes on the Photos screen. */
function mountGallery() {
  renderGrid();
  const grid = $('#ph-grid');
  if (grid) {
    grid.addEventListener('input', (e) => {
      const t = e.target;
      const photo = t instanceof HTMLInputElement ? find(t.dataset.ph) : undefined;
      if (t instanceof HTMLInputElement && photo) {
        photo.caption = t.value;
        refresh(view.tab);
      }
    });
    grid.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      const captioned = find(t.dataset.ph);
      const ticked = find(t.dataset.print);
      if (captioned) keep(captioned);
      if (ticked) {
        ticked.print = t.checked;
        keep(ticked);
        renderGrid();
        refresh(view.tab);
      }
    });
    grid.addEventListener('click', (e) => {
      const button = e.target instanceof HTMLElement ? e.target.closest('button[data-remove]') : null;
      if (button instanceof HTMLElement && button.dataset.remove) removePhoto(button.dataset.remove);
    });
  }
  for (const id of ['#ph-take', '#ph-choose']) {
    const input = $(id);
    if (input instanceof HTMLInputElement) {
      input.addEventListener('change', async () => {
        await addFiles(input.files);
        input.value = '';
      });
    }
  }
  const clear = $('#ph-clear');
  if (clear) {
    clear.addEventListener('click', () => {
      if (photos.length && confirm('Remove all photos from this device?')) removeAll();
    });
  }
}

export function mountPhotos(/** @type {string} */ tab) {
  if (tab === PHOTOS_TAB) mountGallery();
  if (PHOTO_DOC_TABS.includes(tab)) mountInclude(tab);
}
