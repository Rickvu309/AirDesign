# Move and resize an element

A person clicks an element on the slide to select it. A frame with corner and edge handles shows around it, with a rotate zone just outside each corner. Dragging anywhere inside the element moves it, dragging a corner or an edge resizes it, and the arrow keys nudge it. The element follows the pointer at once, one box edit reaches the server when the gesture ends, the box is there when the deck is opened again, and the export writes it as the shape's `a:xfrm`.

## Sub-features

- `select` a click on any element, text box included, selects it and shows the frame and its handles. A double-click on a text box, or Enter, puts the caret in its text; while typing, one click in another text box goes straight into that text. A click on the empty slide, or Escape, clears the frame.
- `move` dragging anywhere inside an element that is not being typed in moves it, text included.
- `resize` dragging a corner handle resizes from that corner and keeps the opposite one; an edge resizes one side. Shift keeps the proportions and Alt resizes from the center. No side gets shorter than a quarter inch unless it already was.
- `snap` while a drag, a corner or an edge handle moves an element, its edges and centre snap to another element's or the slide's within 4.5 screen pixels, and a red snap guide shows through what lines up until the pointer is let go. A move also snaps to an equal gap in its row or column and marks the gaps with pink spacing guides. A resize snaps the edges it moves in every case: Alt from the centre, Shift keeping proportions, an edge handle, a rotated element by its outermost points, and a multi-selection by its shared frame. Holding Control during the drag places it with no snapping. The saved box is the snapped one, and one Undo puts it back. Journeys `snap-drag` and `snap-resize`; the words are in `snapping.md`.
- `duplicate` holding Alt (Option on a Mac) while dragging leaves the layer painted at its resting box and moves a copy; letting go lands the copy directly above it, selected, as one `element-clone` row. Letting go of Alt before the pointer comes up moves the layer itself. Ctrl+D copies the selection in place, or the same distance further on when the selection is the copies a duplicate just made. One Undo takes away the copies one gesture made. Groups, layers inside a group, charts and tables refuse with a notice. Journey `layer-duplicate`; the words are in `canvas.md`.
- `paste` Ctrl+C (Cmd+C on a Mac) copies the selection to the clipboard and Ctrl+X cuts it. Ctrl+V pastes it on the slide in view at each layer's own place, selected, as one `element-clone` row per layer onto that slide; Ctrl+Shift+V puts its top left on the selection's. A paste works in another tab of the same deck, and the layers panel takes the same keys. Layers from another deck refuse with a notice. One Undo takes a paste away. Journey `layer-clipboard`; the words are in `canvas.md`.
- `nudge` with the element selected and not in its text, the arrows move it 1 pt and Shift+arrow 10 pt. Enter goes into the text and Escape leaves it.
- `edge` a move stops while a quarter inch of the element is still on the slide.
- `kept` the server copy's last box row for the element is the moved box. With the local rows gone, reopening paints the element there.
- `export` the exported slide carries the box as `<a:xfrm><a:off/><a:ext/></a:xfrm>`.
- `cancel` Escape during a drag puts the box back and sends nothing.
- `frames` a drag paints at most once a frame. The filmstrip and the Design panel keep the resting box until the drag lands; the panel's X, Y, Width and Height follow it.
- `rotated` a rotated element shows its handles turned with it and resizes along its own sides.
- `hand` pressing H switches to the hand tool, which lays an overlay over the canvas, so nothing can be selected until the pointer tool is back.
- `fixed` an element the export cannot move (inside a group, a chart or table frame, a locked text box) shows the frame with no handles, or takes no click.

## How to get to it (user POV)

- An open deck `/deck/<id>`: click an element on the slide.
- Keyboard: Tab to a text box or a picture, then the arrows.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists. Its one text box sits at 30,30 px and is 360 by 120 px on the 800 px slide, 15,240 EMU to a pixel.

- **Run it.** `$V journey <run> move-resize` and `$V journey <run> transform-canvas`. Prints `"passed":true` and the evidence dir.
- **Select.** Click `[contenteditable="true"]`: `group "Hello"` has focus. One `[data-selection]` with twelve `[data-grip]`: four edges (`top`, `right`, `bottom`, `left`), four corners, and four outer corner rotate zones (`rotate-*`). Evidence `NN-selected`.
- **Edit.** Double-click the text: the caret is in it. Escape leaves the text with the layer still selected. Evidence `NN-editing`.
- **Move.** Drag inside the box (slide origin + 300,120) by 30,60. `[data-canvas-element="ppt/slides/slide1.xml#2"]` sits at 60,90. Holding Shift locks the drag to horizontal or vertical. Evidence `NN-moved`.
- **Transform.** Drag an edge to resize along one axis, Shift+drag a corner to keep proportions, Alt+drag to resize from center, drag outside a corner to rotate (Shift snaps to 15 degrees), Shift+H / Shift+V to flip, and select two layers to resize or rotate them together. Live `W × H` and angle pills show during drag. Journey `transform-canvas`.
- **Resize.** Drag the bottom-right handle (origin + 420,210) by -120,60. The element is 240 by 180. Evidence `NN-resized`.
- **Nudge.** `group "Hello"` has focus after a drag. Shift+ArrowRight moves it 10 pt. Evidence `NN-nudged`.
- **Server copy.** Poll `post(deckRoutes.open, { deck })` until the last visible `property: "box"` row of `256.2` is `{"x":1041400,"y":1371600,"cx":3657600,"cy":2743200}`.
- **Reopen.** Delete the local edit rows from `/version`, open `/deck/<id>`. The element paints at the server's box. Evidence `NN-reloaded-from-server`.
- **Busy drag.** `$V journey <run> busy-drag` drags six cards of a busy slide with the Design panel open. Mid-drag the filmstrip keeps them at rest (`NN-drag-held`); on release they land where the pointer left them, the filmstrip catches up (`NN-drag-landed`), the server keeps all six boxes, and one Ctrl+Z puts them back (`NN-undone`).
- **Export.** `button "Export"`. The download's `ppt/slides/slide1.xml` carries the box's `a:xfrm` and reads `Hello`.

## Gotchas

- A press inside a text box's text moves the layer unless someone is typing in a text box; then it places the caret. Double-click to type.
- Pixels turn into EMU on the canvas width: at 800 px a 16:9 slide is 15,240 EMU to a pixel, so whole-pixel drags land on whole EMU values.
- Undo and redo of a move or resize are in `person-undo.md`; adding a text box and deleting an element are in `element-edits.md`.
- The box paints before the network. A moved screen is not proof of a save. Wait for `deckRoutes.open`.
