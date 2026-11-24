# Group and ungroup elements

On an open deck, Shift+click adds a layer to the selection, and Ctrl/Cmd+G makes the chosen layers one group without moving any of them. The first click on a layer of a group selects the whole group; dragging it moves every layer in it, and a double-click steps inside to the layer itself. Ctrl/Cmd+Shift+G (or Ctrl/Cmd+Backspace) ungroups, putting each layer of the selected group or frame back in the group's parent where it showed. Ctrl/Cmd+Alt+G wraps the selection in a frame that clips it instead. One undo takes each step back.

## Sub-features

- `group` Ctrl/Cmd+G on layers that share a parent writes one new frame node named `Group` with `sizing: { w: "hug", h: "hug" }`, at the front layer's place in the stack, whose box is the layers' bounds; each layer moves into it with its box in the group's space, so nothing moves on the slide (`wrapWrites` in `apps/web/src/editor/group-writes.ts`). The group is selected.
- `frame` Ctrl/Cmd+Alt+G wraps the selection the same way in a frame named `Frame` with `clip: true` that covers it.
- `group-move` a click on any layer of a group selects the group, and a drag moves all its layers; the server stores only the group's new box.
- `ungroup` Ctrl/Cmd+Shift+G or Ctrl/Cmd+Backspace puts each layer of the selected group back in its parent where it showed, and deletes the group (`ungroupWrites`). Undo after an ungroup brings the group back, and a second undo takes the group away.
- `step-in` in nested groups a click picks the top group, each double-click steps one level in, Shift+Enter steps back out to the parent, and Cmd/Ctrl+click picks the layer at once (see `canvas-select.md`).
- `group-transform` resizing a group scales the layers inside it and leaves it hugging them. A layer picked inside a group moves, resizes and turns where it shows on the slide; its box is stored in its group's space, and the group above it fits its layers again.
- `group-copy` Ctrl/Cmd+D on a group copies it with its layers, their words painted.
- `agent-group` an agent's `airdesign_edit_deck` change `{ op: "wrap", nodes: [...], layout? }` wraps layers in a frame and `{ op: "unwrap", node }` takes them out where they show; the Agent panel's Undo takes the run back.

## How to get to it (user POV)

- An open deck `/s/<id>`: click a layer, Shift+click another, then Ctrl/Cmd+G.
- Ctrl/Cmd+Shift+G on the selected group, Ctrl/Cmd+Z to undo.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-arrange-keys.spec.ts`: Ctrl+G groups two of three boxes (the group's box is their bounds and both are its children), Ctrl+Shift+G and Ctrl+Backspace ungroup, Ctrl+Z after an ungroup brings the group back and a second takes it away, and Ctrl+Alt+G wraps the selection in a clipping frame that one undo takes away. `tests/browser/editor-arrange.spec.ts` groups, ungroups and frames from the keys. `tests/browser/editor-select.spec.ts` steps into a group and moves a group with what is inside it. `tests/browser/editor-transform.spec.ts` scales a group's layers by its side grip.
- **States for look.** `two-selected`, `group-stepped-in`, `group-layer-selected`, `group-layer-moved`, `group-layer-turned`, `group-fits`, `group-deleted`, `group-text-copy`, `ungrouped-copy-add`, `frame-group-layer-moved`.

## Gotchas

- Ctrl/Cmd+G does nothing on layers with different parents.
- A group and a frame are both `type: "frame"` nodes; the panel calls one a group when it has no fill, no border and no auto layout and hugs its layers both ways (`isGroup` in `apps/web/src/editor/group-scale.ts`).
