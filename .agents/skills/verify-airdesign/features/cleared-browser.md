# Reopen a saved deck in a cleared browser

A person saves an edit, then their browser loses everything AirDesign stored on the device: IndexedDB, local storage and site files. When they open the deck again, the slide shows its content and their edit: import sends the original file to the server (`deckRoutes.originalUpload`, then `originalDone`), and a deck whose parts are not on the device is rebuilt from `deckRoutes.original` with the saved edits painted over it. A deck with no stored original shows the import notice instead of an empty slide.

## Sub-features

- `cleared-reopen-text` the edited text box reads the text the server kept.
- `cleared-reopen-paint` the slide paints as many elements as it did before the browser was cleared.

## How to get to it (user POV)

- Open a deck, edit it, clear site data in the browser (or open it on a second device), then open `/deck/<id>` again.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists.

- **Run it.** `$V journey <run> cleared-browser`. It prints `"passed":true`.
- **Import and edit.** Import `clean.pptx` from Home, count `[data-canvas-element]`, type `Kept on the server`, and poll `post(deckRoutes.open, { deck })` until the register reads it. Evidence `NN-api-decks-open.json`. Then poll `post(deckRoutes.original, { deck })` until it answers `ok: true`, so the original is on the server before the browser is cleared.
- **Clear.** Go to `/version`, clear `localStorage` and `sessionStorage`, delete every IndexedDB database from `indexedDB.databases()`, and remove every entry in the origin's file system.
- **Reopen.** Open `/deck/<id>`. Evidence `NN-reopened-cleared`. The text box must read `Kept on the server` and the element count must match.

## Gotchas

- The upload runs after import, before Home opens the deck. A browser cleared before it lands loses the original, and that deck shows the import notice.
- Fixed 2026-11-11: before, the web app never sent the original, so the reopened deck showed an empty slide with page number `1`.
