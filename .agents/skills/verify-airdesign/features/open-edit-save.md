# Open a PowerPoint or a blank deck and edit its text

A signed-in person chooses a PowerPoint file on Home, or starts a blank deck. AirDesign opens it as a new deck at `/deck/<id>` as soon as the deck is on the device, shows its slide, and lets the person type into a text box. The edit paints at once, reaches the server, and is there when the deck is opened again.

## Sub-features

- `import-open` choosing a `.pptx` on Home shows an `Importing` card, then opens `/deck/<id>` and shows its text as soon as the deck's parts are saved in the browser. The server's copy, the name and the original file are sent from the editor afterwards (`flushOriginal` in `apps/web/src/thin-deck.tsx`).
- `import-name` the new deck takes the file name without `.pptx` (`clean` for `clean.pptx`), queued on the device. The editor sends it with `deckRoutes.rename` after the deck opens; Home sends it too when the editor's request was cut off (see `deck-names.md`).
- `blank-deck` `New deck` > `Blank deck` (in `menu "New deck"`, a `menuitem`, or the `No decks yet` card's own button) opens a one-slide deck named `Blank deck` with an empty title and subtitle, painted with the prompts `Add a title` and `Add a subtitle`. It works offline and reaches the server when the browser is back online. Journey `blank-deck`.
- `commit-once` when the server stores an edit but its answer is lost, a reload sends the same batch with the same `once` key and the revision rises once. Journey `commit-once`, for text. Known failure for a slide command: see `lost-answer` in `keep-typed-text.md`.
- `import-index` an agent reads untouched element ids, kinds, text, boxes, slide order and version zero before making an edit.
- `edit-text` typing replaces the text box's text on screen.
- `edit-format` while text is selected, `group "Text format"` offers `Bold`, `Italic` and `Underline` (`aria-pressed` shows the state); the run paints at once and the server's text value gets `bold`, `italic` and `underline` on the run. Driven live: all three on `Hello` paint as weight 700, italic and underlined and stay through a reload; the server had bold and italic at once and underline about 5 s later. Look state `text-format-bold`.
- `edit-save` the edit lands on the server: `deckRoutes.open` returns the typed text.
- `edit-reopen` with the local edit rows gone, opening the deck again shows the server's text.
- `import-refused` a file that is not a PowerPoint shows `Unable to open this file` with the next step under it, `Choose another file` and `Remove`. Each refusal has its own words in `apps/web/src/copy/import-failure-words.ts`.

## How to get to it (user POV)

- Home `/`: the file input behind `New deck` > `Import PowerPoint`.
- Home `/` with no decks, on a first visit or with something in Trash: the `No decks yet` card has `Blank deck` and `Import PowerPoint`. There is no drop target.
- An open deck: click the text box on the slide and type.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists.

- **Run it.** `$V journey <run> open-edit-save`. Prints `"passed":true` and the evidence dir.
- **Agent read.** `$V journey <run> element-index` imports from Home, reads the untouched deck over MCP, edits using `readAt: 0`, then checks the same ids, boxes and edited text after clearing device storage.
- **Sign in.** `signIn()` signs a new account in through the emailed code. Home shows `button "New deck"`. Evidence `01-home-signed-in`.
- **Import.** `page.locator("input[type=file]").setInputFiles(<repo>/scripts/pptx-fixtures/clean.pptx)`. The URL becomes `/deck/<id>` and `[contenteditable="true"]` reads `Hello`. Evidence `02-imported`.
- **Type.** Click the text box, select all, type `Saved on the server`. The box shows it. Evidence `03-typed`.
- **Server copy.** Poll `post(deckRoutes.open, { deck })` until the register's visible text is `["Saved on the server"]`. Evidence `NN-api-decks-open.json`.
- **Listed.** `post(deckRoutes.list, {})` lists the deck. Evidence `NN-api-decks-list.json`.
- **Reopen.** Go to `/version` on the same origin, delete every IndexedDB `airdesign` row that has a `kind` (the local edit rows), then open `/deck/<id>`. The text box reads `Saved on the server`. Evidence `NN-reloaded-from-server`.
- **Blank deck.** `$V journey <run> blank-deck` creates a blank deck offline, types the title, reconnects, and checks the server copy, a reload, a cleared browser and the export.
- **Commit once.** `$V journey <run> commit-once` drops the answer to one `deckRoutes.commit` and checks the resend after a reload.
- **Refused import.** Not in the journey. In a scratch journey, set a file named `broken.pptx` with bytes `broken` on the Home file input. `Unable to open this file` is visible; `Remove` clears it.

## Gotchas

- The editor paints before the network. A typed screen is not proof of a save. Wait for `deckRoutes.open` to return the text.
- Deleting the whole `airdesign` IndexedDB database and reopening the deck rebuilds it from the original the server keeps, with the saved edits on top. The `cleared-browser` journey proves it; see `cleared-browser.md`.
- The deck id is a UUID taken from the URL after import. Read it from `page.url()`.
- Adding a text box, deleting an element and undo are separate features: `element-edits.md` and `person-undo.md`.
- Typing uses `pressSequentially` with a 50 ms delay, as the repo's `tests/browser/real-save.spec.ts` does; `fill` does not go through the editor's input path.
