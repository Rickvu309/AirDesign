# Add a text box and delete an element

In an open deck, `Add text box` in the toolbar puts a new text box in the middle of the slide with the caret in it, ready to type. A selected element is deleted with Delete or Backspace. Both paint at once, reach the server as element rows, survive a reload and are written by the export.

## Sub-features

- `element-add` `button "Add text box"` adds a box, selects it and focuses its text. The server's `register.order` gets one row with `slide: "element-add"`.
- `element-type` text typed into the new box reaches the server like any text edit.
- `element-remove` Delete or Backspace on a selected frame, outside its text and with no modifier key, removes the element. The server gets one `slide: "element-remove"` row. While the caret is in the text, the keys edit the text instead.
- `element-export` the export keeps the added box and drops the deleted one, and a new import of that file shows the same slide.
- Adding a text box and deleting an element are not on the person's undo list today: no `Undo` names them (`apps/web/src/copy/undo-copy.ts`).

## How to get to it (user POV)

- An open deck `/deck/<id>`: the `Add text box` button in the toolbar under the slide.
- Click an element, press Escape to leave its text, then Delete.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> element-edits`. Prints `"passed":true`.
- **Blank deck.** `New deck` > `Blank deck`. Two `[data-slide-paint] [contenteditable="true"]`. Evidence `NN-before-add`.
- **Add.** Click `button "Add text box"`. Three boxes, the last one focused. Evidence `NN-added-box`. Type `Added text`; poll `deckRoutes.open` for one `element-add` row and the text. Evidence `NN-added-text`.
- **Delete.** Reload, click the title, Escape, Delete. Two boxes; poll for one `element-remove` row. Evidence `NN-deleted-element`.
- **Reload, export, import.** The deleted title stays gone and `Added text` stays. Evidence `NN-reloaded`, `NN-reimported`.

## Gotchas

- Delete inside the text deletes characters. Press Escape first so the frame, not the text, has focus.
- Count text boxes inside `[data-slide-paint]`; the slide list's thumbnails paint text too.
