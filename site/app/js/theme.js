// @ts-check
// Light or dark for the app screens only. The finished document and the printed page always stay light.
const KEY = 'utedocs.theme';

/** @returns {'light' | 'dark'} */
function current() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(/** @type {'light' | 'dark'} */ mode) {
  document.documentElement.dataset.theme = mode;
  const b = document.getElementById('theme');
  if (b) {
    b.setAttribute('aria-pressed', String(mode === 'dark'));
    b.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#2a3a5e' : '#1f2a44');
}

/** Set the screen colours now and wire up the switch in the top bar. */
export function initTheme() {
  apply(current());
  const b = document.getElementById('theme');
  if (!b) return;
  b.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the switch still works for this visit */
    }
    apply(next);
  });
}
