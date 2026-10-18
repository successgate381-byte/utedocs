# UteDocs plan

How we work: copy-paste blocks only (heredoc formula), typecheck + lint + test after every change,
nothing existing is dropped (the lock lists guard that), batches of two or three blocks.
Tick a line only when it is built, tested and you said "clean".

## Done
- [x] Lite rebuilt from scratch (Blocks 1 to 5): nine tabs, client name / signature / date typed ABOVE the line,
      Australian look, A4 print, browser tests, feature lock. Backed up on branch utedocs-rebuild.

## Decisions (confirmed 10 Oct 2026)
1. Remote accept link: built last in Pro (P8), switched on after Cloudflare is live. The Privacy page must say what is stored.
2. Progress claim: a new tab with contract total, % complete this claim, earlier claims, GST and balance remaining.
   Plain "check your state rules" note. No legal claims.
3. Job photos: a gallery per job, with tick-boxes to print chosen photos on an extra PDF page.
4. Starter packs: more job suggestions plus ready-made scope, inclusions and exclusions wording. No prices.
5. Xero CSV: built to Xero's own template. The real import test is done by you later (needs a free Xero account).
- Pro costs $47. Lite price $27 is proposed, not confirmed. Pro shares Lite's code, so a Lite fix reaches Pro.
- Cloudflare, domain, public pages and Gumroad come AFTER Pro.

## Decisions (confirmed 17 Oct 2026)
1. Both Lite and Pro sit behind a licence gate: two Gumroad products and two keys. There is no open Lite.
2. P8 is the Approval record (Pro only). The remote accept link waits until after launch and is built only if customers ask.
3. Each key allows up to 5 unlocks. The Save bar on My Details blocks leaving until you save or discard. Order: P7, P8, P9.
4. Documents: the title (TAX INVOICE, QUOTE and so on) sits on its own line at the very top. The business name, ABN, licence, phone and email share one block under it.
5. Footer under customer documents: Lite shows "Made with UteDocs" and the logo. Pro shows nothing. The old "General template" line is gone from customer documents (it stays on the app screens).
6. Starter packs: choosing another job type swaps boxes that still hold the old pack's words. Words you typed or changed stay.
7. Photos: large framed photos, 2 per PDF page (or 1), numbered, with a caption and the date added. Tap a photo to open it full screen.
8. Parked until after launch: QR code for the card link, the "10 things every tradie quote needs" checklist, Pinterest pins.
9. Printing: only the Quote prints at 85%, so a typical quote fits one sheet on Letter or A4. Other documents print at full size. Longer documents flow onto more pages with the keep-together rules. Automatic fit is a later option, only after a check on a real phone.

## Pro build ($47)
- [x] P1 Pro shell: /pro/ page runs the same app plus a Pro badge; extension points in Lite (hooks). Done when: every Lite test passes inside Pro.
- [x] P2 Client signature pad (Quote and Variation): finger or Apple Pencil, Clear and Undo, small image shown above the line on Preview and PDF, accepted date added. Done when: drawing test passes, page does not scroll while drawing.
- [x] P3 Progress claim tab (decision 2). Done when: maths tests pass.
- [x] P4 Xero invoice CSV export (decision 5). Done when: columns match Xero's template.
- [x] P5 Job photos (decision 3): take or pick, resize, store on the device, optional PDF page. Done when: resize and storage tests pass.
- [x] P6 Starter packs, Electrician and Plumber (decision 4). Done when: packs load and can be edited.
- [ ] P7 Licence gate for Lite and Pro (two products, two keys, 5 unlocks per key): server checks the Gumroad key, signed cookie, "Remember this device" ticked by default, Forget button. Done when: good key opens Pro and wrong key does not (pretend Gumroad here, real one later).
- [ ] P8 Approval record (Pro): on Quote acceptance and Variation approval, a Confirm button records who approved, how, when, and the exact time from the phone. Printed as a record of approval, never called a signature. Done when: tests pass.
- [ ] P9 Save button on My Details (Lite and Pro): a draft, a Save details bar, Discard changes, and leaving the tab is blocked until you save or discard. Done when: tests pass.

## After Pro (not started)
- [ ] Cloudflare Pages: connect the repo, build folder site, add utedocs.site, hello@ forwarding, make the repo private, switch GitHub Pages off, merge to main.
- [ ] Public pages: landing (Lite and Pro), Terms, Privacy, Refund, Support.
- [ ] Gumroad: Lite and Pro products, licence keys, receipt messages, test purchases.
- [ ] Launch checks: real phones (Android, iPhone, iPad), legal read-through, support routine.
- [ ] QuickBooks only after a real Australian account test.
- [ ] Remote accept link, only if customers ask (sits beside the Approval record).
