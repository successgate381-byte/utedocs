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

## Decisions (confirmed 18 Oct 2026)
11. Forms tab (Lite and Pro), last in the tab bar: Get Paid Faster texts, Job Completion Certificate and SWMS. The SWMS starts from the 18 high-risk activities list (SafeWork SA page, checked 18 Oct 2026; rules differ by state). Certificate signature pads are Pro only; Lite keeps hand signing.
12. Build order: I signatures, J last 3 quotes, K price types, L installable app, M licence gate, N referrals, O Approval record, P Save bar, then Cloudflare, Gumroad and public pages. M replaces P7, O replaces P8 and P replaces P9 in the Pro build list below.
13. Licence: each purchase gives 6 months. Lite is $37 and Pro is $57 (these replace the earlier $27 and $47). Renewing means buying again at the same price: no auto-charge, never called a subscription, never called one-time or lifetime. The first 20 buyers get $10 off. A Lite key opens Lite only and a Pro key opens Pro only. Up to 3 devices per key, with a device list and a remove button (this replaces the 5 unlocks per key). After expiry every tab and box locks and nothing responds; saved work stays on the device, and the lock screen shows only Renew, the referral link and a short message. The app is installable and works offline, checks the licence online at least every 14 days, and locks on the expiry date even offline.
14. Referrals have no cap. The friend gets 1 extra month after paying. The referrer gets 3 extra months 7 days after the friend pays, only if the purchase is not refunded and the emails differ. The reward goes to the referrer's own product. No "email my friends" feature.
15. Recent quotes: the last 3 quotes are kept (changed by item 18: the Save button keeps the copy and Clear does not). The Job Completion Certificate and the SWMS fill from the current quote or any of the last 3.
16. Price types: Quote, Tax Invoice and Invoice can be priced by Hourly rate or Cost plus. Both show a Labour table (date, description, hours, rate, amount) and a Materials table (item, quantity, cost, markup, amount). Labour is hours times rate with no markup. Markup is on materials only, from a default markup with a per-row override, and GST is on the marked-up price. The customer's copy can show cost and markup, or only the final price. Totals, the Xero export and the $1,000 customer check all work from the same rows. Not verified: any state rule about cost-plus or hourly contracts, so the app keeps its check-your-regulator wording.
17. Notes: My Details gets a notes library, which is saved statements the tradie types, each with a "print by default" tick. It starts empty and the app writes no legal wording for it. Each document gets an "Add a note" box (title, text, Print on PDF). Notes print under the scope. No regulator presets and no default standards or warranty line. A warranty promise that a tradie types needs the ACCC's mandatory wording, so read the ACCC page before any warranty feature.
18. Saved quotes: a Save button on the Quote puts a copy in the last 3 saved quotes, and a fourth pushes out the oldest. Clear no longer keeps a copy; if the quote has unsaved changes, Clear asks "Clear without saving?". This replaces the rule in item 15 that Clear keeps a copy. The Variation gets the same Save button and the same Clear warning, with its own last 3. Recent lists for Invoices and Progress Claims wait until this works. A saved quote holds the name, number, date, phone, address, site and scope (what the Certificate and the SWMS fill from), not the price lines. A saved variation holds its details but no price lines, and nothing fills from it yet. Reopening a saved copy into its tab is built in item 20.
19. SWMS workers consulted: one row per worker with a name and their own typeable date (dd/mm/yy), up to 12, no signature pad (they sign on the printed page), with add and remove buttons. This replaces the single names box and the single "Date the workers signed" box. Older saved names and dates move into the rows.
20. Reopening saved copies: each Save keeps the whole Quote or Variation, price lines and notes included. A Saved quotes list on the Quote screen and a Saved variations list on the Variation screen show an Open button for each copy. Open replaces what is on the tab, and asks first when the tab is not saved. Clear without saving? also notices changed price lines. Copies saved before this change hold only details, so they show as details only and cannot be reopened.
21. Notes on the Job Completion Certificate: saved notes follow the same setting as on quotes, and the certificate gets up to 3 notes of its own, printed above the customer acknowledgement. Notes are not added to the SWMS or to the Get Paid Faster texts: the SWMS already has a box for each part, and a saved note such as a warranty line does not belong in a safety document.

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
