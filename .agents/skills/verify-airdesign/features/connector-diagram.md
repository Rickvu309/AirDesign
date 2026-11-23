# Connectors and diagrams

A line's two ends are each a point on the slide or a site on another layer: its top, right, bottom or left middle, or its centre (`End` in `packages/doom/src/geometry.ts`). A line whose ends sit on layers is a connector: it routes between them straight, as an elbow, or as a curve, and when a joined layer moves, the connector follows on the canvas during the drag, before the network. Its ends carry arrowheads. An agent makes a diagram in one change with the `flow` pattern: steps in a row, each joined to the next by an arrow from its right site to the next one's left site.

## Sub-features

- `connector-follows` while a person drags a layer a connector ends on, the canvas routes the connector from the layer's live box, so it follows during the drag and stays joined after the drop.
- `connector-fixed` a line with both ends on layers does not move by a drag of its own (`movable` in `apps/web/src/doom-editor/move-writes.ts`); move the layers instead.
- `connector-copy` Ctrl/Cmd+D on a frame holding two shapes and a connector between them copies the connector joined to the copied shapes.
- `connector-panel` the Design panel for a line shows Align, Border and Shadow (`panel-connector`).
- `agent-line` an agent's `airdesign_edit_deck` change `{ op: "add", kind: "line", slide, box, arrow, stroke, strokeWidth }` adds a line across its box, with an arrowhead at its end when `arrow` is true.
- `agent-diagram` `{ op: "add", kind: "flow", slide, items: [{ title, note }, ...] }` with 2 to 6 items adds the steps in an auto layout row and joins each to the next with a straight arrow (`flow` in `packages/doom/src/agent-patterns.ts`). The Agent panel's Undo takes the run back.

## How to get to it (user POV)

- An open deck `/s/<id>` with a connector between two free layers: drag one of them. The steps of a `flow` sit in an auto layout row, so they do not move by a drag.
- The Design panel with the line selected.
- Ask Aira for a flow of steps on a slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **States for look.** `connector-follow` (the start shape held mid-drag while its elbow follows) and `connector-around` (the start held below and left of the end), both on the `connected` deck in `look/doom-canvas.mjs`; `panel-connector`.
- **Unit tests.** `apps/web/src/doom-editor/arrange-writes.test.ts` copies a frame whose connector joins two of its shapes and finds the copy's ends on the copied shapes. `packages/doom/src/agent-patterns.test.ts` checks the patterns land as frame trees Doom accepts.

## Gotchas

- A line's `box` does not say where it paints when its ends sit on layers; the route does. Read where it paints from the canvas.
