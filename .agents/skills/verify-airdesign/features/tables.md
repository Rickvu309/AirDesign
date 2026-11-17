# Preserve imported tables

Tables imported from PowerPoint and previously saved table edits still paint and export. Table creation, cell typing, row and column editing, and table Design controls are no longer offered. New table edits are refused for people and agents.

## Sub-features

- Generic object selection, movement, resizing, deletion and restoration remain available.
- Saved table rows retain replay and native export support, including fills, borders and text.

## How to get to it (user POV)

Import a PowerPoint deck containing a table, then select the table on its slide. The Design panel offers generic object controls without cell or table authoring controls.

## Driving it with verify-airdesign

- `table-fill` imports `table-added.pptx`, checks that insert and cell controls are absent, rejects a new table edit, reloads, checks the server register and compares the exported file byte for byte with the original.
- `tests/browser/imported-table.spec.ts` checks the remaining imported-table experience.
- Look states `table-cells` and `design-table` show imported tables.

## Gotchas

- The table export cases still exercise native tables, saved fills and borders, readability and resizing. Historical table data is prepared before import instead of authored through retired controls.
- Document and PowerPoint table tests retain saved-row replay and codec coverage. This does not authorize new table authoring.
