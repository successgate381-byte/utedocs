// Extension points. Lite leaves every list empty, so Lite behaves exactly as before.
// Pro fills them in (see site/pro/js/register.js) and shares all the other code.
import { DOC_TABS, TABS } from './data.js';

/** @typedef {(...args: any[]) => any} Hook */

/** @type {{ edition: string, tabs: string[], docTabs: string[], render: Hook[], lines: Hook[], afterRender: Hook[], refresh: Hook[], paperFull: Hook[], paperAfter: Hook[], click: Hook[], tabAfter: Record<string, string[]> }} */
export const hooks = {
  /** Which edition is running: "lite" or "pro". Pro sets this in register.js. */
  edition: 'lite',
  /** Extra tab names, added after the Lite tabs. */
  tabs: [],
  /** Extra tabs that make a finished document (Preview and Save as PDF). */
  docTabs: [],
  /** (tab) => screen HTML for a tab that Lite does not draw, or null. */
  render: [],
  /** (tab) => run after a screen is drawn and filled. */
  afterRender: [],
  /** (tab) => run whenever sums and messages are refreshed. */
  refresh: [],
  /** (tab) => the whole finished document for a tab that Lite does not draw, or null. */
  paperFull: [],
  lines: [],
  /** (html, tab) => the finished document HTML, changed. */
  paperAfter: [],
  /** (button, tab) => run on every button tap. */
  click: [],
  /** Extra tabs placed straight after a Lite tab, for example { Variation: ['Progress Claim'] }. */
  tabAfter: {},
};

export const allTabs = () => [...TABS.flatMap((t) => [t, ...(hooks.tabAfter[t] || [])]), ...hooks.tabs];
export const isDocTab = (tab) => DOC_TABS.includes(tab) || hooks.docTabs.includes(tab);

/** Ask each hook in turn. The first one that gives back text wins. Otherwise null. */
export function firstText(list, ...args) {
  for (const fn of list) {
    const out = fn(...args);
    if (typeof out === 'string') return out;
  }
  return null;
}

/** Run every hook. */
export function runAll(list, ...args) {
  for (const fn of list) fn(...args);
}

/** Let each hook change the text in turn. */
export function pipe(list, text, ...args) {
  return list.reduce((t, fn) => {
    const out = fn(t, ...args);
    return typeof out === 'string' ? out : t;
  }, text);
}
