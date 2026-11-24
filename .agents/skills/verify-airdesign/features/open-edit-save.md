# Start a deck and edit its text

A signed-in person presses `New deck` on Home and AirDesign opens a new deck at `/s/<id>` with one slide holding a title. The person edits the title or places a text layer and types; the edit paints at once, reaches the server through `doomRoutes.edit`, and is there when the deck is opened again.

## Sub-features

- `new-deck` `button "New deck"` on Home, or `Blank deck` on the `No decks yet` card, goes to `/s`, which creates the deck with `doomRoutes.create` and replaces the address with `/s/<id>` (`DoomEditor` in `apps/web/src/editor/doom-editor.tsx`). The deck is named `Blank deck` and its slide holds a title (`s:4` in a new deck) and a subtitle. `[data-doom-ready]` marks the open editor.
- `deck-name-follows-title` while the deck is still named `Blank deck`, or its name still matches slide 1's title, an edit to slide 1's title renames the deck in the same edit and the same undo step (`nameFromTitleWrites` in `packages/doom/src/deck-name-from-title.ts`). A name the person typed is kept.
- `edit-text` a double-click on a text layer edits it where it was clicked; Enter on a selected text layer edits it with all its words selected; Escape leaves the text and keeps the layer selected. Emptying a text layer removes it, and one undo brings it back (`tests/browser/doom-editor-text.spec.ts`).
- `text-tool` T (the Text tool) and a click places a text layer that grows with its words; a drag draws a fixed box. A text layer left empty leaves nothing behind.
- `edit-format` while words are selected, `toolbar "Text formatting"` offers a style menu (`Title`, `Heading`, `Body` and others), `Bold`, `Italic`, `Underline`, bullets and numbers; `aria-pressed` shows each mark's state. Ctrl/Cmd+B, I and U, Ctrl/Cmd+Shift+X for strikethrough, Ctrl/Cmd+Alt+L, T, R and J for alignment, and Ctrl/Cmd+Shift+8 and 7 for bullets and numbers do the same (`tests/browser/doom-text-format.spec.ts`). The span is stored with `bold`, `italic` or `underline`. Look states `text-format-bold`, `text-format-align`, `text-format-bullets`.
- `edit-save` the edit lands on the server: `doomRoutes.open` answers a fold whose text node holds the typed words.
- `edit-reopen` a reload, or another browser of the same account, opens the deck with the saved text.

## How to get to it (user POV)

- Home `/`: `New deck` in the sidebar, or `Blank deck` on the `No decks yet` card.
- An open deck: double-click the title on the slide and type, or press T and click the slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Specs.** `pnpm test:browser tests/browser/doom-editor.spec.ts tests/browser/doom-editor-text.spec.ts tests/browser/doom-text-format.spec.ts` opens a new deck, edits and formats its text, and reads each saved node from `doomRoutes.open`.
- **In a scratch journey.** `signIn()`, then on `/` click `button "New deck"` and wait for `[data-doom-ready]` (`newDoomDeck` in `../bin/new-deck.mjs`). Read the deck id from `page.url()` (`/s/<id>`).
- **Type.** Double-click the title, press Ctrl/Cmd+A, type `Saved on the server` with `pressSequentially`, press Escape. Evidence `NN-typed`.
- **Server copy.** Poll `post(doomRoutes.open, { deck }, cookie)` until the title node in `json.fold.nodes` has `text.chars` `Saved on the server`. Evidence `NN-api-doom-open.json`.
- **Listed.** `post(deckRoutes.list, {}, cookie)` lists the deck with its `doom` revision and the name `Saved on the server`, which followed the title.
- **Reopen.** Reload, wait for `[data-doom-ready]`; the title reads `Saved on the server`.
- **States for look.** `blank-deck`, `editor-text-focused`, `text-typed-at-once`, `text-format-bold`.

## Gotchas

- The editor paints before the network. A typed screen is not proof of a save. Wait for `doomRoutes.open` to answer the text.
- Poll the server after Escape, once the person has left the text.
- Typing uses `pressSequentially` or `keyboard.type`; `fill` does not go through the editor's input path.
- Painted layers are `[data-slide-box] [data-node="<id>"]`; the text being edited is `[data-slide-box] [contenteditable="true"]`.
