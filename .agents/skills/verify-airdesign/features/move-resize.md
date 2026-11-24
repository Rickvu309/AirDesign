# Move and resize an element

A person clicks a layer on the slide to select it. A frame with corner and side grips shows around it, with a rotate zone just outside each corner and a size label under it. Dragging anywhere inside the layer moves it, a corner or a side resizes it, a rotate zone turns it, and the arrow keys nudge it. The layer follows the pointer at once, one edit reaches the server when the gesture ends, and the box is there after a reload. The words are in `transform.md` and `snapping.md`.

## Sub-features

- `select` a click on a layer selects it and shows `[data-selection-outline]`, `[data-handles]` with `[data-grip]` grips and `[data-size-label]`. A click on the empty slide, or Escape, clears it. Selecting more layers is in `canvas-select.md`.
- `move` dragging inside a layer moves it; Shift holds the drag to one axis. A locked layer, a layer laid out by an auto layout frame, and a line with both ends on shapes do not move by a drag (`movable` in `apps/web/src/editor/move-writes.ts`).
- `resize` a corner grip resizes from that corner and keeps the opposite one; a side grip moves one edge. Shift keeps the proportions and Alt resizes from the centre. Resizing a group scales the layers inside it and leaves the group hugging them. Each resize is one undo step.
- `rotate` dragging a rotate zone (`rotate-top-right` and the other corners) turns the layer about its centre; Shift steps by 15 degrees. Shift+H and Shift+V flip the selection.
- `snap` while a drag moves a layer, its edges and centre snap to other layers' and the slide's, with snap guides in the limit colour, and an equal gap in its row or column shows spacing guides. A corner or side resize of upright layers snaps the edges it moves, from the centre with Alt too; a resize with Shift or of a turned layer does not snap. Holding Control places with no snapping. The saved box is the snapped one.
- `duplicate` holding Alt (Option on a Mac) while dragging leaves the layer where it is and drags a copy above it; letting go selects the copy, and one undo takes it away. Escape during the drag drops the copy and keeps the original selected. Ctrl/Cmd+D copies the selection in place and selects the copy.
- `paste` Ctrl/Cmd+C copies the selection and Ctrl/Cmd+X cuts it. Ctrl/Cmd+V pastes a copy into the selected frame, beside the selected layer, or on the slide in view, and selects it. A duplicate keeps lines joined to the duplicated shapes. One undo takes a paste away (`packages/doom/src/copy-writes.ts`, which an agent's duplicate shares).
- `nudge` with a layer selected and not in its text, the arrows move it 1 px and Shift+arrow 10 px of the 1920 px slide.
- `kept` the server copy, read with `doomRoutes.open`, holds the moved box on the layer's node, and a reload paints it there.
- `busy` on a 40-slide deck a drag's main-thread work stays inside one frame, with no frame past 50 ms (`tests/browser/doom-speed.spec.ts`).

## How to get to it (user POV)

- An open deck `/s/<id>`: click a layer on the slide.
- Keyboard: the arrows, Shift+H, Shift+V, Ctrl/Cmd+D, Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/doom-editor.spec.ts` selects the title, drags it, nudges it, undoes, redoes, reloads and deletes it, reading the box from `doomRoutes.open`. `tests/browser/doom-editor-transform.spec.ts` resizes by a corner and a side with one undo each, from the centre with Alt and with Shift, turns by a rotate zone in 15-degree steps, scales a group's layers, and drags an Alt copy and drops it with Escape. `tests/browser/doom-editor-arrange.spec.ts` covers Ctrl+D, Ctrl+C and Ctrl+V and Shift+H; `tests/browser/doom-arrange.spec.ts` covers Ctrl+X and Ctrl+V; `tests/browser/doom-slides-transform.spec.ts` covers Shift+V.
- **States for look.** `editor-selected` (a text box resized by its corner), `two-selected`, `three-moved` and `three-undone`, `canvas-drag-held` and `canvas-drag-landed` (six cards with the Design panel open), `layer-snap-held`, `layer-spacing-held`, `layer-resize-held`, `layer-resize-bar-held`, `layer-resize-centre-snap-held`, `layer-resize-turned-snap-held`, `layers-resize-snap-held`, `layer-rotate-held`, `layer-duplicate-held`, `layer-duplicated`, `layer-duplicated-group`, `layer-pasted`.

## Gotchas

- A press inside a text that is being edited places the caret; press Escape first, then drag.
- Slide units are 1920 to the slide's width: `slidePoint` in `tests/browser/doom-deck.ts` turns them into page pixels at any zoom.
- Undo and redo are in `person-undo.md`; adding and deleting layers are in `element-edits.md`.
- The box paints before the network. A moved screen is not proof of a save: poll `doomRoutes.open`.
