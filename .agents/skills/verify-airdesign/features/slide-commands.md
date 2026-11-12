# Add, duplicate, move and delete slides

The slide list on the left of an open deck lists every slide. The person adds a slide with the `Add slide` button, and, on a focused slide entry, duplicates it with Ctrl/Cmd+D, moves it with Alt+ArrowUp or Alt+ArrowDown (or by dragging), and deletes it with Delete or Backspace. Each change paints at once, can be undone, reaches the server as a slide order row and survives a reload and the export.

## Sub-features

- `slide-add` `button "Add slide"` adds a slide after the current one with the layout's empty title and body, and opens it. The new slide takes typed text.
- `slide-duplicate` Ctrl/Cmd+D on a focused `[data-slide-entry]` adds a copy after it and makes the copy current. The copy keeps the text the slide had when it was made.
- `slide-move` Alt+ArrowUp or Alt+ArrowDown on a focused entry moves that slide one place, and the moved slide becomes current. Dragging an entry onto another moves it there.
- `slide-delete` Delete or Backspace on a focused entry deletes that slide.
- `slide-undo` each change is on the person's undo list: `Undo new slide`, `Undo duplicate slide`, `Undo slide order`, `Undo delete slide`, and the matching `Redo` names. See `person-undo.md`.
- `slide-sections` in a deck with sections, a new or duplicated slide joins the section of the slide it comes after, sections follow moves and deletes, and the export writes them back (`tests/browser/slide-sections.spec.ts`).
- `slide-saved` the server's `register.order` gets `add`, `clone`, `move` and `remove` rows (`restore` for an undone delete).

## How to get to it (user POV)

- An open deck `/deck/<id>`: the `+` button (`Add slide`) at the top of the slide list.
- Click a slide in the list, then the keys.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> slide-commands`. Prints `"passed":true`.
- **Add and type.** `New deck` > `Blank deck`, click `Add slide`, type `Second slide` in the new title. Evidence `NN-added-and-typed`.
- **Duplicate.** Click entry 2, press Ctrl/Cmd+D. Three entries; entry 3 reads `Second slide`. Evidence `NN-duplicated`.
- **Move.** Click entry 3, Alt+ArrowUp; then click entry 2, Alt+ArrowUp. Entry 1 reads `Second slide`. Evidence `NN-moved-to-top`.
- **Delete, undo, redo.** Click entry 1, Delete; `Undo delete slide` is enabled. Ctrl/Cmd+Z brings it back; `Redo delete slide` deletes it again. Evidence `NN-deleted`, `NN-undone-and-redone`.
- **Server and reload.** Poll `deckRoutes.open` until `register.order` holds `add`, `clone` and `remove`; reload shows two slides. Evidence `NN-reloaded`.
- **Export.** Not in this journey. `blank-slides` exports a deck with an added slide and checks every untouched part; `tests/browser/slide-edits.spec.ts` checks a duplicate and an added slide through the export.

## Gotchas

- After Alt+ArrowUp the moved slide becomes current, but keyboard focus stays on the same place in the list, now another slide. Click the moved slide before the next key, or the next key moves the other slide.
- An entry's text is its thumbnail's text plus its number, so `toContainText` works and `toHaveText` does not.
