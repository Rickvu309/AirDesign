# Set an element's design from the Design panel

With the Design panel open, selecting an element shows its sections from the trait tables instead of the slide's background: Position and size in points, a shape's Fill (none, one color, a gradient, a pattern), the element's text with its colour, size, bold, italic, underline, alignment and bullets, a table's cells. Every row changes the deck through `planChange`, the same plan an agent's `set` meets, and each change is one Undo step. Clicking the empty slide shows the slide's background again.

## Sub-features

- `design-element` a text box selected: `Position and size` with X, Y, Width and Height, `Text` with the words, `Text color`, `Font size`, `Bold`, `Italic`, `Underline`, `Alignment` and `Bullets`.
- `design-element-changed` X, Bold, a theme colour and Center set from the panel. The canvas and the thumbnail paint each change at once, and the selection frame stays while focus is in the panel (`data-keeps-selection`).
- `design-table` a table selected: X and Y only, and `Cells`, one field per cell.
- `design-fill` a shape whose fill comes from its theme style, filled with a gradient: `Fill` with None, Color, Gradient and Pattern, the gradient's stops (position and color each), `Add stop`, its Direction (Linear with Angle, or From center) and `Rotate with shape`. `Reset fill` in the section's header goes back to the fill the layout, master or theme style gives, and shows only while the shape has its own fill. A fill is a row of trait fields (`{ v, patch }`) in the person's queue, painted from the exported bytes.
- Undo names a panel change `Undo move`, `Undo resize`, `Undo text edit`, `Undo text format` or `Undo fill`.

## How to get to it (user POV)

- An open deck `/deck/<id>`: `Design` beside `Agent` in the toolbar, then a click on an element and Escape to leave its text.
- A change the element cannot take shows `Unable to make that change. The element stays as it was.`

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **States for look.** `design-element`, `design-element-changed`, `design-table`, `design-fill`, each against `/screens/s43-09-editor-tools-design-element`.
- **Browser tests.** One per control kind: `tests/browser/control-length.spec.ts`, `control-text`, `control-table`, `control-choice`, `control-toggle`, `control-color`, `control-union`, `control-record`, `control-list`, `control-percent`, `control-angle`. `tests/browser/shape-fill.spec.ts` fills, resets, undoes, reloads, duplicates and exports; `scripts/pptx-cases/trait-fill.mjs` judges that export.
- **Journey.** `$V journey <run> shape-fill`: an agent's `set` fills every title with accent2 through `/mcp`, a person fills another shape with a gradient, the slide is duplicated, and the export and a new import keep every fill.

## Gotchas

- The table states also show two canvas findings main has, an empty cell (`invisible-control`) and the table's frame inside the selection (`stacked-frames`).
- A build without the element panel reaches `design-element` and `design-table` with the slide's background panel, so the before side of a comparison has a picture.
