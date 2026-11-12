# Undo and redo the person's edits

The person's own edits in an open deck can be undone and redone: text edits, moves, resizes and slide changes. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, and the two buttons in the toolbar do the same and name the step they would take. An undo of something that changed since, for example by an agent, changes nothing and says so.

## Sub-features

- `undo-names` the toolbar buttons read `Undo` and `Redo` when there is nothing to take, and otherwise `Undo text edit`, `Undo move`, `Undo resize`, `Undo new slide`, `Undo duplicate slide`, `Undo delete slide`, `Undo slide order`, with matching `Redo` names (`apps/web/src/copy/undo-copy.ts`).
- `undo-keys` Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. The keys do nothing while focus is in text, where the browser's own text undo applies. Known failure: Ctrl/Cmd+Z straight after typing over a text leaves the first typed letter (typing `Mine` over `Kept` and pressing Ctrl/Cmd+Z shows `M`, and Escape saves `M`); only a second Ctrl/Cmd+Z, after Escape, brings `Kept` back. Pinned in `tests/browser/person-undo.spec.ts`.
- `undo-paint` an undone move paints the box back at once and the server gets the box row; an undone text edit repaints the slide and its thumbnail at once (state `text-undone`).
- `undo-refused` when the element changed after the person's edit, the undo leaves it and the editor shows `Unable to undo. This changed after your edit, so it stays as it is.` (`Unable to redo. This changed after your undo, so it stays as it is.` for a redo).
- `undo-separate` a box and a text are separate: after an agent changes the text, the person can still undo their move of the same element.
- Not on the list: adding a text box and deleting an element.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the two curved-arrow buttons in the toolbar under the slide.
- The keys, with a frame or a slide entry focused, not the text.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> person-undo`. Prints `"passed":true`.
- **Edit and move.** Import `clean.pptx`, replace the text with `Mine`, Escape, Shift+ArrowRight. `Undo move` is enabled. Evidence `NN-edited-and-moved`.
- **Undo and redo a move.** Ctrl/Cmd+Z puts the box back and `Redo move` shows; the `Redo move` button moves it again. Evidence `NN-undone-and-redone`.
- **Refused.** Change the text over MCP (`airdesign_read_deck`, then `airdesign_edit_deck` with `readAt`). The slide reads `Agent`. `Undo move` still works; `Undo text edit` shows `Unable to undo…` and the text stays `Agent`. Evidence `NN-unable-to-undo`.
- **Slides.** `slide-commands` undoes and redoes a slide delete. `tests/browser/person-undo.spec.ts` covers a move, a text edit and a slide delete through a reload.

## Gotchas

- Press Escape after typing so the frame has focus; otherwise the keys go to the text.
- `button "Undo"` with `exact: true` is the disabled button with nothing to take; the enabled one carries the step's name.
