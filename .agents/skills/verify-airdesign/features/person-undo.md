# Undo and redo the person's edits

The person's own edits in an open deck can be undone and redone: text and table cells, speaker notes, moves, resizes, added and deleted elements, inserted tables and pictures, table rows and slide changes. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, and the two buttons in the toolbar do the same and name the step they would take. An undo of something that changed since, for example by an agent, changes nothing and says so.

## Sub-features

- `undo-names` the toolbar buttons read `Undo` and `Redo` when there is nothing to take, and otherwise name the step: `Undo text edit`, `Undo speaker notes edit`, `Undo move`, `Undo resize`, `Undo add text box`, `Undo add table`, `Undo add picture`, `Undo delete element`, `Undo add row`, `Undo delete row`, `Undo new slide`, `Undo duplicate slide`, `Undo delete slide`, `Undo slide order`, with matching `Redo` names (`apps/web/src/copy/undo-copy.ts`).
- `undo-keys` Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. The keys go to the person's undo everywhere, the slide's text included, except form fields (`input`, `textarea`, `select`), which keep the browser's own undo (`apps/web/src/editor/undo-keys.ts`). The speaker notes field is a `textarea`, so there the keys undo the browser's typing and the toolbar button takes the notes step.
- `undo-typing` one Ctrl/Cmd+Z straight after typing over a text, with the caret still in the box, brings the old text back and keeps the caret there; the typing session is one step (PR 427). A table cell takes the same path: one Ctrl/Cmd+Z straight after typing in a new table's first cell takes the typing back and keeps the table, and the focused cell paints the text from before the edit (`tests/browser/table-edits.spec.ts`).
- `undo-paint` an undone move paints the box back at once and the server gets the box row; an undone text edit repaints the slide and its thumbnail at once (states `text-undone`, `text-undone-in-box`).
- `undo-elements` an undone add takes the element away and an undone delete brings it back (`element-remove` and `element-restore` rows); an inserted table or an added picture undo and redo the same way, and a reload keeps the result. A deck whose edits were all undone exports untouched (`tests/browser/undo-export.spec.ts`).
- `undo-refused` when the element changed after the person's edit, the undo leaves it and the editor shows `Unable to undo. This changed after your edit, so it stays as it is.` (`Unable to redo. This changed after your undo, so it stays as it is.` for a redo).
- `undo-separate` a box and a text are separate: after an agent changes the text, the person can still undo their move of the same element.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the two curved-arrow buttons in the toolbar under the slide.
- The keys, in a text box, on a selected frame or on a slide entry.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> person-undo`. Prints `"passed":true`.
- **Edit and move.** Import `clean.pptx`, replace the text with `Mine`, Escape, Shift+ArrowRight. `Undo move` is enabled. Evidence `NN-edited-and-moved`.
- **Undo and redo a move.** Ctrl/Cmd+Z puts the box back and `Redo move` shows; the `Redo move` button moves it again. Evidence `NN-undone-and-redone`.
- **Refused.** Change the text over MCP (`airdesign_read_deck`, then `airdesign_edit_deck` with `readAt`). The slide reads `Agent`. `Undo move` still works; `Undo text edit` shows `Unable to undo…` and the text stays `Agent`. Evidence `NN-unable-to-undo`.
- **Slides and elements.** `slide-commands` undoes and redoes a slide delete. `tests/browser/person-undo.spec.ts` covers a move, a text edit, a slide delete through a reload and undo straight after typing; `person-undo-elements.spec.ts` covers added and deleted elements and notes; `table-edits.spec.ts` and `picture-add.spec.ts` the insert of a table and a picture.
- **Table seam.** Driven live on 2026-11-13 with a scratch journey: insert a table, type `Region` with no delay and press Ctrl/Cmd+Z at once: no table is left and only `Redo add table` is offered; its Redo paints the table with `R`. Typed at 60 ms a key and recorded first, Ctrl/Cmd+Z leaves `Region` painted in the focused cell while the buttons read `Undo add table` and `Redo text edit`; Escape repaints it empty, and a reload and a fresh device agree on the empty cell.
- **Undo, then reload.** Typing ` again`, Ctrl/Cmd+Z once the box read the old text, and a reload with no wait kept the old text on the device and the server, five times out of five.

- **Slide deletion toast.** Driven live on 2026-11-17: Undo remains after 10.5 seconds and restores the slide; Close dismisses without restoring it. Undo and Close fit without overlap at 320, 480 and 735 CSS px (200% reflow equivalent, not native browser zoom). Regression: `tests/browser/toast-layout.spec.ts`.

## Gotchas

- Press Escape after typing to give the frame focus when you want the next key to act on the element, such as Delete or an arrow.
- `button "Undo"` with `exact: true` is the disabled button with nothing to take; the enabled one carries the step's name.
- Wait for the screen to show the undo before you reload. A reload sent before the undo painted keeps the typing, which no person can do faster than the paint.
