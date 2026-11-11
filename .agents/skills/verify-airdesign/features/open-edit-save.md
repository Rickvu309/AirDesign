# Open a PowerPoint and edit its text

A signed-in person chooses a PowerPoint file on Home. AirDesign opens it as a new deck at `/deck/<id>`, shows its slide, and lets the person type into a text box. The edit paints at once, reaches the server, and is there when the deck is opened again.

## Sub-features

- `import-open` choosing a `.pptx` on Home opens it at `/deck/<id>` and shows its text.
- `import-name` the new deck takes the file name (`clean.pptx`) through `deckRoutes.rename`.
- `edit-text` typing replaces the text box's text on screen.
- `edit-save` the edit lands on the server: `deckRoutes.open` returns the typed text.
- `edit-reopen` with the local edit rows gone, opening the deck again shows the server's text.
- `import-refused` a file that is not a PowerPoint shows `Unable to import` with `Choose another file` and `Remove`.

## How to get to it (user POV)

- Home `/`: the file input behind `New deck` > `Import PowerPoint`.
- Home `/` on a first visit: drop or choose a file on the empty state.
- An open deck: click the text box on the slide and type.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists.

- **Run it.** `$V journey <run> open-edit-save`. Prints `"passed":true` and the evidence dir.
- **Sign in.** `signIn()` signs a new account in through the emailed code. Home shows `button "New deck"`. Evidence `01-home-signed-in`.
- **Import.** `page.locator("input[type=file]").setInputFiles(<repo>/scripts/pptx-fixtures/clean.pptx)`. The URL becomes `/deck/<id>` and `[contenteditable="true"]` reads `Hello`. Evidence `02-imported`.
- **Type.** Click the text box, select all, type `Saved on the server`. The box shows it. Evidence `03-typed`.
- **Server copy.** Poll `post(deckRoutes.open, { deck })` until the register's visible text is `["Saved on the server"]`. Evidence `NN-api-decks-open.json`.
- **Listed.** `post(deckRoutes.list, {})` lists the deck. Evidence `NN-api-decks-list.json`.
- **Reopen.** Go to `/version` on the same origin, delete every IndexedDB `airdesign` row that has a `kind` (the local edit rows), then open `/deck/<id>`. The text box reads `Saved on the server`. Evidence `NN-reloaded-from-server`.
- **Refused import.** Not in the journey. In a scratch journey, set a file named `broken.pptx` with bytes `broken` on the Home file input. `Unable to import` is visible; `Remove` clears it.

## Gotchas

- The editor paints before the network. A typed screen is not proof of a save. Wait for `deckRoutes.open` to return the text.
- Deleting the whole `airdesign` IndexedDB database and reopening the deck rebuilds it from the original the server keeps, with the saved edits on top. The `cleared-browser` journey proves it; see `cleared-browser.md`.
- The deck id is a UUID taken from the URL after import. Read it from `page.url()`.
- Typing uses `pressSequentially` with a 50 ms delay, as the repo's `tests/browser/real-save.spec.ts` does; `fill` does not go through the editor's input path.
