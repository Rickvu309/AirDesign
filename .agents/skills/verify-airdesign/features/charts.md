# Charts

A person inserts a bar, line or pie chart from the toolbar and edits its numbers in a grid in the Design panel. An agent adds one with its numbers through `airdesign_edit_deck`. Charts made in AirDesign paint, move, resize and export as native PowerPoint charts. A chart the deck was imported with moves like any layer. When it is a clustered column, a standard line or a pie, its numbers open in the Data grid, and editing them changes only those numbers in its chart part and workbook.

Figma Slides has no chart. The tool copies the closest documented pattern, the table: a chart's numbers sit in a small table-like grid, and Insert chart sits in the toolbar beside Insert table.

## Sub-features

- Insert chart in the toolbar opens Bar, Line and Pie. The chart lands at half the slide's size in the largest free area, shrunk to fit beside other layers, selected, with sample numbers: four quarters and two series (one for a pie).
- An agent's chart with no box takes a free area that holds it at three quarters of its size or more; otherwise it splits the slide with the chart it would cover. Both take equal columns on one centre line, and the old chart's move belongs to the same run.
- The Chart section sets a title, the legend's place or none, data labels and their number format, the value axis, gridlines, a bar chart's gap width and each series' colour.
- With the chart selected, the Design panel's Data section switches between Bar, Line and Pie and shows a grid with one row per label and one column per series. A change commits on Enter or when the field loses focus. Add row and the plus add a label or a series; the minus beside a row removes it, and Remove series takes the last one. A pie has one series.
- Each change is one edit of `chart.value`, one Undo step. The chart repaints from the value; the value never shows as text.
- An agent sends `{ "op": "add", "kind": "chart", "slide": ..., "chart": { "value": ... } }`, where the value is JSON with `kind`, `categories` and `series` of `{ name, values }`. A person's insert and an agent's add are the same `element-add` of kind chart.
- Export writes a `graphicFrame`, a `ppt/charts/chartN.xml` part whose series name their cells (`c:strRef`, `c:numRef`) with a cache, and an embedded workbook (`ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx`) linked by `c:externalData`, so PowerPoint's Edit Data opens the numbers. Colours come from the theme's accents unless a series has its own.
- Generic object selection, movement, resizing, deletion and restoration.

## How to get to it (user POV)

Open a deck, click Insert chart in the toolbar and pick Bar, Line or Pie, then open Design.

## Driving it with verify-airdesign

- `chart-insert` inserts a bar chart, renames a series, types a value and switches to Line, then checks the server copy. It drags the chart to the slide's left half and reloads, and the grid still holds the edits. Aira then adds a second chart in a box it names. The journey exports, checks both chart parts and opens the export again.
- `tests/browser/chart-tool.spec.ts` inserts a chart, edits its data, reloads and judges the export.
- `chart-place` (recorded Aira) adds two charts with no box to an empty slide and finds them side by side at one width, then sets the first chart's W in Position and size and checks the exported frame.
- `tests/browser/chart-settings.spec.ts` sets every Chart setting and judges the export; `tests/browser/chart-place.spec.ts` inserts a second chart beside one moved to the left.
- `slide-charts` selects an imported census pie, deletes and restores it, edits its first number and checks that the export changed only that chart and its workbook. `tests/browser/chart-imported.spec.ts` does the same with a move.
- Look states `chart-data-panel`, `chart-settings-panel`, `chart-placed-beside` and `chart-imported-selected`.

## Gotchas

- On a new blank deck, a person's insert counts the empty title and subtitle placeholders as taken, so a second chart from the toolbar can still land over the first. Clear the slide first to drive placement.
