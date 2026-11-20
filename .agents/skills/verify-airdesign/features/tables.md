# Tables

A person inserts a table from the toolbar or with Shift+T and types in its cells; an agent adds one with its cells through `airdesign_edit_deck`. Imported and saved tables paint, take typing and export as native PowerPoint tables.

## Sub-features

- Insert table in the toolbar opens a rows × columns grid: drag (or hover and click) to pick the size, or press Shift+T and use the arrows and Enter. The table lands in the largest free area with the caret in its first cell.
- Double-click a cell to type in it. Tab and Shift+Tab move between cells; Tab in the last cell adds a row. Escape leaves the cell with the table selected. The cell being typed in shows a selection outline.
- An agent sends `{ "op": "add", "kind": "table", "slide": ..., "table": { "value": ... } }` and sets cells, fills and borders with `table.value`; a person's insert and an agent's add are the same `element-add` of kind table.
- Generic object selection, movement, resizing, deletion and restoration.

## How to get to it (user POV)

Open a deck, click Insert table in the toolbar and pick a size, or import a deck that holds a table and double-click one of its cells.

## Driving it with verify-airdesign

- `table-insert` picks a size with Shift+T and by drag, types twelve cells with Tab, checks the server copy, has Aira add a second table with its cells, exports and opens the export again.
- `table-fill` imports `table-added.pptx`, types in two cells after a double-click, reloads, exports and opens the export again.
- `tests/browser/table-tool.spec.ts`, `imported-table.spec.ts` and `type-at-once.spec.ts` check the picker, typing and reload.
- Look states `table-picker` (beside its design `/screens/s43-07-editor-tools-table`), `table-typing`, `table-cells` and `design-table`.

## Gotchas

- A new table takes the deck's default table style, as PowerPoint does.
- Rows and columns are added only by Tab in the last cell for now; cell styling has no panel controls yet.
