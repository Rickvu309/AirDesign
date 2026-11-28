# Connectors and diagrams

A line's two ends are each a point on the slide or a site on another layer: its top, right, bottom or left middle, or its centre (`End` in `packages/doom/src/geometry.ts`). A line whose ends sit on layers is a connector: it routes between them straight, as an elbow, or as a curve, and when a joined layer moves, the connector follows on the canvas during the drag, before the network. Its ends carry arrowheads.

## Sub-features

- `connector-follows` while a person drags a layer a connector ends on, the canvas routes the connector from the layer's live box, so it follows during the drag and stays joined after the drop.
- `connector-fixed` a line with both ends on layers does not move by a drag of its own (`movable` in `apps/web/src/editor/move-writes.ts`); move the layers instead.
- `connector-copy` Ctrl/Cmd+D on a frame holding two shapes and a connector between them copies the connector joined to the copied shapes.
- `connector-panel` the Design panel for a line shows Align and Border (`panel-connector`). Route and arrowhead controls are in Border.
- `agent-line` an agent adds a line across its box in `airdesign_execute` with `insert({ parent, kind: "line", box, arrow: true })` for an arrowhead at the end.

## How to get to it (user POV)

- An open deck `/s/<id>` with a connector between two free layers: drag one of them.
- The Design panel with the line selected.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser spec.** `tests/browser/editor-line-ends.spec.ts` attaches and frees line ends, changes the route in the panel and reads the saved line.
- **States for look.** `connector-follow` (the start shape held mid-drag while its elbow follows) and `connector-around` (the start held below and left of the end), both on the `connected` deck in `../look/doom-canvas.mjs`; `panel-connector`.
- **Unit tests.** `apps/web/src/editor/arrange-writes.test.ts` copies a frame whose connector joins two of its shapes and finds the copy's ends on the copied shapes.

## Gotchas

- A line's `box` does not say where it paints when its ends sit on layers; the route does. Read where it paints from the canvas.
