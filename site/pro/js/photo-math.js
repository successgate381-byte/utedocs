// P5: the numbers behind job photos. No page code, so they are easy to test.

/** The longest side of a saved photo, in pixels. Phone cameras take 4000 or more. */
export const MAX_SIDE = 1280;
/** How many photos one job can keep on the device. */
export const MAX_PHOTOS = 30;
/** JPEG quality for saved photos (0 to 1). */
export const QUALITY = 0.8;

/** The date and time a photo was added, in the phone's own time: "6 Oct 2026, 2:45 pm". */
export function stampText(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ', ' + (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm');
}

/** The new size for a photo: the same shape, longest side no more than max, never bigger than the original. */
export function fitSize(w, h, max = MAX_SIDE) {
  if (!(w > 0 && h > 0)) return { w: 1, h: 1 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}
