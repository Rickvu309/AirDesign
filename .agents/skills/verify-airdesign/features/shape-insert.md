# Insert a shape

In an open deck, `Shapes` in the toolbar opens the tray the design shows (`/screens/s43-04-editor-tools-shapes`). Every shape in the tray inserts on the current slide as its PowerPoint preset (`Arrow` is a line with an end arrowhead), and `More shapes` opens a grid of every preset. A shape lands in clear space in the theme's own fill and outline, and closes the tray. It moves, resizes and deletes like any element, and Undo takes back each step.

## Sub-features

- `shape-insert` `button "Shapes"`, then `button "Rectangle"`, `"Ellipse"` or `"Line"`. The server's `register.order` gets one `slide: "element-add"` row with `geometry` `rect`, `ellipse` or `line`, `element.kind` `shape` or `connector`, and `element.value: null`.
- `shape-export` the export writes a `p:sp` with `a:prstGeom` `rect` or `ellipse`, or a `p:cxnSp` with `line`, each with a `p:style` that points at the theme's fill and line, and changes only that slide's part. A new import paints all three.
- `shape-grab` a straight line moves by a band wider than its stroke that paints nothing.
- No fill or outline editing, connectors that join shapes, or text inside a shape.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the shapes button in the toolbar under the slide (`Shapes`), or Tab to it and press Enter. The tray opens above it; Escape closes it.
- `Undo add shape` in the toolbar takes the shape back.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> shape-insert`. Prints `"passed":true`.
- **Tray.** A blank deck, `Shapes`; evidence `NN-shape-tray`.
- **Insert.** `Rectangle`, `Ellipse`, `Line`; evidence `NN-shape-added`.
- **Move, resize, delete, undo.** Shift+ArrowRight and the corner grip on the rectangle, evidence `NN-shape-resized`; Delete on the line, `Undo delete element`, `Redo delete element`, `Undo delete element`, evidence `NN-shape-undone`. `deckRoutes.open` holds three `element-add` rows with geometry `rect`, `ellipse`, `line`.
- **Export.** Reload, Export, import the file; evidence `NN-reimported` and `shape-insert.pptx`.
- **States for look.** `shape-tray`, `shape-added`.

## Gotchas

- A straight line's frame is 0 px tall, so Playwright calls it hidden. Wait for its `[data-canvas-line]` and click the middle of that box; the grab band takes the click.
- On the blank deck the shapes paint grey: the theme's accent1 is `#505050`.
