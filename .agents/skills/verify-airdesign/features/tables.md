# Tables

A person inserts a table from the toolbar or with Shift+T and types in its cells; an agent adds one with its cells through `airdesign_edit_deck`. Imported and saved tables paint, take typing and export as native PowerPoint tables.

## Sub-features

- Insert table in the toolbar opens a rows × columns grid: drag (or hover and click) to pick the size, or press Shift+T and use the arrows and Enter. The table lands in the largest free area with the caret in its first cell.
- Double-click a cell to type in it. Tab and Shift+Tab move between cells; Tab in the last cell adds a row. Escape leaves the cell with the table selected. The cell being typed in shows a selection outline.
- An agent sends `{ "op": "add", "kind": "table", "slide": ..., "table": { "value": ... } }` and sets cells, fills and borders with `table.value`; a person's insert and an agent's add are the same `element-add` of kind table.
- With the table selected, a blue bar on the right edge adds a column and one on the bottom edge adds a row; they show when the pointer is over them. A blue plus at a boundary between two columns (above the table) or two rows (left of it) inserts one there.
- A handle above each column and left of each row picks it; Delete or Backspace removes it, Escape lets go. A picked row or column is outlined.
- Dragging the border between two columns or two rows moves width or height from one to the other; the table keeps its size. Widths and row heights are stored as shares in the table value and written to `a:gridCol` and `a:tr` on export.
- The Design panel's Cells section styles the picked row or column, the cell being typed in, or the whole table when nothing is picked: fill, text color, size, bold, italic and alignment. Each change is one edit of the table's value.
- Generic object selection, movement, resizing, deletion and restoration.

## How to get to it (user POV)

Open a deck, click Insert table in the toolbar and pick a size, or import a deck that holds a table and double-click one of its cells.

## Driving it with verify-airdesign

- `table-insert` picks a size with Shift+T and by drag, types twelve cells with Tab, checks the server copy, has Aira add a second table with its cells, exports and opens the export again.
- `table-fill` imports `table-added.pptx`, types in two cells after a double-click, reloads, exports and opens the export again.
- `table-rows-columns` adds a column from the edge bar and a row from a plus, deletes a picked row, drags a column border, undoes and redoes the resize, reloads, exports and opens the export again.
- `tests/browser/table-tool.spec.ts`, `imported-table.spec.ts` and `type-at-once.spec.ts` check the picker, typing and reload; `table-rows-columns.spec.ts` checks rows, columns and widths through export; `table-cell-style.spec.ts` checks a styled header row through export.
- Look states `table-picker` (beside its design `/screens/s43-07-editor-tools-table`), `table-typing`, `table-row-picked`, `table-edge-bar`, `table-cells-panel`, `table-cells` and `design-table`.

## Gotchas

- A new table takes the deck's default table style, as PowerPoint does.
- Typeface, links and borders have no Cells controls yet; agents set them in the table value. Rows and columns cannot be moved by drag yet. Styling an empty cell styles no text until the cell holds some.
