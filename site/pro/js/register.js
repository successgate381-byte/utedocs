// Everything that makes Pro different from Lite is added here, through the hooks.
import { $ } from '../../app/js/dom.js';
import { hooks } from '../../app/js/hooks.js';
import { mountPad, signaturePaper } from './signature.js';
import { CLAIM_TAB, claimLive, claimPaper, claimScreen } from './claim.js';
import { mountXero, updateXeroCheck } from './xero.js';
import { PHOTOS_TAB, addPhotoPage, initPhotos, mountPhotos, photosPaper, photosScreen } from './photos.js';

hooks.afterRender.push((tab) => {
  if (tab !== 'Start Here') return;
  const title = $('.band b');
  if (title) title.textContent = 'UTEDOCS PRO';
});

// P2: client signature pad on Quote and Variation.
hooks.afterRender.push((tab) => mountPad(tab));
hooks.paperAfter.push((html, tab) => signaturePaper(html, tab));

// P3: progress claim tab, straight after Variation, with its own finished document.
hooks.tabAfter.Variation = [...(hooks.tabAfter.Variation || []), CLAIM_TAB];
hooks.docTabs.push(CLAIM_TAB);
hooks.render.push((tab) => (tab === CLAIM_TAB ? claimScreen() : null));
hooks.refresh.push((tab) => {
  if (tab === CLAIM_TAB) claimLive();
});
hooks.paperFull.push((tab) => (tab === CLAIM_TAB ? claimPaper() : null));

// P4: Export for Xero button on the Tax Invoice tab, and the Xero settings on My Details.
hooks.afterRender.push((tab) => mountXero(tab));
hooks.refresh.push((tab) => updateXeroCheck(tab));

// P5: job photos tab (after Progress Claim), with an optional photo page on the other documents.
hooks.tabAfter.Variation = [...(hooks.tabAfter.Variation || []), PHOTOS_TAB];
hooks.docTabs.push(PHOTOS_TAB);
hooks.render.push((tab) => (tab === PHOTOS_TAB ? photosScreen() : null));
hooks.paperFull.push((tab) => (tab === PHOTOS_TAB ? photosPaper() : null));
hooks.paperAfter.push((html, tab) => addPhotoPage(html, tab));
hooks.afterRender.push((tab) => mountPhotos(tab));
initPhotos();
