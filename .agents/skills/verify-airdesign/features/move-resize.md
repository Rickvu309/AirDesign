# Move and resize an element

A person clicks an element on the slide to select it. A frame with four corner handles shows around it. Dragging the frame moves the element, dragging a corner resizes it, and the arrow keys nudge it. The element follows the pointer at once, one box edit reaches the server when the gesture ends, the box is there when the deck is opened again, and the export writes it as the shape's `a:xfrm`.

## Sub-features

- `select` a click in a text box puts the caret there and shows the frame and four corner handles. A click on a picture or shape with no text to edit selects it. A click on the empty slide, or Escape twice, clears the frame.
- `move` dragging the frame's edge, or anywhere on a picture or shape with no text to edit, moves the element.
- `resize` dragging a corner handle resizes from that corner and keeps the opposite one. No side gets shorter than a quarter inch unless it already was.
- `nudge` with the element selected and not in its text (Escape from the text), the arrows move it 1 pt and Shift+arrow 10 pt. Enter goes back into the text.
- `edge` a move stops while a quarter inch of the element is still on the slide.
- `kept` the server copy's last box row for the element is the moved box. With the local rows gone, reopening paints the element there.
- `export` the exported slide carries the box as `<a:xfrm><a:off/><a:ext/></a:xfrm>`.
- `cancel` Escape during a drag puts the box back and sends nothing.
- `rotated` a rotated element can be moved but shows no corner handles.
- `hand` pressing H switches to the hand tool, which lays an overlay over the canvas, so nothing can be selected until the pointer tool is back.
- `fixed` an element the export cannot move (inside a group, a chart or table frame, a locked text box) shows the frame with no handles, or takes no click.

## How to get to it (user POV)

- An open deck `/deck/<id>`: click an element on the slide.
- Keyboard: Tab to a text box or a picture, Escape to leave the text, then the arrows.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.
- `scripts/pptx-fixtures/clean.pptx` exists. Its one text box sits at 30,30 px and is 360 by 120 px on the 800 px slide, 15,240 EMU to a pixel.

- **Run it.** `$V journey <run> move-resize`. Prints `"passed":true` and the evidence dir.
- **Select.** Click `[contenteditable="true"]`. One `[data-selection]` with eight `[data-grip]`: four `move` bands on the edges and four corners, `[data-grip]:not([data-grip=move])`. Evidence `NN-selected`.
- **Move.** Drag from the frame's bottom edge (slide origin + 300,150) by 30,60. `[data-canvas-element="ppt/slides/slide1.xml#2"]` sits at 60,90. Evidence `NN-moved`.
- **Resize.** Drag the bottom-right handle (origin + 420,210) by -120,60. The element is 240 by 180. Evidence `NN-resized`.
- **Nudge.** `group "Hello"` has focus after a drag. Shift+ArrowRight moves it 10 pt. Evidence `NN-nudged`.
- **Server copy.** Poll `post(deckRoutes.open, { deck })` until the last visible `property: "box"` row of `256.2` is `{"x":1041400,"y":1371600,"cx":3657600,"cy":2743200}`.
- **Reopen.** Delete the local edit rows from `/version`, open `/deck/<id>`. The element paints at the server's box. Evidence `NN-reloaded-from-server`.
- **Export.** `button "Export"`. The download's `ppt/slides/slide1.xml` carries the box's `a:xfrm` and reads `Hello`.

## Gotchas

- A press inside a text box's text places the caret and starts no drag. Drag a text box by its frame's edge, which shows once it is selected.
- Pixels turn into EMU on the canvas width: at 800 px a 16:9 slide is 15,240 EMU to a pixel, so whole-pixel drags land on whole EMU values.
- Undo and redo of a move or resize are in `person-undo.md`; adding a text box and deleting an element are in `element-edits.md`.
- The box paints before the network. A moved screen is not proof of a save. Wait for `deckRoutes.open`.
