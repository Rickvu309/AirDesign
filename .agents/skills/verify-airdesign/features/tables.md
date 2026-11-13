# Insert and edit a table

In an open deck, `Actions` > `Table` inserts a three by three table in clear space on the slide with the caret in its first cell. The person types in the cells, moves between them with Tab, adds and deletes rows from the bar over the table, and deletes the whole table from its frame. Each change paints at once, can be undone, reaches the server, survives a reload and is written by the export. A table imported with the deck is edited the same way.

## Sub-features

- `table-insert` `button "Actions"` opens a menu whose `menuitem "Table"` is the only enabled item. The table, 60% of the slide wide and three rows tall, lands where the slide has room (`placeNewBox`), and `[data-table-text="0.0"]` has focus. The server gets one `slide: "element-add"` row with `element.kind: "table"`.
- `table-type` text typed in a cell paints at once and its thumbnail follows; the table's value reaches the server as one element value (`{"rows":...}`). Tab and Shift+Tab move between cells; Tab in the last cell adds a row and enters it.
- `table-rows` while a cell has focus, `toolbar "Table rows"` offers `Add row above`, `Add row below` and `Delete row` (disabled on a one-row table).
- `table-delete` Escape leaves the cell for the table's frame; Delete then removes the whole table.
- `table-undo` `Undo add table`, `Undo text edit` for a cell, `Undo add row`, `Undo delete row`, and their Redo names (see `person-undo.md`). Known failures, pinned in `tests/browser/table-edits.spec.ts`: one Ctrl/Cmd+Z straight after typing in a new table's first cell takes the whole table away, and its Redo brings it back with only the first letter; a later Ctrl/Cmd+Z with the caret still in the cell takes the text back everywhere but in the cell, which keeps showing it until Escape.
- `table-reload` known failure: text typed in a cell and reloaded at once comes back with only its first letter; pinned in `tests/browser/keep-typed-text.spec.ts`.
- `table-size` a table is not resizable, by pointer or by keys.
- `table-export` the export writes the table's rows and cells; the frame's height is the sum of its rows.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the `Actions` button in the toolbar under the slide, then `Table`. From the keyboard: Tab to `Actions` (8 Tabs from the first slide entry of `clean.pptx`), Enter, ArrowDown to `Table`, Enter.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Specs.** No shipped journey inserts a table; `tests/browser/table-edits.spec.ts` inserts one, types in two cells, adds and deletes rows, undoes and redoes the insert, and checks a reload, the export and a new import. `tests/browser/table-paint.spec.ts` paints imported tables.
- **Live.** Driven on 2026-11-13 with scratch journeys run by path (`$V journey <run> ~/tmp/<file>.mjs`): insert, type and undo at once; insert, type slowly and undo in the cell; insert and reload once the server had it; type `Cell` and reload at once; insert from the keyboard, type `Key`, Tab, type `Board`, Escape; export the current slide with the table. Each case and what it showed is in the sub-features above.
- **States for look.** `table-cells` (an imported table, `scripts/pptx-fixtures/corpus/nasa-roman-thermal-runtime.pptx` slide 10).

## Gotchas

- A cell is `[data-slide-paint] [data-canvas-table] [data-table-text="<row>.<column>"]`, numbered from 0. Rows are `[role="row"]`.
- Cells are `contenteditable`, so `[data-slide-paint] [contenteditable="true"]` counts them with the text boxes.
- An empty cell's `innerText` can be a line break; trim it before you compare.
