# Auto layout frames

On an open deck, Shift+A (or Add auto layout in the element's menu) wraps the selected layers in an auto layout frame: a group whose bottom layer, the backdrop, holds the frame's fill, border and corners. The frame lays its children out in a row or a column, guessed from how they sit, a gap apart, and hugs them. Its slides-mode panel is Figma's: Auto layout frame, Remove auto layout, Fill, Opacity, Corners, Border, Shadow, Selection colors.

## Sub-features

- `wrap` Shift+A sends one `element-group` slide command with a `backdrop` and the guessed `layout` as the group's opening. The status reads `Added auto layout`; the frame is selected; Undo add auto layout puts every layer back with the backdrop gone.
- `frame-paint` Fill, Opacity, Corners and Border write rows on the backdrop; Shadow writes the group's effects. A click on the backdrop selects the frame.
- `remove` Remove auto layout writes `layout.flow: none` and each child's place relative to the frame, so nothing moves, and the title reads Frame. Its Undo brings auto layout back.
- `export` the export writes a `p:grpSp` named Frame with the backdrop `p:sp` first and every child at its laid-out place, child space equal to slide space.

## How to get to it (user POV)

- An open deck `/deck/<id>`: click a layer, Shift+click another, press Shift+A, or right-click and pick Add auto layout.
- `Undo add auto layout` and `Undo remove auto layout` in the toolbar.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> auto-layout-frame`. Prints `"passed":true`.
- **Wrap.** A blank deck, `Rectangle` then `Ellipse` dragged to its right, both chosen, Shift+A. Evidence `NN-wrapped`; `deckRoutes.open` ends with an `element-group` row with a `backdrop`; the ellipse sits beside the rectangle, top aligned.
- **Fill, remove, undo.** Fill Solid lands a fills row on the backdrop (`NN-frame-filled`); Remove auto layout keeps both places (`NN-auto-layout-removed`); its Undo, then Undo fill and Undo add auto layout (`NN-wrap-undone`), then Redo.
- **Reload, export, reimport.** Evidence `auto-layout-frame.pptx` and `NN-reimported`: the frame paints where it was.
- **States for look.** `panel-frame`.

## Gotchas

- `deckRoutes.open` can lag the status line by a moment: poll it for the `element-group` row, as the journey does.
- Shift+A guesses the direction from how the layers lie: drag the second shape beside the first for a row, under it for a column.
- A re-imported deck opens with the Agent panel, so open Design before comparing places with the ones measured beside the Design panel.
