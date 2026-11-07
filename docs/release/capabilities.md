# Release capability reference

This branch is a local release candidate. No deployment or external acceptance is implied.

| Capability | Local evidence | Release boundary |
| --- | --- | --- |
| First deck, shared edits, saved versions | P01–P08 checks; P09 first-deck and import/export probes | Public hosting remains X05 |
| Aira and tool mutations | Deterministic adapter replay, 144 quality paths and 120 tool trials | X03 passed for Claude only after the SDK Stop fix and live Stop/Resume smoke. Aesthetic quality remains X04 |
| Quality acceptance | Frozen tasks, pinned previous task results, no-regression veto, calibration validator, swapped-order scoring, seeded bootstrap | Human baseline, 360 ratings, holdout and preference floor remain X04 |
| PPTX preservation and native export | Engine reopen, unchanged package bytes, local LibreOffice fast check | Windows and Mac reference applications, editable chart and text, masters and fonts remain X01 |
| Accessibility | Local keyboard, focus, reflow and contrast probes | Real NVDA and VoiceOver walkthroughs remain X02 |
| External agent guides | Proposed connection, pagination, stale recovery and revoke instructions | Each named client needs an authorized public HTTPS walkthrough under X05 |
| Weekly usage and credits | Ledger rates and explicitly wired fixture payment race checks. Normal Studio shows balances and reset time; buying credits is not available yet | No payment provider is configured. Country eligibility, FX, signatures and reconciliation remain X06 |
| Recovery | Ordered reconnect batches of at most 100 commands in one admitted transaction, immutable per-command receipts, one deck projection and shared receipt checkpoint per batch, outbox reads shared only before the read starts under acquired command locks, durable checkpoint before queue deletion, offline reload and undo, disposable operation-store backup, restore, deletion, interrupted lease fencing | Production database backup, hosting and scheduling require an authorized deployment runbook |

Imports preserve supported package parts. Unsupported items can remain kept or flagged. Review warnings before editing and export. There is no lossless-export claim. The site offers synthetic before and after files with hashes. Their source deck demonstrates a text edit, not evaluated presentation quality.

No named client has a supported badge. Claude tool use is accepted under X03; vendor application compatibility remains unverified. No quality score is published. Share and Present are absent from the release surface.

Public copy is an exact allowlist in `apps/site/content/claims.json`. Each entry names a P01–P09 receipt, a passed external gate and its receipt, or an explicitly unverified X01–X06 gate. Passed external claims must match the gate status and receipt in the acceptance matrix below. The build reads allowance, rates and public amounts from the shipped ledger constants. Raw public amounts and unregistered copy fail lint. Reset pricing appears in Settings; the public pricing page explains the reset without an amount.

The landing uses sample chart illustrations and one actual built Studio capture. Its eight-slide Halden deck is captured at 2x while the deterministic adapter is paused after the third accepted slide update. The build callout is explicitly illustrative. Capture provenance and a focused mobile crop ship with the image. Refresh with `node bench/release/site-capture.mjs --publish` after building Studio. The agent diagram describes connection preparation, with client verification still blocked on X05.

## External gate acceptance

| Gate | Status | Receipt | Scope |
| --- | --- | --- | --- |
| X03 | passed | P09/external/X03/results/report.md | Claude only. Second model waived by the operator on 2026-11-07. 120/120 tool trials. The original receipt records the prior SDK failure; the later program/release-verdict.md update records PR #12 and the successful live real-Claude Stop/Resume smoke. No aesthetic quality acceptance. |
