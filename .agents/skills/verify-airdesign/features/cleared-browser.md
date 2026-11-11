# Reopen a saved deck in a cleared browser

A person saves an edit, then their browser loses everything AirDesign stored on the device: IndexedDB, local storage and site files. When they open the deck again, the slide should still show its content and their edit. Today it shows an empty slide with page number `1`, because the server keeps only the edit register and the imported file lives on the device. The journey is an expected failure until that is fixed.

## Sub-features

- `cleared-reopen-text` the edited text box reads the text the server kept.
- `cleared-reopen-paint` the slide paints as many elements as it did before the browser was cleared.

## How to get to it (user POV)

- Open a deck, edit it, clear site data in the browser (or open it on a second device), then open `/deck/<id>` again.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists.

- **Run it.** `$V journey <run> cleared-browser`. Today it prints `"passed":false`, which is the known bug.
- **Import and edit.** Import `clean.pptx` from Home, count `[data-canvas-element]`, type `Kept on the server`, and poll `post(deckRoutes.open, { deck })` until the register reads it. Evidence `NN-api-decks-open.json`.
- **Clear.** Go to `/version`, clear `localStorage` and `sessionStorage`, delete every IndexedDB database from `indexedDB.databases()`, and remove every entry in the origin's file system.
- **Reopen.** Open `/deck/<id>`. Evidence `NN-reopened-cleared`. The text box must read `Kept on the server` and the element count must match.

## Gotchas

- In `tests/journeys/journeys.spec.ts` this journey is marked `test.fail()`, so the suite stays green while the bug lives, and `scripts/metrics.mjs` counts it as a known failure. The fix flips it by removing `test.fail()`. If it starts passing before then, the suite fails and says so.
- Observed 2026-11-11 at `641af152`: the reopened deck shows an empty slide with page number `1`.
