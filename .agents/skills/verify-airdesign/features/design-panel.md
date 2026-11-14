# Set an element's design from the Design panel

With the Design panel open, selecting an element shows its sections from the trait tables instead of the slide's background: Position and size in points with Rotation, the flips, Align and Distribute, the element's one Opacity, a shape's Shape (a preset and its adjusts), a shape's Fill (none, one color, a gradient, a pattern), the Line of a shape, picture or connector (its kind and color, width, dash, cap, compound, join and both arrowheads), the Effects of a shape, picture or connector (Shadow, Glow and Soft edge), the element's text with its colour, size, bold, italic, underline, alignment and bullets, a table's cells. Every row changes the deck through `planChange`, the same plan an agent's `set` meets, and each change is one Undo step. Clicking the empty slide shows the slide's background again.

## Sub-features

- `design-element` a text box selected: `Position and size` with X, Y, Width and Height, `Text` with the words, `Text color`, `Font size`, `Bold`, `Italic`, `Underline`, `Alignment` and `Bullets`.
- `design-element-changed` X, Bold, a theme colour and Center set from the panel. The canvas and the thumbnail paint each change at once, and the selection frame stays while focus is in the panel (`data-keeps-selection`).
- `design-table` a table selected: X and Y only, and `Cells`, one field per cell.
- `design-fill` a shape whose fill comes from its theme style, filled with a gradient: `Fill` with None, Color, Gradient and Pattern, the gradient's stops (position and color each), `Add stop`, its Direction (Linear with Angle, or From center) and `Rotate with shape`. `Reset fill` in the section's header goes back to the fill the layout, master or theme style gives, and shows only while the shape has its own fill. A fill is a row of trait fields (`{ v, patch }`) in the person's queue, painted from the exported bytes.
- `design-line` a shape whose line comes from its theme style, its Width set to 6 pt: `Line` with None, Color, Gradient and Pattern, then Width, Dash, Cap, Compound, Join, `Start arrow` and `End arrow`, each with Arrowhead, Width and Length. Only the field set is written into the shape's own `a:ln`; the style still gives the rest. A shape with no line shows only the Line kind row.
- `design-effects` a shape whose shadow comes from its theme style, given a glow: `Effects` with `Shadow` (None, Outer, then Blur, Distance, Direction and Color), `Glow` (None, Glow, then Radius and Color) and `Soft edge` (None, Radius, then Radius). The first change copies the style's effect list into the shape byte for byte, then patches only the field set. A new shadow starts at 4 pt blur, 3 pt away at 45° in black at 40 % alpha, a new glow at 5 pt in accent1 at 40 % alpha, a new soft edge at 5 pt.
- `design-shape` a shape turned 30°, flipped and made a right arrow: `Rotation` in degrees, `Flip horizontally` and `Flip vertically` as toggles, `Align` (Left, Center, Right over Top, Middle, Bottom, against the slide) and `Distribute` (Horizontally, Vertically, which centres one element on the slide), then `Shape` with `Type`, every preset the painter draws but the bent and curved connector lines, and `Adjust`, one number per adjust of the picked preset at its default. A new preset starts from its own adjusts. Turns, flips and presets are rows painted from the exported bytes; Align and Distribute write X or Y.
- `design-opacity` a shape whose fill and line come from its theme style, its Opacity set to 60 %: one `Opacity` section just before Fill fades the fill, the line and the text together. It shows Mixed when they differ, and a group, a table or a chart has none. The export copies the style's fill as the shape's own before it writes the alpha, writes the line's shown colour with its alpha, and writes the alpha on every run's colour. A new colour keeps the opacity the field showed.
- Undo names a panel change `Undo move`, `Undo resize`, `Undo text edit`, `Undo text format`, `Undo fill`, `Undo line`, `Undo effects`, `Undo rotate`, `Undo flip`, `Undo shape` or `Undo opacity`.

## How to get to it (user POV)

- An open deck `/deck/<id>`: `Design` beside `Agent` in the toolbar, then a click on an element and Escape to leave its text.
- A change the element cannot take shows `Unable to make that change. The element stays as it was.`

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **States for look.** `design-element`, `design-element-changed`, `design-table`, `design-fill`, `design-line`, `design-effects`, `design-shape`, `design-opacity`, each against `/screens/s43-09-editor-tools-design-element`.
- **Browser tests.** One per control kind: `tests/browser/control-length.spec.ts`, `control-text`, `control-table`, `control-choice`, `control-toggle`, `control-color`, `control-union`, `control-record`, `control-list`, `control-percent`, `control-angle`, `control-count`, `control-adjust`. `tests/browser/shape-fill.spec.ts` fills, resets, undoes, reloads, duplicates and exports; `scripts/pptx-cases/trait-fill.mjs` judges that export. `tests/browser/line-style.spec.ts` widens and dashes a style line and puts an arrowhead on a connector; `scripts/pptx-cases/trait-line.mjs` judges that export. `tests/browser/shape-geometry.spec.ts` turns, flips, reshapes, adjusts and centres a shape and exports it; `scripts/pptx-cases/trait-geometry.mjs` judges that export. `tests/browser/opacity.spec.ts` fades a style shape, a line and a shape's text; `scripts/pptx-cases/trait-opacity.mjs` judges both exports. `tests/browser/shape-effects.spec.ts` adds glow to a style-shadow rectangle, moves another's shadow and softens its edge in `nasa-cots-electronics.pptx`, undoes, reloads and exports; `scripts/pptx-cases/trait-effects.mjs` judges that export against the corpus original.
- **Journey.** `$V journey <run> shape-fill`: an agent's `set` fills every title with accent2 through `/mcp`, a person fills another shape with a gradient, the slide is duplicated, and the export and a new import keep every fill.
- **Journey.** `$V journey <run> opacity`: an agent's `set` gives every title `opacity: 60` through `/mcp` and `read_deck` prints `alpha 60` on their colours, the editor paints the title text faded, a person sets one title's Opacity to 30, and the export and a new import keep it.
- **Journey.** `$V journey <run> line-style`: an agent's `set` gives a connector a width, accent2, a dash and a triangle end through `/mcp` and `read_deck` prints them, a person widens a style line and bevels its join, and the export and a new import keep both lines.
- **Journey.** `$V journey <run> shape-effects`: an agent's `set` gives a style-shadow rectangle its own shadow and an accent2 glow through `/mcp` and `read_deck` prints them, a person adds a glow to another rectangle whose shadow comes from its style, and the export and a new import keep the agent's effects and the style's copied shadow.
- **Journey.** `$V journey <run> shape-geometry`: an agent's `set` with `box: { align: "right" }` puts every title against its slide's right edge through `/mcp`, titles whose box comes from their layout included, a person turns, flips and reshapes another shape into a right arrow, and the export and a new import keep it.

## Gotchas

- The canvas does not soften a gradient fill's edge (`effect-art.test.ts` pins it as `it.fails`), so `Soft edge` on `nasa-cots-electronics.pptx`'s rectangles shows in the panel and the export but not on the canvas.

- The table states also show two canvas findings main has, an empty cell (`invisible-control`) and the table's frame inside the selection (`stacked-frames`).
- A build without the element panel reaches `design-element` and `design-table` with the slide's background panel, so the before side of a comparison has a picture.
