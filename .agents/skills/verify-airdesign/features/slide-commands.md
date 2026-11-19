# Add, duplicate, move and delete slides

The slide list on the left of an open deck lists every slide. The person adds a slide with the `Add slide` button, and, on a focused slide entry, duplicates it with Ctrl/Cmd+D, moves it with Alt+ArrowUp or Alt+ArrowDown (or by dragging), and deletes it with Delete or Backspace. Each change paints at once, can be undone, reaches the server as a slide order row and survives a reload and the export.

## Sub-features

- `grid-group-add` Hover or focus below a Grid slide group to preview a dashed line at the first column. Below the last slide group a full slide outline appears if it fits. Click or press Enter to add one slide in its own slide group and select it. At small zoom use New slide. At 50 slides the inline controls are removed. Journey `grid-group-add`; browser `grid-group-add.spec.ts` also covers touch, editing and offline Undo.
- `slide-add` `button "Add slide"` adds a slide after the current one with the current slide's layout (the deck's content layout after a title slide), and opens it. The new slide takes typed text.
- `slide-layout` the chevron beside `New slide` (`button "Choose a layout for the new slide"`) lists the deck's layouts by the names in the file. Choosing one adds a slide after the current one with that layout's placeholders. `Add slide` uses the current slide's layout, and the deck's content layout after a title slide. Journey `slide-layouts`.
- `slide-duplicate` Ctrl/Cmd+D on a focused `[data-slide-entry]` adds a copy after it and makes the copy current. The copy keeps the text the slide had when it was made.
- `slide-move` Alt+ArrowUp or Alt+ArrowDown on a focused entry moves that slide one place, and the moved slide becomes current. Dragging an entry onto another moves it there.
- `slide-delete` Delete or Backspace on a focused entry deletes that slide.
- `slide-focus` after an add with `Add slide`, a duplicate, a move or a delete, keyboard focus moves to the entry of the slide that is now current, so the next key acts on it. Choosing from the layout menu does not move focus. `tests/browser/slide-focus.spec.ts`.
- `slide-undo` each change is on the person's undo list: `Undo new slide`, `Undo duplicate slide`, `Undo slide order`, `Undo delete slide`, and the matching `Redo` names. See `person-undo.md`.
- `slide-sections` in a deck with sections, a new or duplicated slide joins the section of the slide it comes after, sections follow moves and deletes, and the export writes them back (`tests/browser/slide-sections.spec.ts`).
- `slide-saved` the server's `register.order` gets `add`, `clone`, `move` and `remove` rows (`restore` for an undone delete). Known failure: when the answer to that commit is lost, the deck stops opening on this browser from the second reload on (`lost-answer` in `keep-typed-text.md`).
- `slide-said` the slide list's status says what a command did, such as `Added slide 2`. The canvas says `Slide N of M` for the slide it now shows, not `<name> deleted` for each element of the slide left behind (`element-said` in `element-edits.md`).

## How to get to it (user POV)

- An open deck `/deck/<id>`: the `+` button (`Add slide`) at the top of the slide list.
- Click a slide in the list, then the keys.
- Open Grid, then the round plus below the first slide of a row. Tab reaches it. Escape returns to the originating slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Grid slide group.** `$V journey <run> grid-group-add` imports ten slides, previews without saving, adds an interior slide group, reads the server’s semantic anchor and folded slide groups, undoes, redoes and reloads. It then adds a slide group in a deck with named PowerPoint sections and checks that the section markers remain separate.
- **Run it.** `$V journey <run> slide-commands`. Prints `"passed":true`.
- **Add and type.** `New deck` > `Blank deck`, click `Add slide`, type `Second slide` in the new title. Evidence `NN-added-and-typed`.
- **Duplicate.** Click entry 2, press Ctrl/Cmd+D. Three entries; entry 3 reads `Second slide`. Evidence `NN-duplicated`.
- **Move.** Click entry 3, Alt+ArrowUp; then click entry 2, Alt+ArrowUp. Entry 1 reads `Second slide`. Evidence `NN-moved-to-top`.
- **Delete, undo, redo.** Click entry 1, Delete; `Undo delete slide` is enabled. Ctrl/Cmd+Z brings it back; `Redo delete slide` deletes it again. Evidence `NN-deleted`, `NN-undone-and-redone`.
- **Server and reload.** Poll `deckRoutes.open` until `register.order` holds `add`, `clone` and `remove`; reload shows two slides. Evidence `NN-reloaded`.
- **Export.** Not in this journey. `blank-slides` exports a deck with an added slide and checks every untouched part; `tests/browser/slide-edits.spec.ts` checks a duplicate and an added slide through the export.

## Gotchas

- Focus follows the current slide after every slide command, so two Alt+ArrowUp presses in a row move the same slide twice. The journey still clicks an entry before each key; that proves the key, not the focus.
- A slide that holds a chart or a diagram duplicates, moves and deletes like any other; `slide-charts` drives it.
- An entry's text is its thumbnail's text plus its number, so `toContainText` works and `toHaveText` does not.
