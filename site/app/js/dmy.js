// @ts-check
// Typed dates for boxes where a tradie types day, month and year, like 20/10/26.
// A two-digit year means 2000 to 2099. Anything that is not a real calendar date gives ''.

/**
 * @param {unknown} text what was typed, for example 20/10/26, 5-3-2026 or 5.3.26
 * @returns {string} an ISO date like 2026-10-20, or '' when it is not a real date
 */
export function parseDmy(text) {
  const m = /^\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2}|\d{4})\s*$/.exec(String(text ?? ''));
  if (!m) return '';
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (y < 2000 || y > 2099 || mo < 1 || mo > 12 || d < 1) return '';
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > last) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/**
 * @param {unknown} iso an ISO date like 2026-10-20
 * @returns {string} the same date as dd/mm/yy (20/10/26), or '' when it is not an ISO date
 */
export function toDmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : '';
}
