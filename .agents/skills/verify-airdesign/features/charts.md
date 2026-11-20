# Charts

A person inserts a bar, line or pie chart from the toolbar and edits its numbers in a grid in the Design panel. An agent adds one with its numbers through `airdesign_edit_deck`. Charts made in AirDesign paint, move, resize and export as native PowerPoint charts. A chart the deck was imported with stays read-only (see `slide-paint.md`).

Figma Slides has no chart. The tool copies the closest documented pattern, the table: a chart's numbers sit in a small table-like grid, and Insert chart sits in the toolbar beside Insert table.

## Sub-features

- Insert chart in the toolbar opens Bar, Line and Pie. The chart lands at half the slide's size in the largest free area, selected, with sample numbers: four quarters and two series (one for a pie).
- With the chart selected, the Design panel's Data section switches between Bar, Line and Pie and shows a grid with one row per label and one column per series. A change commits on Enter or when the field loses focus. Add row and the plus add a label or a series; the minus beside a row removes it, and Remove series takes the last one. A pie has one series.
- Each change is one edit of `chart.value`, one Undo step. The chart repaints from the value; the value never shows as text.
- An agent sends `{ "op": "add", "kind": "chart", "slide": ..., "chart": { "value": ... } }`, where the value is JSON with `kind`, `categories` and `series` of `{ name, values }`. A person's insert and an agent's add are the same `element-add` of kind chart.
- Export writes a `graphicFrame` and a `ppt/charts/chartN.xml` part with the numbers as literals (`c:strLit`, `c:numLit`), coloured from the theme's accents.
- Generic object selection, movement, resizing, deletion and restoration.

## How to get to it (user POV)

Open a deck, click Insert chart in the toolbar and pick Bar, Line or Pie, then open Design.

## Driving it with verify-airdesign

- `chart-insert` inserts a bar chart, renames a series, types a value and switches to Line, then checks the server copy. It drags the chart to the slide's left half and reloads, and the grid still holds the edits. Aira then adds a second chart in a box it names. The journey exports, checks both chart parts and opens the export again.
- `tests/browser/chart-tool.spec.ts` inserts a chart, edits its data, reloads and judges the export.
- Look state `chart-data-panel`.

## Gotchas

- The chart part keeps no embedded workbook, so PowerPoint shows the numbers but cannot open them in Excel.
- Titles, axis and data labels, and colours per series have no controls yet.
