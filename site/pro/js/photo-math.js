// P5: the numbers behind job photos. No page code, so they are easy to test.

/** The longest side of a saved photo, in pixels. Phone cameras take 4000 or more. */
export const MAX_SIDE = 1280;
/** How many photos one job can keep on the device. */
export const MAX_PHOTOS = 30;
/** JPEG quality for saved photos (0 to 1). */
export const QUALITY = 0.8;

/** The new size for a photo: the same shape, longest side no more than max, never bigger than the original. */
export function fitSize(w, h, max = MAX_SIDE) {
  if (!(w > 0 && h > 0)) return { w: 1, h: 1 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}
