# Add a text box and delete an element

In an open deck, `Add text box` in the toolbar puts a new text box in clear space on the slide with the caret in it, ready to type. A selected element is deleted with Delete or Backspace. Both paint at once, can be undone, are said aloud to a screen reader, reach the server as element rows, survive a reload and are written by the export. Aira and an outside agent add and delete elements with the same rows.

## Sub-features

- `element-add` `button "Add text"` adds a box where the slide has room for it (`placeNewBox` in `packages/document`; centred when no free area fits), selects it and focuses its text. The server's `register.order` gets one row with `slide: "element-add"`. Known failure: letters typed before the new box takes focus, about 70 to 110 ms after the click or Enter, are lost, so a keyboard user who presses Enter on `Add text box` and types at once loses the first letters (`ped fast` for `Typed fast` at 80 ms a key); pinned in `tests/browser/element-edits.spec.ts`.
- `element-type` text typed into the new box reaches the server like any text edit.
- `text-tool-place` T or Add text arms the Text tool. A click places text at the click; until its first character it lives only in the tab. Escape or a click away with no characters removes it, with no undo step and no `element-add` on the server, and focus stays on the slide so T works again. A drag snaps both corners to layers, the slide, ruler guides and layout grid lines within 4.5 screen pixels with red guides; Control held lets them go.
- `element-remove` Delete or Backspace on a selected frame, outside its text and with no modifier key, removes the element. The server gets one `slide: "element-remove"` row. While the caret is in the text, the keys edit the text instead. An animated shape or a group is not removed: a toast says why and no undo step is recorded.
- `element-undo` `Undo add text box` takes the box away and `Undo delete element` brings the element back (see `person-undo.md`).
- `element-said` after each paint the canvas's `[role="status"]` says `<name> added` or `<name> deleted`, by the name the keyboard uses, and nothing for a refused delete. A change of slide says `Slide N of M` and does not say the elements of the slide left behind were deleted.
- `element-agent` `airdesign_edit_deck` with `add` and `delete` changes land the same rows; run Undo takes them back (see `aira-turn.md`).
- `element-export` the export keeps the added box and drops the deleted one, and a new import of that file shows the same slide.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the `Add text box` button in the toolbar under the slide.
- Click an element, press Escape to leave its text, then Delete.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> element-edits`. Prints `"passed":true`.
- **Blank deck.** `New deck` > `Blank deck`. Two `[data-slide-paint] [contenteditable="true"]`. Evidence `NN-before-add`.
- **Add.** Click `button "Add text"`. Three boxes, the last one focused. Evidence `NN-added-box`. Type `Added text`; poll `deckRoutes.open` for one `element-add` row and the text. Evidence `NN-added-text`.
- **Delete.** Reload, click the title, Escape, Delete. Two boxes; poll for one `element-remove` row. Evidence `NN-deleted-element`.
- **Reload, export, import.** The deleted title stays gone and `Added text` stays. Evidence `NN-reloaded`, `NN-reimported`.
- **States for look.** `element-added`, `element-deleted`, `text-drag-snap-held`.
- **Text tool.** `$V journey <run> text-tool-place`. Evidence `NN-text-placed-empty`, `NN-empty-text-removed`, `NN-text-drag-snapped` (two red guides), `NN-text-drag-control-held` (none), `NN-text-drawn-snapped`; `deckRoutes.open` shows no `element-add` until the first character, then one per kept text.
- **First letters and the announcement.** Driven live on 2026-11-13 with scratch journeys: typing `Offline box` at 20 ms a key right after the click showed `ffline box` or `fline box` four times out of four, online and offline; waiting 150 ms first kept every letter. `Add slide` says `Slide 2 of 2` on the canvas and `Added slide 2` on the slide list. It does not say the previous slide's elements were deleted.

## Gotchas

- Delete inside the text deletes characters. Press Escape first so the frame, not the text, has focus.
- Count text boxes inside `[data-slide-paint]`; the slide list's thumbnails paint text too. A table's cells (`[data-table-text]`) are `contenteditable` as well, so a count of `[contenteditable="true"]` on a slide with a table includes them.
- Wait for the new box to be focused before typing into it.
