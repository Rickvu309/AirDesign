# Reopen a saved deck in a cleared browser

A person saves an edit, then their browser loses everything AirDesign stored on the device: IndexedDB, local storage and site files. When they open the deck again, the slide shows its content and their edit: the editor sends the original file to the server (`deckRoutes.originalUpload`, then `originalDone`) after it opens the deck, and again when the browser is back online, and a deck whose parts are not on the device is rebuilt from `deckRoutes.original` with the saved edits painted over it. When the server has no original for the deck, or answers `owner`, `deleted` or `deck`, the editor shows the not-found page (`Deck not found`, `link "Go to your decks"`, no editor). When the rebuild fails for another reason (offline, a size or hash mismatch), the editor shows an empty slide with the notice `Unable to open this deck` and `Go to your decks`.

## Sub-features

- `cleared-reopen-text` the edited text box reads the text the server kept.
- `cleared-reopen-paint` the slide paints as many elements as it did before the browser was cleared.
- `cleared-rebuilding` while it rebuilds there is no loading text: an empty slide area, a blank title and slide label `1`. A browser that was not cleared paints its device copy first instead (`keep-typed-text.md`). `.thin-page` gets `data-deck-ready` once the deck is ready.
- `cleared-failed` a rebuild that fails for a reason other than a missing deck shows `Unable to open this deck` with `button "Go to your decks"`, which goes to `/`. Signed out, the editor sends the person to sign-in with `?next=` the deck address instead (`sign-in.md`, `signin-deck`).
- `cleared-no-edits` if the original downloads but `deckRoutes.open` fails, the plain original shows without the edits and without a notice.

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

- The upload runs from the editor after the deck opens, not during the import. A browser cleared before it lands loses the original, and that deck shows `Deck not found`. Poll `deckRoutes.original` for `ok: true` before clearing.
- `[data-canvas-element]` also matches the slide-list thumbnails. Count `[data-slide-paint] [data-canvas-element]`.
- Fixed 2026-11-11: before, the web app never sent the original, so the reopened deck showed an empty slide with page number `1`.
